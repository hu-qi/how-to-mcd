"use strict";
// Only the public nutritional fields are extracted. This module works in
// GitHub Pages, local Rust web UI and offline Node fixture tests.
(function (global) {
  const metrics = ["energyKj", "energyKcal", "protein", "fat",
    "carbohydrate", "sodium", "calcium"];
  const containers = new Set(["content", "text", "data", "result", "products",
    "foods", "items", "list", "nutrition", "nutritionList",
    "nutritionFoods", "records", "rows"]);
  function numeric(input) {
    if (input == null || input === "" || input === "-" || input === "null") return null;
    const n = Number(String(input).trim().replace(/(kcal|kj|mg|g)$/i, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function normalize(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const name = value.productName ?? value.name;
    if (typeof name !== "string" || !name.trim() || name.length > 120) return null;
    const row = {
      name: name.trim(),
      description: typeof (value.nutritionDescription ?? value.description) === "string"
        ? String(value.nutritionDescription ?? value.description).slice(0, 300) : null
    };
    for (const k of metrics) row[k] = numeric(value[k]);
    return metrics.some(k => row[k] != null) ? row : null;
  }
  function csv(line) {
    const values = [];
    for (const part of line.matchAll(/("(?:[^"]|"")*"|[^,]*)(,|$)/g)) {
      values.push(part[1].replace(/^"(.*)"$/s, "$1").replace(/""/g, '"'));
      if (!part[2]) break;
    }
    return values;
  }
  function toon(text, out) {
    const normalized = text.replace(/\r/g, "").replace(/\\n/g, "\n");
    const header = /\[\d+\]\s*\{([^}]+)\}\s*:/.exec(normalized);
    if (!header) return;
    const keys = header[1].split(",").map(s => s.trim());
    for (const line of normalized.slice(header.index + header[0].length).split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("[") || trimmed.startsWith("}")) continue;
      const values = csv(trimmed);
      if (values.length < keys.length) continue;
      const object = Object.fromEntries(keys.map((k, i) => [k, values[i]?.trim()]));
      const row = normalize(object);
      if (row) out.push(row);
    }
  }
  function inspect(value, out, depth = 0) {
    if (depth > 8 || value == null) return;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed !== "string") {
          inspect(parsed, out, depth + 1);
          return;
        }
      } catch (_) { /* valid TOON is not JSON */ }
      toon(value, out);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) inspect(item, out, depth + 1);
      return;
    }
    if (typeof value !== "object") return;
    if (value.success === false || (value.code != null && value.code !== 200)) {
      throw Error("官方营养数据查询返回了业务错误");
    }
    const row = normalize(value);
    if (row) { out.push(row); return; }
    for (const [key, entry] of Object.entries(value)) {
      if (containers.has(key)) inspect(entry, out, depth + 1);
    }
  }
  function extractRows(payload) {
    const rows = [];
    inspect(payload, rows);
    const products = [...new Map(rows.map(row => [row.name, row])).values()];
    if (!products.length) throw Error("官方返回结果中没有可识别的营养条目，未替换现有资料");
    return {
      source: "McDonald's China official MCP: list-nutrition-foods",
      generatedAt: new Date().toISOString(),
      scope: "official common-food nutrition, not store-specific availability",
      total: products.length,
      products
    };
  }
  const api = Object.freeze({ extractRows });
  global.HowToMCDNutrition = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
