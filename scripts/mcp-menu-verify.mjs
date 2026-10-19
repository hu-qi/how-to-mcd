// Strict, minimal read-only real-menu verification for GitHub Actions.
// No public raw MCP response, token, addresses, account data or order details.
import fs from "node:fs";
import { createRequire } from "node:module";
const homeGuides = createRequire(import.meta.url)("../web/home-guides.js");

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
function findStoreArrays(data, depth = 0) {
  if (depth > 4 || data == null || typeof data !== "object") return [];
  if (Array.isArray(data)) return [data, ...data.flatMap(v => findStoreArrays(v, depth + 1))];
  const priority = ["stores", "storeList", "list", "data", "records", "nearbyStores", "storeInfoList"];
  const keys = [...priority.filter(k => Object.hasOwn(data, k)), ...Object.keys(data).filter(k => !priority.includes(k))];
  return keys.flatMap(k => findStoreArrays(data[k], depth + 1));
}
export function selectedStore(data) {
  const arrays = findStoreArrays(data);
  const entries = arrays.flat();
  const first = entries.find(v => v && typeof v === "object" &&
    (v.storeCode || v.storeNo || v.code) && v.businessStatus !== false);
  if (!first) {
    // Log shape only. Store names, addresses, account IDs are never printed.
    const topKeys = data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).slice(0, 15) : [];
    console.error("Official store shape:", JSON.stringify({topKeys, arrayLengths: arrays.map(a => a.length).slice(0, 10),
      entryKeys: entries.filter(v => v && typeof v === "object").slice(0, 2).map(v => Object.keys(v).slice(0, 15))}));
    throw Error("No official available store identifier found");
  }
  return { storeCode: String(first.storeCode || first.storeNo || first.code),
    beCode: String(first.beCode || first.businessEntityCode || ""),
    orderType: 1, beType: 1 };
}
export function menuCounts(data) {
  const goods = data?.meals;
  const products = goods && typeof goods === "object" && !Array.isArray(goods)
    ? Object.values(goods).filter(v => typeof v?.name === "string") : [];
  if (!products.length) {
    console.error("Official menu shape:", JSON.stringify({ topKeys: Object.keys(data || {}).slice(0, 20),
      mealsType: Array.isArray(goods) ? "array" : typeof goods }));
    throw Error("Official store menu did not return named products");
  }
  return { productCount: products.length, categoryCount: (data.categories || []).length };
}

// Audits every REAL menu item, not merely the menu count. Only aggregated
// counts appear in CI logs: no account data, addresses or individual products.
export function menuGuideCoverage(data) {
  const meals = data?.meals && typeof data.meals === "object" && !Array.isArray(data.meals)
    ? Object.values(data.meals).filter(v => typeof v?.name === "string") : [];
  const counters = {products: meals.length, fullRecipe: 0, categoryOnly: 0, unknown: 0};
  for (const meal of meals) {
    const resolved = homeGuides.resolve(meal.name);
    if (resolved.status === "unknown") counters.unknown++;
    else if (resolved.relatedRecipeId) counters.fullRecipe++;
    else counters.categoryOnly++;
  }
  return counters;
}
// Only PUBLIC product names from the selected store's official menu. Never
// include store IDs, addresses, account profiles, response blobs or tokens.
// Names are sanitized and capped before diagnostic printing to Actions logs.
export function unclassifiedPublicProductNames(data) {
  const meals = data?.meals && typeof data.meals === "object" && !Array.isArray(data.meals)
    ? Object.values(data.meals).filter(v => typeof v?.name === "string") : [];
  const scrub = name => name.slice(0, 76)
    .replace(/[\\r\\n\\t]+/g, " ")
    .replace(/[0-9]{7,}/g, "[ID]")
    .replace(/[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+/g, "[EMAIL]");
  return [...new Set(meals.filter(meal => homeGuides.resolve(meal.name).status === "unknown")
    .map(meal => scrub(meal.name)))].sort((a,b)=>a.localeCompare(b,"zh-CN")).slice(0,60);
}
const [mode, file] = process.argv.slice(2);
if (mode === "stores") {
  process.stdout.write(JSON.stringify(selectedStore(result(file))));
} else if (mode === "menu") {
  const data = result(file);
  const count = menuCounts(data);
  const coverage = menuGuideCoverage(data);
  console.log("Official store real-menu query passed:", count.productCount,
    "products,", count.categoryCount, "categories. No private data logged.");
  console.log("Home-cooking guide coverage (name-based, approximate):",
    coverage.fullRecipe, "products linked to a complete community recipe,",
    coverage.categoryOnly, "category guide only,",
    coverage.unknown, "commercial recipes unknown.");
  if (process.env.HOWTOMCD_AUDIT_PUBLIC_NAMES === "1") {
    console.log("Public product names requiring review (no IDs, stores, account data):",
      JSON.stringify(unclassifiedPublicProductNames(data)));
  }
} else if (process.argv[1]?.endsWith("mcp-menu-verify.mjs")) {
  throw Error("Expected: stores|menu <private-file>");
}
