// Strict, minimal read-only real-menu verification for GitHub Actions.
// No public raw MCP response, token, addresses, account data or order details.
import fs from "node:fs";

function result(file) {
  const mcp = JSON.parse(fs.readFileSync(file, "utf8"));
  if (mcp.isError) throw Error("Official MCP tool reported error");
  for (const item of mcp.content || []) {
    if (item.type !== "text") continue;
    let parsed;
    try { parsed = JSON.parse(item.text); }
    catch (_) { continue; } // MCP may precede structured data with human-readable guidance

    if (parsed.success === false || (parsed.code != null && parsed.code !== 200))
      throw Error("Official MCP business response was not successful");
    return parsed.data || parsed;
  }
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
