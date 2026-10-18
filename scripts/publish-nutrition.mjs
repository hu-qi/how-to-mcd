// Public, allowlisted McDonald's nutrition snapshot for GitHub Pages.
// No account, address, order, Authorization header or raw MCP response is published.
import fs from "node:fs";
import path from "node:path";

const fields = ["energyKj", "energyKcal", "protein", "fat", "carbohydrate", "sodium", "calcium"];

function numeric(value) {
  if (value == null || value === "" || value === "null" || value === "-") return null;
  const x = typeof value === "number" ? value : Number(String(value).trim().replace(/(kcal|kj|mg|g)$/i, ""));
  return Number.isFinite(x) && x >= 0 ? x : null;
}
function csv(line) {
  const out = [], pattern = /("(?:[^"]|"")*"|[^,]*)(,|$)/g;
  for (const match of line.matchAll(pattern)) {
    out.push(match[1].replace(/^"(.*)"$/s, "$1").replace(/""/g, '"'));
    if (!match[2]) break;
  }
  return out;
}
function normalize(obj) {
  const name = obj.productName ?? obj.name;
  if (typeof name !== "string" || !name.trim() || name.length > 120) return null;
  const row = {
    name: name.trim(),
    description: typeof (obj.nutritionDescription ?? obj.description) === "string"
      ? String(obj.nutritionDescription ?? obj.description).slice(0, 300) : null
  };
  for (const k of fields) row[k] = numeric(obj[k]);
  if (fields.every(k => row[k] == null)) return null;
  return row;
}
function parseToon(text, found, stats) {
  const normalized = text.replace(/\r/g, "").replace(/\\n/g, "\n");
  // Header may appear in a sub-object or in content[0].text directly.
  const heading = normalized.match(/\[\d+\]\s*\{([^}]+)\}\s*:/);
  if (!heading) return;
  stats.toonHeader = true;
  const keys = heading[1].split(",").map(s => s.trim());
  const start = normalized.slice(heading.index + heading[0].length);
  for (const line of start.split("\n")) {
    const cleaned = line.trim();
    if (!cleaned || cleaned.startsWith("[") || cleaned.startsWith("}")) continue;
    const cells = csv(cleaned);
    stats.candidateLines += 1;
    if (cells.length < keys.length) continue;
    const object = Object.fromEntries(keys.map((key, i) => [key, cells[i]?.trim()]));
    const row = normalize(object);
    if (row) found.push(row);
  }
}
function inspect(value, found, stats, level = 0) {
  if (level > 8 || value == null) return;
  if (typeof value === "string") {
    stats.stringLengths.push(value.length);
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== "string") { inspect(parsed, found, stats, level + 1); return; }
    } catch (_) { /* a non-JSON string may contain documented TOON */ }
    parseToon(value, found, stats);
    return;
  }
  if (Array.isArray(value)) {
    stats.arrayLengths.push(value.length);
    for (const item of value) inspect(item, found, stats, level + 1);
    return;
  }
  if (typeof value !== "object") return;
  if (value.success === false || (value.code != null && value.code !== 200)) {
    throw Error("Official nutrition service returned an unsuccessful business response");
  }
  const row = normalize(value);
  if (row) { found.push(row); return; }
  if (level < 3) stats.objectShapes.push(
    Object.entries(value).map(([k, v]) => k + ":" +
      (Array.isArray(v) ? "array" : typeof v)).slice(0, 25)
  );
  // Explore only parseable data containers, no arbitrary metadata.
  for (const [k, v] of Object.entries(value)) {
    if (["content", "text", "data", "result", "products", "foods", "items", "list",
      "nutrition", "nutritionList", "nutritionFoods", "records", "rows"].includes(k)) {
      inspect(v, found, stats, level + 1);
    }
  }
}

export function extractRows(payload, updatedAt = new Date().toISOString()) {
  const found = [];
  const stats = { objectShapes: [], arrayLengths: [], stringLengths: [],
    toonHeader: false, candidateLines: 0 };
  inspect(payload, found, stats);
  const unique = [...new Map(found.map(row => [row.name, row])).values()];
  if (!unique.length) {
    // Safe diagnostics: structure, lengths and row counts only. Never raw data.
    console.error("Nutrition parser safe diagnostics:", JSON.stringify(stats).slice(0, 2400));
    throw Error("No verified official nutrition rows; refusing to publish a fake catalogue");
  }
  return {
    source: "McDonald's China official MCP: list-nutrition-foods",
    generatedAt: updatedAt,
    scope: "common-food nutrition records, NOT a store-specific real-time sale menu",
    total: unique.length, products: unique
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw Error("Expected <private-response.json> <public-catalogue.json>");
  const sanitized = extractRows(JSON.parse(fs.readFileSync(input, "utf8")));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(sanitized, null, 2) + "\n");
  console.log("Published", sanitized.total, "official public nutrition entries. No credentials or user data.");
}
