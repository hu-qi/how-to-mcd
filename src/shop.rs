//! Explicitly reviewed order creation. Only the local Rust API can invoke
//! the side-effecting official MCP tool, and only after a fresh price check.
use anyhow::{bail, Context, Result};
use serde_json::{json, Map, Value};

pub fn official_data(mcp_result: &Value) -> Result<Value> {
    if mcp_result.get("isError").and_then(Value::as_bool) == Some(true) {
        bail!("The official tool reported an error");
    }
    let blocks = mcp_result.get("content").and_then(Value::as_array)
        .context("MCP reply had no content")?;
    for block in blocks {
        if let Some(text) = block.get("text").and_then(Value::as_str) {
            if let Ok(payload) = serde_json::from_str::<Value>(text) {
                if payload.get("success").and_then(Value::as_bool) == Some(false)
                    || (payload.get("code").is_some() && payload["code"] != 200) {
                    bail!("Official McDonald's business API rejected the request");
                }
                return Ok(payload.get("data").cloned().unwrap_or(payload));
            }
        }
    }
    bail!("Official MCP response was not structured JSON");
}

pub fn validate_order(args: &Value) -> Result<()> {
    let object = args.as_object().context("Order must be a JSON object")?;
    if serde_json::to_vec(args)?.len() > 8192 { bail!("Order exceeds size limit"); }
    for field in ["storeCode", "beCode"] {
        let value = object.get(field).and_then(Value::as_str).unwrap_or("");
        if value.is_empty() || value.len() > 64 { bail!("Missing or invalid store identifier"); }
    }
    let be_type = object.get("beType").and_then(Value::as_u64)
        .context("Missing beType")?;
    if be_type != 1 && be_type != 2 { bail!("Only pickup or delivery are supported"); }
    if be_type == 1 && object.get("takeWayCode").and_then(Value::as_str)
        .filter(|v| !v.is_empty() && v.len() <= 64).is_none() {
        bail!("Pickup requires a takeWayCode from a fresh official quote");
    }
    if be_type == 2 && object.get("addressId").and_then(Value::as_str)
        .filter(|v| !v.is_empty() && v.len() <= 64).is_none() {
        bail!("Delivery requires a chosen official address");
    }
    let items = object.get("items").and_then(Value::as_array)
        .filter(|v| !v.is_empty() && v.len() <= 20)
        .context("Select 1–20 order lines")?;
    for item in items {
        let code = item.get("productCode").and_then(Value::as_str).unwrap_or("");
        let qty = item.get("quantity").and_then(Value::as_u64).unwrap_or(0);
        if code.is_empty() || code.len() > 64 || !(1..=20).contains(&qty) {
            bail!("Invalid item or quantity");
        }
    }
    Ok(())
}

/// Whitelist the fields accepted by calculate-price, never use full order args
/// because addressId/takeWayCode are create-order-only fields.
pub fn quote_args(order: &Value) -> Result<Value> {
    validate_order(order)?;
    let mut result = Map::new();
    for key in ["storeCode", "beCode", "beType", "reservationDate", "gmServiceCode", "items"] {
        if let Some(value) = order.get(key) { result.insert(key.to_owned(), value.clone()); }
    }
    let be_type = order["beType"].as_u64().unwrap_or(0);
    result.insert("orderType".to_owned(), json!(if be_type == 1 { 1 } else { 2 }));
    Ok(Value::Object(result))
}

pub fn quote_total(quote: &Value) -> Result<i64> {
    let data = official_data(quote)?;
    let price = data.get("price").and_then(Value::as_i64)
        .context("Official quote contains no integer cent price")?;
    if !(0..=1_000_000).contains(&price) { bail!("Unexpected official price"); }
    Ok(price)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Value {
        json!({"storeCode":"0123","beCode":"CN","beType":1,"takeWayCode":"counter",
            "items":[{"productCode":"100","quantity":2}]})
    }
    #[test]
    fn requires_complete_order_and_rejects_unexpected_scenarios() {
        assert!(validate_order(&sample()).is_ok());
        let mut bad = sample(); bad["beType"] = json!(6);
        assert!(validate_order(&bad).is_err());
        bad = sample(); bad.as_object_mut().unwrap().remove("takeWayCode");
        assert!(validate_order(&bad).is_err());
        bad = sample(); bad["items"][0]["quantity"] = json!(0);
        assert!(validate_order(&bad).is_err());
    }
    #[test]
    fn builds_official_quote_from_selected_items() {
        let args = quote_args(&sample()).unwrap();
        assert_eq!(args["orderType"], 1);
        assert!(args.get("takeWayCode").is_none());
    }
    #[test]
    fn extracts_verified_business_price() {
        let response = json!({"content":[{"type":"text","text":"{\"success\":true,\"code\":200,\"data\":{\"price\":2200}}"}]});
        assert_eq!(quote_total(&response).unwrap(), 2200);
        let failed = json!({"content":[{"type":"text","text":"{\"success\":false,\"code\":400,\"data\":{\"price\":2200}}"}]});
        assert!(quote_total(&failed).is_err());
    }
}
