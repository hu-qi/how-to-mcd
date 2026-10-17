//! Local-only Rust HTTP server for the interactive cooking workbench.
//! The public browser never receives a McDonald's MCP token or auth header.
use std::net::SocketAddr;

use anyhow::{bail, Context, Result};
use axum::{
    extract::{Path, Query},
    http::{header, StatusCode},
    response::Html,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{mcp, recipes::{self, Ingredient, Recipe}};

type ApiError = (StatusCode, &'static str);
type ApiResult<T> = std::result::Result<Json<T>, ApiError>;

#[derive(Debug, Deserialize)]
struct ServingsQuery {
    servings: Option<u32>,
}

#[derive(Debug, Serialize)]
struct RecipeView {
    recipe: Recipe,
    requested_servings: u32,
    ingredients: Vec<Ingredient>,
}

fn app() -> Router {
    Router::new()
        .route("/", get(|| async { Html(include_str!("../web/index.html")) }))
        .route("/assets/app.css", get(|| async {
            ([(header::CONTENT_TYPE, "text/css; charset=utf-8")], include_str!("../web/app.css"))
        }))
        .route("/assets/app.js", get(|| async {
            ([(header::CONTENT_TYPE, "text/javascript; charset=utf-8")], include_str!("../web/app.js"))
        }))
        .route("/api/health", get(health))
        .route("/api/recipes", get(list_recipes))
        .route("/api/recipes/{id}", get(recipe_detail))
        .route("/api/mcp/status", get(mcp_status))
        .route("/api/mcp/nutrition", get(nutrition))
}

async fn health() -> Json<Value> {
    Json(json!({"status": "ok", "service": "how-to-mcd", "runtime": "rust", "recipe_source": "community"}))
}

async fn list_recipes() -> ApiResult<Vec<Recipe>> {
    recipes::all()
        .map(Json)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Recipe validation failed"))
}

async fn recipe_detail(
    Path(id): Path<String>,
    Query(query): Query<ServingsQuery>,
) -> ApiResult<RecipeView> {
    let recipe = recipes::by_id(&id)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Recipe validation failed"))?
        .ok_or((StatusCode::NOT_FOUND, "Recipe not found"))?;
    let servings = query.servings.unwrap_or(recipe.servings);
    if !(1..=100).contains(&servings) {
        return Err((StatusCode::BAD_REQUEST, "Servings must be between 1 and 100"));
    }
    let ratio = f64::from(servings) / f64::from(recipe.servings);
    let ingredients = recipe.ingredients.iter().map(|item| Ingredient {
        name: item.name.clone(),
        amount: item.amount * ratio,
        unit: item.unit.clone(),
    }).collect();

    Ok(Json(RecipeView { recipe, requested_servings: servings, ingredients }))
}

async fn mcp_status() -> Json<Value> {
    let configured = std::env::var("MCD_MCP_TOKEN")
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    Json(json!({"configured": configured, "endpoint": "official-mcd-china", "mode": "read-only", "secret_exposed": false}))
}

async fn nutrition() -> ApiResult<Value> {
    let token = std::env::var("MCD_MCP_TOKEN")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .ok_or((StatusCode::SERVICE_UNAVAILABLE, "MCD_MCP_TOKEN is not configured on this server"))?;
    let result = mcp::call(&token, "list-nutrition-foods", json!({}))
        .await
        .map_err(|_| (StatusCode::BAD_GATEWAY, "Official MCP request failed; see the documentation for setup"))?;
    Ok(Json(result))
}

/// Bind only to a loopback address, to prevent unauthenticated remote clients
/// from using the host's private MCP credentials.
pub async fn serve(host: &str, port: u16) -> Result<()> {
    let address: SocketAddr = format!("{host}:{port}")
        .parse()
        .context("Invalid --host/--port; use 127.0.0.1 or [::1]")?;
    if !address.ip().is_loopback() {
        bail!("The kitchen server is local-only to protect MCP credentials; use 127.0.0.1 or ::1");
    }
    let listener = tokio::net::TcpListener::bind(address).await?;
    println!("🍳 HowToMCD Rust Kitchen → http://{}/", listener.local_addr()?);
    axum::serve(listener, app()).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    async fn request(path: &str) -> (StatusCode, String) {
        let response = app()
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        let status = response.status();
        let body = response.into_body().collect().await.unwrap().to_bytes();
        (status, String::from_utf8(body.to_vec()).unwrap())
    }

    #[tokio::test]
    async fn routes_and_assets_respond() {
        for path in ["/", "/assets/app.css", "/assets/app.js", "/api/health", "/api/recipes"] {
            let (status, body) = request(path).await;
            assert_eq!(status, StatusCode::OK, "{path}: {body}");
            assert!(!body.is_empty(), "{path}");
        }
    }

    #[tokio::test]
    async fn scales_recipes_on_server() {
        let (status, body) = request("/api/recipes/chicken-burger?servings=4").await;
        assert_eq!(status, StatusCode::OK);
        let result: Value = serde_json::from_str(&body).unwrap();
        assert_eq!(result["requested_servings"], 4);
        assert_eq!(result["ingredients"][0]["amount"], 600.0);
    }

    #[tokio::test]
    async fn rejects_bad_recipe_inputs() {
        assert_eq!(request("/api/recipes/unknown").await.0, StatusCode::NOT_FOUND);
        assert_eq!(request("/api/recipes/chicken-burger?servings=0").await.0, StatusCode::BAD_REQUEST);
        assert_eq!(request("/api/recipes/chicken-burger?servings=101").await.0, StatusCode::BAD_REQUEST);
        assert_eq!(request("/api/recipes/chicken-burger?servings=oops").await.0, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn status_never_discloses_token() {
        let (status, body) = request("/api/mcp/status").await;
        assert_eq!(status, StatusCode::OK);
        assert!(!body.contains("Bearer "));
        assert!(body.contains("secret_exposed"));
    }
}
