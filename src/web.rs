//! Local-only Rust HTTP server for the interactive cooking workbench.
//! The public browser never receives a McDonald's MCP token or auth header.
use std::net::SocketAddr;

use anyhow::{bail, Context, Result};
use axum::{
    extract::{Path, Query},
    http::{header, StatusCode},
    response::Html,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{mcp, mcp_http, pantry, shop, recipes::{self, Ingredient, Recipe}};

type ApiError = (StatusCode, &'static str);
type ApiResult<T> = std::result::Result<Json<T>, ApiError>;

#[derive(Debug, Deserialize)]
struct ServingsQuery {
    servings: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct PantryQuery {
    ingredients: String,
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
        .route("/assets/shop.js", get(|| async {
            ([(header::CONTENT_TYPE, "text/javascript; charset=utf-8")], include_str!("../web/shop.js"))
        }))
        .route("/api/health", get(health))
        .route("/api/recipes", get(list_recipes))
        .route("/api/recipes/{id}", get(recipe_detail))
        .route("/api/suggestions", get(suggestions))
        .route("/api/mcp/status", get(mcp_status))
        .route("/api/mcp/nutrition", get(nutrition))
        .route("/api/mcp/bridge", post(mcp_bridge))
        .route("/api/mcp/quote", post(mcp_quote))
        .route("/api/mcp/checkout", post(mcp_checkout))
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

async fn suggestions(Query(query): Query<PantryQuery>) -> ApiResult<Vec<pantry::Suggestion>> {
    pantry::suggest(&query.ingredients)
        .map(Json)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Provide 1 to 30 ingredients (maximum 512 bytes)"))
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

// Tokens supplied through the UI are request-scoped: no filesystem,
// cookies, application state or browser persistence. Never log requests.
#[derive(Deserialize)]
struct ShopRequest {
    token: Option<String>,
    tool: Option<String>,
    args: Value,
    confirmed: Option<bool>,
    expected_price_cents: Option<i64>,
}

fn shop_token(provided: Option<String>) -> std::result::Result<String, ApiError> {
    provided.filter(|t| !t.trim().is_empty())
        .or_else(|| std::env::var("MCD_MCP_TOKEN").ok())
        .filter(|token| !token.is_empty() && token.len() <= 2048)
        .ok_or((StatusCode::UNAUTHORIZED, "Enter your personal MCP token"))
}

// A public Pages static site has no Rust API; a local same-origin Rust server
// can safely forward user-entered tokens over loopback to the official host.
async fn mcp_bridge(Json(req): Json<ShopRequest>) -> ApiResult<Value> {
    let token = shop_token(req.token)?;
    let tool = req.tool.ok_or((StatusCode::BAD_REQUEST, "Select a read-only MCP tool"))?;
    if !mcp::is_allowed_tool(&tool) {
        return Err((StatusCode::FORBIDDEN, "This MCP tool is not allowed"));
    }
    let result = mcp::call(&token, &tool, req.args).await
        .map_err(|_| (StatusCode::BAD_GATEWAY, "Official MCP read request failed"))?;
    // The business result must also be valid; no simulated menus.
    if tool != "list-nutrition-foods" {
        shop::official_data(&result)
            .map_err(|_| (StatusCode::BAD_GATEWAY, "Official menu request was rejected"))?;
    }
    Ok(Json(result))
}

async fn mcp_quote(Json(req): Json<ShopRequest>) -> ApiResult<Value> {
    let token = shop_token(req.token)?;
    let quote_args = shop::quote_args(&req.args)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Select a store and valid products"))?;
    let result = mcp::call(&token, "calculate-price", quote_args).await
        .map_err(|_| (StatusCode::BAD_GATEWAY, "Official quote request failed"))?;
    shop::quote_total(&result)
        .map_err(|_| (StatusCode::BAD_GATEWAY, "Official price data unavailable"))?;
    Ok(Json(result))
}

async fn mcp_checkout(Json(req): Json<ShopRequest>) -> ApiResult<Value> {
    if req.confirmed != Some(true) {
        return Err((StatusCode::PRECONDITION_REQUIRED, "User confirmation is required"));
    }
    let expected = req.expected_price_cents
        .filter(|v| (0..=1_000_000).contains(v))
        .ok_or((StatusCode::BAD_REQUEST, "Missing previously reviewed quote"))?;
    shop::validate_order(&req.args)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Incomplete store, item or pickup/delivery selection"))?;
    let token = shop_token(req.token)?;
    // Prevent checkout with a stale or forged client-side amount.
    let fresh_args = shop::quote_args(&req.args)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid official quote arguments"))?;
    let quote = mcp::call(&token, "calculate-price", fresh_args).await
        .map_err(|_| (StatusCode::BAD_GATEWAY, "Unable to reprice order"))?;
    let actual = shop::quote_total(&quote)
        .map_err(|_| (StatusCode::BAD_GATEWAY, "Invalid official price response"))?;
    if actual != expected {
        return Err((StatusCode::CONFLICT, "Price changed; get a new official quote before confirming"));
    }
    let result = mcp_http::create_confirmed_order(&token, req.args).await
        .map_err(|_| (StatusCode::BAD_GATEWAY, "Official order submission failed; check your account before retrying"))?;
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
        for path in ["/", "/assets/app.css", "/assets/app.js", "/assets/shop.js", "/api/health", "/api/recipes"] {
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
    async fn suggests_recipes_from_pantry() {
        let (status, body) = request("/api/suggestions?ingredients=%E9%B8%A1%E8%85%BF%2C%E9%9D%A2%E5%8C%85%2C%E7%94%9F%E8%8F%9C").await;
        assert_eq!(status, StatusCode::OK);
        let result: Value = serde_json::from_str(&body).unwrap();
        assert_eq!(result[0]["id"], "chicken-burger");
        assert!(result[0]["score_percent"].as_u64().unwrap() > 0);
    }

    #[tokio::test]
    async fn checkout_denies_any_unconfirmed_requests_without_external_side_effects() {
        let body = json!({"token":"secret","args":{},"confirmed":false,"expected_price_cents":2200});
        let response = app().oneshot(Request::builder()
            .method("POST").uri("/api/mcp/checkout")
            .header("content-type", "application/json")
            .body(Body::from(body.to_string())).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::PRECONDITION_REQUIRED);
    }

    #[tokio::test]
    async fn status_never_discloses_token() {
        let (status, body) = request("/api/mcp/status").await;
        assert_eq!(status, StatusCode::OK);
        assert!(!body.contains("Bearer "));
        assert!(body.contains("secret_exposed"));
    }
}
