# McDonald's China MCP Integration

## Official source

- Documentation: https://open.mcd.cn/mcp/doc
- Official guide: https://github.com/M-China/mcd-mcp-server
- Remote endpoint: `https://mcp.mcd.cn`
- Transport: **Streamable HTTP**
- Authentication: `Authorization: Bearer <token>` via environment variable `MCD_MCP_TOKEN`
- Implementation: **Rust** Streamable HTTP JSON-RPC client using `reqwest`, with the official `rmcp` SDK retained as an optional alternative (`MCD_MCP_TRANSPORT=rmcp`). Both connect to the **real** official server; no mock results are returned.

## Why MCP matters to the project

The official MCP contributes **real restaurant menu metadata** and **official nutrition records**. Community recipes are independent, editable home-cooking instructions; they do not constitute proprietary recipes or nutritional equivalents. Separating both sources makes the project useful and transparent.

## Exact tools and sequence

| Tool | Purpose | Parameters |
| --- | --- | --- |
| `tools/list` | Discover current tool list and schema | MCP protocol discovery |
| `list-nutrition-foods` | Retrieve official nutrition data | Current server input schema; CLI default uses empty JSON |
| `query-meals` | Retrieve real menu for a selected store | Pass valid store identifiers according to live tool schema |
| `query-meal-detail` | Inspect the available details of a selected meal | Pass validated meal identifiers according to live tool schema |

A normal user flow is: `mcp tools` → nutrition/menu lookup through officially supported read-only tools → independent recipe suggestion → ingredient scaling. **No credentials, payments, coupons or orders are requested.**

## How to reproduce on a local machine

```sh
export MCD_MCP_TOKEN="<your personal token>"
cargo run -- mcp tools
cargo run -- mcp nutrition
# Supply actual schema-conforming args obtained from tools/list:
cargo run -- mcp call query-meals --args '{"storeCode":"...","beCode":"..."}'
```

This repository provides a manually runnable GitHub Action (`MCP Smoke Test`) that also runs when its workflow file is changed on main. It performs a real authenticated tools/list and nutrition invocation when the repository secret `MCD_MCP_TOKEN` is configured, without printing the full response to public logs. Pull-request CI intentionally has no access to secrets and tests the Rust application offline. The smoke test remains **unverified** until that Action succeeds with the user's secret.

## Authorization and risk controls

- All tool invocations pass through an explicit allowlist in `src/mcp.rs`.
- Authorization is supplied by Rust `reqwest::RequestBuilder::bearer_auth` (or RMCP's dedicated auth builder when explicitly selected); do not include `Bearer ` in the environment variable. The server negotiates MCP protocol version `2025-03-26`.
- Credentials never appear in examples or committed configuration.
- Errors intentionally suppress untrusted network error detail and credential-bearing headers in CLI output.
- No live MCP responses are fabricated; when unavailable, the program reports failure.
