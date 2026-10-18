// Publish *only* public menu nutrition columns from official MCP.
// No order, account, address, trace ID, headers or bearer tokens are persisted.
// Input: redirected "cargo run -- mcp nutrition" JSON. Output: public catalogue.
import fs from "node:fs";
import path from "node:path";

export function extractRows(payload, updatedAt = new Date().toISOString()) {
  const columns = ["energyKj", "energyKcal", "protein", "fat", "carbohydrate", "sodium", "calcium"];
  const result = [];
  const textBlocks = Array.isArray(payload?.content)
    ? payload.content.filter(x => x.type === "text" && typeof x.text === "string").map(x => x.text)
    : [];
  for (const text of textBlocks) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { data: text }; }
    if (parsed.success === false || (parsed.code != null && parsed.code !== 200))
      throw new Error("Official nutrition MCP returned a business error");
    const value = typeof parsed.data === "string" ? parsed.data : text;
    // Official MCP documents the TOON compact format:
    // [N]{productName,nutritionDescription,energyKj,...}:\n  name,null,1288,...
    const lines = value.replace(/\r/g, "").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || /^\[\d+\]\{/.test(trimmed) || trimmed.startsWith("{")) continue;
      const parts = trimmed.split(",");
      if (parts.length < 9) continue;
      const name = parts[0].trim();
      const rawNumbers = parts.slice(-7);
      const numeric = rawNumbers.map(s => s.trim() === "null" || s.trim() === "" ? null : Number(s.trim()));
      if (!name || name.length > 120 || numeric.some(n => n !== null && (!Number.isFinite(n) || n < 0))) continue;
      const description = parts.slice(1, -7).join(",").trim();
      result.push({
        name,
        description: description && description !== "null" ? description.slice(0, 300) : null,
        ...Object.fromEntries(columns.map((key, i) => [key, numeric[i]]))
      });
    }
  }
  const unique = [...new Map(result.map(x => [x.name, x])).values()];
  if (!unique.length) throw new Error("No verified product rows in official nutrition MCP payload");
  return {
    source: "McDonald's China official MCP: list-nutrition-foods",
    generatedAt: updatedAt,
    scope: "official common-food nutrition list; NOT a store-specific live sale menu",
    total: unique.length,
    products: unique
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("Usage: node scripts/publish-nutrition.mjs <source.json> <destination.json>");
  const data = extractRows(JSON.parse(fs.readFileSync(input, "utf8")));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(data, null, 2) + "\n");
  console.log("Published", data.total, "official nutrition product entries; no credentials or account data");
}
