// Production HTTPS gateway verification. Never outputs bearer tokens or raw
// MCP responses. Does not invoke create-order or any side-effecting tool.
import assert from "node:assert/strict";
import { parseBusinessText, selectedStore, menuCounts } from "./mcp-menu-verify.mjs";

const origin = "https://hu-qi.github.io";
const base = (process.env.HOWTOMCD_PUBLIC_API_URL || "https://how-to-mcd-api.vercel.app").replace(/\/$/, "");
const endpoint = new URL(base);
assert.equal(endpoint.protocol, "https:");
assert.equal(endpoint.origin, base);
const timeout = 65_000;
const request = async (path, method = "GET", { trusted = false, payload } = {}) => {
  const headers = {};
  if (trusted) headers.Origin = origin;
  if (payload !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["X-HowToMCD-Client"] = "1";
  }
  const res = await fetch(base + path, {
    method, headers, redirect: "manual", cache: "no-store",
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(timeout)
  });
  return res;
};
const call = async (token, tool, args) => {
  const res = await request("/api/mcp/bridge", "POST", {
    trusted: true, payload: { token, tool, args }
  });
  assert.equal(res.status, 200, `Official read-only ${tool} gateway status ${res.status}`);
  const body = await res.json();
  assert.notEqual(body.isError, true, `Official read-only ${tool} returned MCP error`);
  for (const part of body.content || []) {
    if (part.type !== "text") continue;
    const parsed = parseBusinessText(part.text);
    if (!parsed) continue;
    assert.notEqual(parsed.success, false, "Official business API rejected request");
    assert.ok(parsed.code == null || parsed.code === 200, "Official business API code was not 200");
    return parsed.data ?? parsed;
  }
  throw Error(`Official read-only ${tool} returned no business JSON`);
};

const health = await request("/api/health", "GET", { trusted: true });
assert.equal(health.status, 200, "Gateway /api/health should be 200");
assert.equal(health.headers.get("access-control-allow-origin"), origin);
assert.equal(health.headers.get("cache-control"), "no-store");
const status = await health.json();
assert.equal(status.service, "how-to-mcd-public-api");
assert.equal(status.server_token_used, false);
console.log("PASS: production HTTPS Rust gateway health + trusted CORS");

const preflight = await fetch(base + "/api/mcp/bridge", {
  method: "OPTIONS",
  headers: {
    Origin: origin,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type,x-howtomcd-client"
  },
  redirect: "manual",
  signal: AbortSignal.timeout(timeout)
});
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
assert.match(preflight.headers.get("access-control-allow-headers") || "", /x-howtomcd-client/i);
console.log("PASS: preflight from real GitHub Pages origin");

const forged = await request("/api/mcp/bridge", "POST", {
  payload: { tool: "list-nutrition-foods", args: {} }
});
assert.equal(forged.status, 403, "Unknown origin must not invoke bridge");

const missing = await request("/api/mcp/bridge", "POST", {
  trusted: true, payload: { tool: "list-nutrition-foods", args: {} }
});
assert.equal(missing.status, 401, "Never fall back to server owner token");

const blocked = await request("/api/mcp/bridge", "POST", {
  trusted: true, payload: { token: "synthetic-check", tool: "create-order", args: {} }
});
assert.equal(blocked.status, 403, "Side-effecting tool must be inaccessible via generic bridge");

const checkout = await request("/api/mcp/checkout", "POST", {
  trusted: true, payload: { token: "synthetic-check", args: {}, confirmed: false, expected_price_cents: 1200 }
});
assert.equal(checkout.status, 428, "Checkout requires explicit confirmation before any RPC");
console.log("PASS: origin / personal-token / read-only allowlist / no-unconfirmed-checkout guards");

const token = process.env.MCD_MCP_TOKEN;
if (!token) {
  console.log("SKIP: real store and menu query (requires Actions secret)");
  process.exit(0);
}
// Use ONLY genuine read-only tools. In particular, NEVER call calculate-price,
// create-order, delivery address tools or a payment endpoint in this CI script.
const stores = await call(token, "query-nearby-stores", {
  searchType: 2, beType: 1, city: "北京市", keyword: "朝阳区"
});
const chosen = selectedStore(stores);
const menu = await call(token, "query-meals", chosen);
const counts = menuCounts(menu);
console.log(`PASS: live store + menu via public HTTPS Rust gateway; ${counts.productCount} products in ${counts.categoryCount} categories`);
