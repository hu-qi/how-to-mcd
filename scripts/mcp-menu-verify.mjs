// Strict, minimal read-only real-menu verification for GitHub Actions.
// No public raw MCP response, token, addresses, account data or order details.
import fs from "node:fs";

// Official MCP sometimes includes plain-language guidance before its JSON
// response in the SAME text block. Scan for a complete valid business JSON
// object rather than requiring the entire block to be JSON.
export function parseBusinessText(text) {
  const payloads = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0, inString = false, escaped = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            const obj = JSON.parse(text.slice(i, j + 1));
            if (obj && typeof obj === "object" && !Array.isArray(obj) &&
                (Object.hasOwn(obj, "success") || Object.hasOwn(obj, "data"))) {
              payloads.push(obj);
            }
          } catch (_) { /* prose can contain braces */ }
          i = j;
          break;
        }
      }
    }
  }
  return payloads[0] || null;
}

function result(file) {
  const mcp = JSON.parse(fs.readFileSync(file, "utf8"));
  if (mcp.isError) throw Error("Official MCP tool reported error");
  for (const item of mcp.content || []) {
    if (item.type !== "text") continue;
    const parsed = parseBusinessText(item.text);
    if (!parsed) continue; // Guidance and JSON can share one text block

    if (parsed.success === false || (parsed.code != null && parsed.code !== 200))
      throw Error("Official MCP business response was not successful");
    return parsed.data || parsed;
  }
  // Only emit a redacted format preview of the public-store lookup, never the
  // bearer credential, phone numbers or the full account-scoped response.
  const first = (mcp.content || []).find(x => x.type === "text" && typeof x.text === "string")?.text || "";
  const masked = first.slice(0, 480)
    .replace(/[A-Za-z0-9_+.-]+@[A-Za-z0-9.-]+/g, "[EMAIL]")
    .replace(/[0-9]/g, "X")
    .replace(/[A-Za-z0-9_-]{18,}/g, "[LONG_ID]");
  console.error("Official MCP store content format (redacted):", JSON.stringify({
    blockCount: mcp.content?.length || 0, length: first.length,
    preview: masked, newlineCount: (first.match(/\\n/g) || []).length
  }));
  throw Error("No structured JSON result was provided by official MCP (ignored non-JSON guidance)");
}
export function selectedStore(data) {
  const stores = Array.isArray(data) ? data : (data?.stores || data?.storeList || []);
  const first = stores.find(v => v.storeCode && v.beCode && v.businessStatus !== false);
  if (!first) throw Error("No official available store with storeCode and beCode");
  return { storeCode: first.storeCode, beCode: first.beCode, orderType: 1, beType: 1 };
}
export function menuCounts(data) {
  const goods = data?.meals;
  const products = goods && typeof goods === "object" && !Array.isArray(goods)
    ? Object.values(goods).filter(v => typeof v?.name === "string") : [];
  if (!products.length) throw Error("Official store menu did not return named products");
  return { productCount: products.length, categoryCount: (data.categories || []).length };
}

const [mode, file] = process.argv.slice(2);
if (mode === "stores") {
  process.stdout.write(JSON.stringify(selectedStore(result(file))));
} else if (mode === "menu") {
  const count = menuCounts(result(file));
  console.log("Official store real-menu query passed:", count.productCount,
    "products,", count.categoryCount, "categories. No private data logged.");
} else if (process.argv[1]?.endsWith("mcp-menu-verify.mjs")) {
  throw Error("Expected: stores|menu <private-file>");
}
