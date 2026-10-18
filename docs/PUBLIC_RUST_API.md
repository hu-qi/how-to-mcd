# Public Rust MCP gateway — Bring Your Own Token

The GitHub Pages UI is a **static Rust/WebAssembly demo**. The ordering
panel can call a **separate HTTPS Rust API** deployed on Vercel using the
official Vercel Rust 2.x runtime and Axum integration.

## Architecture

```text
Visitor's browser (https://hu-qi.github.io/how-to-mcd/)
  └─ personal MCP Token, only in current tab RAM
       └─ HTTPS POST → Vercel Rust Axum function
            ├─ verify exact Pages Origin + X-HowToMCD-Client: 1
            ├─ reject oversized JSON (12 KiB limit)
            ├─ allowlist read-only MCP tools
            ├─ official quote + explicit consent + server-side re-quote
            └─ https://mcp.mcd.cn (official MCP)
```

**NEVER set `MCD_MCP_TOKEN` on the public Vercel service.** Repository
Actions Secret is for CI verification and public, sanitized, non-personal
nutrition snapshots only. Each visitor supplies their own personal Token,
which the API accepts per request and does not persist in cookies, sessions,
databases, filesystem or logs.

## Deploy

1. Connect `hu-qi/how-to-mcd` as a new Vercel project, using the GitHub
   integration. Use the official `Rust` framework runtime (or autodetect);
   `api/public_api.rs` is the Rust serverless entrypoint,
   `vercel.json` routes `/api/*` to it.
2. Make sure `cargo check --all-targets` and `cargo test --all-targets`
   passed in GitHub Actions. Deploy from reviewed `main` only.
3. Confirm HTTPS `GET /api/health` returns
   `{"status":"ok","service":"how-to-mcd-public-api",...}`.
4. In GitHub Settings → Secrets and variables → Actions → Variables,
   add `HOWTOMCD_PUBLIC_API_URL` with the **public HTTPS origin only**
   (example: `https://your-project.vercel.app`, no path or trailing slash).
   It is a URL **not a Token**.
5. Re-run `Rust WASM Demo and Pages` from Actions. It writes a public
   `api-config.json` to the Pages site, containing only `apiBase`.
   Nothing is read out of private Actions Secrets for ordering.
6. In the public site choose the official ordering panel, supply your own
   MCP Token and select the store/fulfilment type. If an official endpoint
   rejects the Token or a store has no menu, the UI shows a failure rather
   than a mock response.

## API and security

| Endpoint | Method | Required | Purpose |
| --- | --- | --- | --- |
| `/api/health` | GET | none | Public readiness probe |
| `/api/mcp/bridge` | POST | personal Token, allowlisted tool | Official read-only data |
| `/api/mcp/quote` | POST | personal Token, selected store + items | Official price |
| `/api/mcp/checkout` | POST | personal Token, confirmed=true, expected price | Immediate official re-quote, explicit create-order |

All POSTs require exact `Origin: https://hu-qi.github.io`, JSON content
type and `X-HowToMCD-Client: 1` to require CORS preflight. Preflight is
restricted to the same trusted origin. Responses use `Cache-Control:
no-store`. This is defense-in-depth, not a replacement for backend
anti-abuse controls. Enable provider firewall/rate limits and spend alerts
before allowing high public traffic, since client-supplied Tokens do not
stop automated abuse of serverless resources.

Only a successful checkout tool result should be interpreted as an order;
payment always occurs in the official McDonald's flow, not this site.
The API never auto-submits or retries order creation after ambiguous
failures. A 4xx/5xx could mean a real order went through; check the
official account before retrying.

## Limitations

- Browser direct-to-MCP is still dependent on official CORS policy;
  use the Rust API for a reliable cross-origin bridge.
- A public Vercel URL must be healthy and correctly configured before
  the UI can actually use it. Having source code does not establish a
  deployment.
- No real create-order or payment has been executed in CI.
- The official MCP provides menu/meal metadata; proprietary cooking
  techniques are **not** an available tool. Home recipes are independent
  community recipes, not official manufacturing formulas.
