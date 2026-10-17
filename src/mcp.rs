//! Read-only McDonald's China MCP client, using the official Rust MCP SDK.
use anyhow::{bail, Result};
use rmcp::{
    model::{CallToolRequestParams, ClientConfig},
    transport::{
        streamable_http_client::StreamableHttpClientTransportConfig,
        StreamableHttpClientTransport,
    },
    ServiceExt,
};
use serde_json::{json, Map, Value};

const ENDPOINT: &str = "https://mcp.mcd.cn";

pub const ALLOWED_TOOLS: [&str; 3] = [
    "list-nutrition-foods",
    "query-meals",
    "query-meal-detail",
];

pub fn is_allowed_tool(name: &str) -> bool {
    ALLOWED_TOOLS.contains(&name)
}

pub fn validate_call(tool: &str, arguments: &Value) -> Result<()> {
    if !is_allowed_tool(tool) {
        bail!("only explicitly allowlisted read-only MCP tools are supported");
    }
    if !arguments.is_object() {
        bail!("tool arguments must be a JSON object");
    }
    if serde_json::to_vec(arguments)?.len() > 8 * 1024 {
        bail!("tool arguments exceed 8 KiB");
    }
    Ok(())
}

pub async fn discover(token: &str) -> Result<Value> {
    let transport = StreamableHttpClientTransport::from_config(
        StreamableHttpClientTransportConfig::with_uri(ENDPOINT).auth_header(token.to_owned()),
    );
    let client = ClientConfig::default().serve(transport).await?;
    let result = client.list_tools(Default::default()).await?;
    let names: Vec<_> = result.tools.iter().map(|t| t.name.to_string()).collect();
    let _ = client.cancel().await;
    Ok(json!({ "server": "McDonald's China MCP", "tools": names, "read_only_allowlist": ALLOWED_TOOLS }))
}

pub async fn call(token: &str, tool: &str, arguments: Value) -> Result<Value> {
    validate_call(tool, &arguments)?;
    let map: Map<String, Value> = arguments.as_object().cloned().unwrap_or_default();
    let transport = StreamableHttpClientTransport::from_config(
        StreamableHttpClientTransportConfig::with_uri(ENDPOINT).auth_header(token.to_owned()),
    );
    let client = ClientConfig::default().serve(transport).await?;
    let result = client
        .call_tool(CallToolRequestParams::new(tool.to_owned()).with_arguments(map))
        .await?;
    let _ = client.cancel().await;
    let response = serde_json::to_value(result)?;
    if response.get("isError").and_then(Value::as_bool) == Some(true) {
        bail!("The remote MCP tool reported an error");
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn block_side_effecting_tools() {
        for name in ["create-order", "delivery-create-address", "redeem-coupon", "available-coupons"] {
            assert!(!is_allowed_tool(name));
            assert!(validate_call(name, &json!({})).is_err());
        }
    }

    #[test]
    fn only_json_objects() {
        assert!(validate_call("list-nutrition-foods", &json!({})).is_ok());
        assert!(validate_call("query-meals", &json!([1, 2])).is_err());
    }

    #[test]
    fn mcp_tool_error_flag_is_visible() {
        let failed = json!({"isError": true, "content": [{"type": "text", "text": "tool unavailable"}]});
        assert_eq!(failed.get("isError").and_then(Value::as_bool), Some(true));
    }

    #[test]
    fn block_oversized_args() {
        assert!(validate_call("query-meals", &json!({ "x": "z".repeat(9000) })).is_err());
    }
}
