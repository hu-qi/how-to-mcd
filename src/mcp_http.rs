//! MCP Streamable HTTP implementation for servers that negotiate the
//! 2025-03-26 JSON-RPC lifecycle but cannot complete RMCP's handshake.
//!
//! All requests use Rust reqwest, bearer authorization and the official MCP
//! JSON-RPC envelope. This module does not create orders, access user data,
//! or permit arbitrary MCP tools.

use std::time::Duration;

use anyhow::{bail, Context, Result};
use reqwest::{header, Client, Response};
use serde_json::{json, Map, Value};

const ENDPOINT: &str = "https://mcp.mcd.cn";
const PROTOCOL: &str = "2025-03-26";
const MAX_BODY_BYTES: usize = 4 * 1024 * 1024;

struct Session {
    client: Client,
    token: String,
    version: String,
    session_id: Option<String>,
}

fn decode_response(bytes: &[u8], content_type: &str) -> Result<Value> {
    if bytes.len() > MAX_BODY_BYTES {
        bail!("MCP reply exceeds size limit");
    }
    if content_type.to_ascii_lowercase().starts_with("text/event-stream") {
        let text = std::str::from_utf8(bytes).context("Invalid UTF-8 MCP event stream")?;
        for line in text.lines() {
            if let Some(payload) = line.trim_start().strip_prefix("data:") {
                let value: Value = serde_json::from_str(payload.trim())
                    .context("Invalid MCP SSE JSON")?;
                if value.get("result").is_some() || value.get("error").is_some() {
                    return Ok(value);
                }
            }
        }
        bail!("MCP stream contained no result");
    }
    serde_json::from_slice(bytes).context("Invalid MCP JSON response")
}

async fn decode_http(response: Response) -> Result<Value> {
    let status = response.status();
    if !status.is_success() {
        // Do not include remote body, headers, or sensitive credentials.
        bail!("MCP HTTP status {}", status.as_u16());
    }
    let content_type = response.headers().get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/json")
        .to_string();
    let body = response.bytes().await.context("MCP response body unavailable")?;
    decode_response(&body, &content_type)
}

fn rpc_result(response: Value) -> Result<Value> {
    if response.get("error").is_some() {
        bail!("MCP returned a JSON-RPC error");
    }
    response.get("result").cloned().context("Missing JSON-RPC result")
}

impl Session {
    async fn new(token: &str) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::none())
            .build()?;
        let init = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": PROTOCOL,
                "capabilities": {},
                "clientInfo": { "name": "howtomcd-rust", "version": "0.2.0" }
            }
        });
        let response = client.post(ENDPOINT)
            .bearer_auth(token)
            .header(header::ACCEPT, "application/json, text/event-stream")
            .json(&init)
            .send().await.context("MCP initialize request failed")?;

        let session_id = response.headers().get("mcp-session-id")
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned);
        let init_result = rpc_result(decode_http(response).await?)?;
        let version = init_result.get("protocolVersion").and_then(Value::as_str)
            .context("MCP server did not negotiate a protocol version")?
            .to_owned();
        if version != PROTOCOL {
            bail!("MCP server negotiated an unsupported protocol version");
        }
        let session = Self {
            client,
            token: token.to_owned(),
            version,
            session_id,
        };
        session.notify_initialized().await?;
        Ok(session)
    }

    fn request(&self) -> reqwest::RequestBuilder {
        let builder = self.client.post(ENDPOINT)
            .bearer_auth(&self.token)
            .header(header::ACCEPT, "application/json, text/event-stream")
            .header("MCP-Protocol-Version", self.version.as_str());
        if let Some(id) = &self.session_id {
            builder.header("Mcp-Session-Id", id.as_str())
        } else {
            builder
        }
    }

    async fn notify_initialized(&self) -> Result<()> {
        let response = self.request().json(&json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        })).send().await.context("MCP initialized notification failed")?;
        if !response.status().is_success() {
            bail!("MCP initialized notification was rejected");
        }
        Ok(())
    }

    async fn call_rpc(&self, method: &str, params: Option<Value>) -> Result<Value> {
        let mut message = Map::new();
        message.insert("jsonrpc".into(), json!("2.0"));
        message.insert("id".into(), json!(2));
        message.insert("method".into(), json!(method));
        if let Some(params) = params {
            message.insert("params".into(), params);
        }
        let response = self.request().json(&message)
            .send().await.context("MCP JSON-RPC request failed")?;
        rpc_result(decode_http(response).await?)
    }
}

pub async fn discover(token: &str) -> Result<Value> {
    let session = Session::new(token).await?;
    let result = session.call_rpc("tools/list", Some(json!({}))).await?;
    let list = result.get("tools").and_then(Value::as_array)
        .context("MCP tools/list returned no tool array")?;
    let names: Vec<&str> = list.iter()
        .filter_map(|item| item.get("name").and_then(Value::as_str))
        .collect();
    Ok(json!({
        "server": "McDonald's China MCP",
        "protocolVersion": session.version,
        "tools": names,
        "read_only_allowlist": super::mcp::ALLOWED_TOOLS
    }))
}

pub async fn call(token: &str, name: &str, args: Value) -> Result<Value> {
    super::mcp::validate_call(name, &args)?;
    let session = Session::new(token).await?;
    let result = session.call_rpc("tools/call", Some(json!({
        "name": name,
        "arguments": args
    }))).await?;
    if result.get("isError").and_then(Value::as_bool) == Some(true) {
        bail!("MCP tool reported an error");
    }
    Ok(result)
}

/// A deliberately separated side-effecting path. The public generic
/// MCP dispatcher does not permit create-order. The loopback checkout
/// endpoint validates consent and re-prices immediately before calling here.
pub(crate) async fn create_confirmed_order(token: &str, args: Value) -> Result<Value> {
    crate::shop::validate_order(&args)?;
    let session = Session::new(token).await?;
    let result = session.call_rpc("tools/call", Some(json!({
        "name": "create-order",
        "arguments": args
    }))).await?;
    crate::shop::official_data(&result)?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_legacy_json_rpc() {
        let value = decode_response(br#"{"jsonrpc":"2.0","id":2,"result":{"tools":[]}}"#, "application/json").unwrap();
        assert!(rpc_result(value).unwrap().get("tools").is_some());
    }

    #[test]
    fn parses_sse_json_payload() {
        let input = b"event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{\"tools\":[]}}\n\n";
        let value = decode_response(input, "text/event-stream").unwrap();
        assert!(rpc_result(value).unwrap().get("tools").is_some());
    }

    #[test]
    fn rejects_rpc_errors() {
        let value = json!({"jsonrpc":"2.0", "id":2, "error":{"code":-32601,"message":"Method not found"}});
        assert!(rpc_result(value).is_err());
    }

    #[test]
    fn rejects_unbounded_reply() {
        let bytes = vec![b'x'; MAX_BODY_BYTES + 1];
        assert!(decode_response(&bytes, "application/json").is_err());
    }
}
