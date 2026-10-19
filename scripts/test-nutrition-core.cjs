"use strict";
const assert = require("node:assert/strict");
const { extractRows } = require("../web/nutrition-core.js");
const toon = '[2]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium}:\n  猪柳麦满分,null,1288,308,16,16,24,781,213\n  "芝士,牛肉堡",null,1300,320,19,13,25,850,180';
const parsed = extractRows({ success: true, code: 200, data: toon });
assert.equal(parsed.total, 2);
assert.equal(parsed.products[0].name, "猪柳麦满分");
assert.equal(parsed.products[0].energyKcal, 308);
assert.equal(parsed.products[1].name, "芝士,牛肉堡");
const wrapped = extractRows({ content: [
  { type: "text", text: JSON.stringify({ success: true, data: toon }) }
] });
assert.equal(wrapped.total, 2);
const json = extractRows({data:{products:[
  {productName:"烤玉米", energyKcal:120, fat:4, sodium:55},
  {productName:"烤玉米", energyKcal:120, fat:4, sodium:55}
]}});
assert.equal(json.total, 1);
assert.throws(() => extractRows({success:false,code:401,data:toon}));
assert.throws(() => extractRows({data:"some undocumented menu data"}));
assert.equal(Object.keys(parsed.products[0]).includes("token"), false);
console.log("PASS: browser-compatible official nutrition JSON/TOON parsing, deduplication and rejection");
