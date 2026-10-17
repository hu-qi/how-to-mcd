//! Rust recipe calculations compiled for browsers, with no MCP credentials.
// Share the exact Rust recipe source, without pulling HTTP/network crates into WASM.
#[path = "../../../src/recipes.rs"]
mod recipes;

#[path = "../../../src/pantry.rs"]
mod pantry;

use wasm_bindgen::prelude::*;
use serde_json::json;

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}

/// Load the identical, validated recipe collection used by the native Rust CLI.
#[wasm_bindgen]
pub fn recipes_json() -> Result<String, JsValue> {
    let recipes = recipes::all()
        .map_err(|_| js_error("Recipe validation failed"))?;
    serde_json::to_string(&recipes).map_err(|_| js_error("Recipe serialization failed"))
}

/// Scale a recipe in Rust instead of duplicating ingredient math in JavaScript.
/// The browser receives public recipe data only, never a private MCP token.
#[wasm_bindgen]
pub fn recipe_json(id: &str, servings: u32) -> Result<String, JsValue> {
    if !(1..=100).contains(&servings) {
        return Err(js_error("Servings must be between 1 and 100"));
    }
    let recipe = recipes::by_id(id)
        .map_err(|_| js_error("Recipe validation failed"))?
        .ok_or_else(|| js_error("Recipe not found"))?;
    let ratio = f64::from(servings) / f64::from(recipe.servings);
    let ingredients: Vec<recipes::Ingredient> = recipe.ingredients
        .iter().map(|item| recipes::Ingredient {
            name: item.name.clone(),
            amount: item.amount * ratio,
            unit: item.unit.clone(),
        }).collect();
    serde_json::to_string(&json!({
        "recipe": recipe,
        "requested_servings": servings,
        "ingredients": ingredients
    })).map_err(|_| js_error("Recipe serialization failed"))
}

/// Rank community recipes by available kitchen ingredients using Rust.
#[wasm_bindgen]
pub fn suggestions_json(ingredients: &str) -> Result<String, JsValue> {
    let results = pantry::suggest(ingredients)
        .map_err(|_| js_error("Invalid pantry ingredient list"))?;
    serde_json::to_string(&results).map_err(|_| js_error("Suggestion serialization failed"))
}
