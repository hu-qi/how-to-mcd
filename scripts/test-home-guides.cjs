"use strict";
const assert = require("node:assert/strict");
const guides = require("../web/home-guides.js");
assert.ok(guides.guideCount >= 20, "at least 20 meaningful category guides");
const examples = [
  ["麦乐鸡", "nuggets"],
  ["麦辣鸡翅", "wings"],
  ["经典中薯条", "fries"],
  ["香酥鸡腿堡", "fried-chicken"],
  ["双层吉士汉堡", "beef"],
  ["麦香鱼", "fish"],
  ["猪柳蛋麦满分", "sausage-egg"],
  ["开心乐园餐", "combo"],
  ["冰激凌圣代", "ice-cream"],
  ["麦旋风", "ice-cream"],
  ["摩卡拿铁", "latte"],
  ["美式咖啡", "coffee"],
  ["柠檬红茶", "tea"],
  ["雪碧饮料", "juice"],
  ["苹果派", "apple-pie"],
  ["薯饼", "hash-brown"],
  ["甜玉米杯", "corn"],
  ["饮用纯净水", "plain-water"],
  ["鸡肉卷饼", "wrap"],
  ["未知新品测试内容", "other"],
];
for (const [name, expected] of examples) {
  const g = guides.resolve(name);
  assert.equal(g.id, expected, name + " classification");
  assert.ok(g.title && g.steps.length >= 2);
  assert.ok(g.source.includes("非官方") && g.source.includes("未经过"));
  assert.ok(g.safety.length > 0);
  assert.ok(g.steps.every(t => typeof t === "string" && t.length >= 5));
  if (g.id === "other") {
    assert.equal(g.status, "unknown");
    assert.equal(g.minutes, null);
    assert.deepEqual(g.ingredients, []);
  } else {
    assert.equal(g.status, "category");
  }
}
// The real official menu is dynamic. Every string must still return a guide
// entry rather than returning undefined or hallucinated product ingredients.
for (const name of ["", "🍔 限时新品", "奇怪型号 x3", "饮品-2026", "无糖可乐"]) {
  const g = guides.resolve(name);
  assert.ok(g);
  assert.equal(g.source.startsWith("社区非官方家庭参考"), true);
  assert.ok(g.steps.length >= 2);
}
assert.equal(guides.resolve("未命名新品", "咖啡及饮品").id, "coffee");
assert.equal(guides.resolve("未命名限时新品", "汉堡类").id, "other", "ambiguous burger category must not imply beef ingredients");
assert.equal(guides.resolve("特别版超值套餐").id, "combo");

// Every full community recipe linked from an official category must exist in
// the canonical Rust collection, be independently attributed, and have a
// measured ingredient list plus practical steps and food-safety notes.
const fs = require("node:fs");
const path = require("node:path");
const recipeDir = path.resolve(__dirname, "../recipes");
const actualRecipes = new Map(fs.readdirSync(recipeDir)
  .filter(name => name.endsWith(".json"))
  .map(name => {
    const recipe = JSON.parse(fs.readFileSync(path.join(recipeDir, name), "utf8"));
    return [recipe.id, recipe];
  }));
assert.equal(actualRecipes.size, 23, "all 23 canonical Rust recipes are present");
for (const recipe of actualRecipes.values()) {
  assert.match(recipe.attribution, /社区原创/);
  assert.ok(recipe.ingredients.length >= 2, recipe.id + ": quantified ingredients");
  assert.ok(recipe.ingredients.every(i => i.name && i.amount > 0 && i.unit), recipe.id);
  assert.ok(recipe.steps.length >= 4, recipe.id + ": actionable sequence");
  assert.ok(recipe.safety.length >= 1, recipe.id + ": food safety");
}
const safeGuideCases = [
  ["麦辣鸡翅", "chicken-wings"], ["麦乐鸡", "chicken-nuggets"],
  ["大薯条", "crispy-fries"], ["牛肉吉士汉堡", "beef-burger"],
  ["麦香鱼", "fish-sandwich"], ["鸡肉卷饼", "chicken-wrap"],
  ["早餐蛋麦满分", "breakfast-muffin"], ["苹果派", "apple-turnover"],
  ["冰淇淋圣代", "ice-cream-sundae"], ["热巧克力饮品", "hot-cocoa"],
  ["拿铁咖啡", "milk-latte"], ["手冲咖啡", "drip-coffee"],
  ["奶昔", "fruit-milkshake"], ["柠檬水", "sparkling-lemonade"],
  ["甜玉米杯", "steamed-corn"], ["薯饼", "potato-hashbrown"],
  ["蔬菜沙拉", "garden-salad"], ["奶香玉米浓汤", "vegetable-soup"]
];
for (const [itemName, expectedId] of safeGuideCases) {
  const result = guides.resolve(itemName);
  assert.equal(result.relatedRecipeId, expectedId, itemName + ": matched community recipe");
  assert.ok(actualRecipes.has(result.relatedRecipeId));
}
for (const unknown of ["不公开成分的新品", "限时神秘餐盒"]) {
  const result = guides.resolve(unknown);
  assert.equal(result.relatedRecipeId, null,
    "unknown product must not hallucinate a complete recipe");
}

console.log("PASS: 23 canonical full Rust recipes, verified guide mapping, unknown fallback and food-safety notes.");
