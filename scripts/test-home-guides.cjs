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
console.log("PASS: 20+ community guide categories, official/non-official boundaries and unknown fallback verified.");
