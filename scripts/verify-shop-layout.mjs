// Layout-only fixture: uses candidate HTML/CSS/JS against the real published
// static origin, but never sends a real token, never calls a live MCP tool,
// never creates an order, and never puts account data in screenshot artifacts.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_ROOT);
const site = "https://hu-qi.github.io/how-to-mcd/";
const out = "shop-layout-evidence";
mkdirSync(out, { recursive: true });

const fakeStores = [
  "广州中山大道华港餐厅", "广州天府路华建大厦餐厅",
  "广州华景北路餐厅", "广州暨南大学明湖楼餐厅",
  "广州伟诚广场餐厅"
].map((storeName, i) => ({ storeName, storeCode: "TEST" + i, beCode: "" }));
const meals = {};
const categories = Array.from({length:15}, (_, i) => ({
  name:"示例分类 " + (i+1), meals:[]
}));
for (let i=0;i<130;i++) {
  const code=String(900000000+i);
  meals[code]={
    name: i===0 ? "“我就喜欢”鸡翅双全盒" : i===1
      ? "龙焰芝士棒鸡腿堡三件套（商品名特别长的响应式测试）"
      : "真实菜单布局示例商品 " + String(i+1).padStart(3,"0"),
    currentPrice: "25.9", originalPrice: "32.0",
    discountType:"新品促销",
    ...(i===0?{image:"https://mcd.cn/layout-only-product.png"}:{})
  };
  categories[i%15].meals.push({code, tags:["限时新品"]});
}
const business = data => ({
  content: [{type:"text",text:JSON.stringify({success:true,code:200,data})}]
});
const samplePng=Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9x2rZyUAAAAASUVORK5CYII=",
  "base64"
);
const browser=await chromium.launch({headless:true});
try {
 for (const [name,width,height] of [["desktop",1280,900],["tablet",800,900],["mobile",390,844]]) {
  const context=await browser.newContext({
    viewport:{width,height},deviceScaleFactor:1,serviceWorkers:"block"
  });
  const page=await context.newPage();
  page.setDefaultTimeout(25000);
  await page.route("**/how-to-mcd/**", async route => {
    if (route.request().isNavigationRequest()) {
      await route.fulfill({path:"web/index.html",contentType:"text/html; charset=utf-8"});
    } else await route.continue();
  });
  await page.route("**/assets/app.css", route => route.fulfill({
    path:"web/app.css",contentType:"text/css; charset=utf-8"
  }));
  await page.route("**/assets/shop.js", route => route.fulfill({
    path:"web/shop.js",contentType:"application/javascript; charset=utf-8"
  }));
  await page.route("https://mcd.cn/layout-only-product.png", route =>
    route.fulfill({body:samplePng,contentType:"image/png"}));
  await page.route("https://how-to-mcd-api.vercel.app/api/**", async route => {
    const url=new URL(route.request().url());
    if (url.pathname==="/api/health") {
      return route.fulfill({status:200,contentType:"application/json",
        headers:{"access-control-allow-origin":"https://hu-qi.github.io"},
        body:JSON.stringify({service:"how-to-mcd-public-api",server_token_used:false})});
    }
    if (url.pathname!=="/api/mcp/bridge") return route.abort();
    const body=JSON.parse(route.request().postData()||"{}");
    if (body.token!=="layout-only-not-a-real-token") throw Error("Unexpected credential used");
    const payload=body.tool==="query-nearby-stores" ? {stores:fakeStores}
      : body.tool==="query-meals" ? {meals,categories}
      : body.tool==="list-nutrition-foods" ? {total:0,products:[]}
      : null;
    if (!payload) throw Error("Unexpected tool call: "+body.tool);
    return route.fulfill({status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":"https://hu-qi.github.io"},
      body:JSON.stringify(business(payload))});
  });
  await page.goto(site+"?layout-fixture="+name,{waitUntil:"domcontentloaded",timeout:45000});
  await page.locator("#shop-token").fill("layout-only-not-a-real-token");
  await page.locator("#shop-connect button[type=submit]").click();
  await page.locator("#shop-controls").waitFor({state:"visible",timeout:15000});
  assert.equal(await page.locator("#shop-menu-load").isVisible(),false,
    "Menu-fetch button must not appear before a store is chosen");
  await page.locator("#shop-city").fill("广州市");
  await page.locator("#shop-keyword").fill("天河区");
  await page.locator("#shop-stores-load").click();
  await page.locator("#shop-stores .shop-store-option").first().waitFor({state:"visible"});
  await page.locator("#shop-stores .shop-store-option").first().click();
  assert.equal(await page.locator("#shop-menu-load").isVisible(),true);
  assert.equal(await page.locator("#shop-stores .shop-store-option[aria-pressed=true]").count(),1);
  await page.locator("#shop-menu-load").click();
  await page.locator("#shop-menu .shop-menu-card").first().waitFor({state:"visible"});
  assert.equal(await page.locator("#shop-menu .shop-menu-card").count(),130);
  assert.equal(await page.locator("#shop-menu .shop-guide-trigger").count(),130);
  const m=await page.evaluate(() => {
    const menu=document.querySelector("#shop-menu");
    const cards=[...menu.querySelectorAll(".shop-menu-card")].slice(0,5);
    const box=e=>{const r=e.getBoundingClientRect();return {
      left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    return {
      viewport:document.documentElement.clientWidth,
      documentScroll:document.documentElement.scrollWidth,
      menuClient:menu.clientWidth,menuScroll:menu.scrollWidth,
      cards:cards.map(card=>({
        card:box(card),
        info:box(card.querySelector(".shop-product-info")),
        actions:box(card.querySelector(".shop-product-actions")),
        image:card.querySelector(".shop-official-image")?box(card.querySelector(".shop-official-image")):null,
        buttons:[...card.querySelectorAll(".shop-product-actions button")].map(box)
      }))
    };
  });
  assert.ok(m.documentScroll<=m.viewport+1,`page overflow ${name}: ${JSON.stringify(m)}`);
  assert.ok(m.menuScroll<=m.menuClient+2,`menu overflow ${name}: ${JSON.stringify(m)}`);
  for(const item of m.cards){
    assert.ok(item.info.width>=125,`name too narrow in ${name}`);
    assert.ok(item.info.left>=item.card.left-2 && item.info.right<=item.card.right+2,
      `info outside card in ${name}`);
    assert.ok(item.actions.left>=item.card.left-2 && item.actions.right<=item.card.right+2,
      `actions outside card in ${name}`);
    assert.equal(item.buttons.length,3,`duplicate/missing action in ${name}`);
    for(let i=0;i<item.buttons.length;i++){
      const b=item.buttons[i];
      assert.ok(b.width>=80 && b.left>=item.card.left-2 && b.right<=item.card.right+2,
        `button clipped in ${name}: ${JSON.stringify(item)}`);
      for(let j=0;j<i;j++){
        const other=item.buttons[j];
        const overlap=Math.max(0,Math.min(b.right,other.right)-Math.max(b.left,other.left))
          *Math.max(0,Math.min(b.bottom,other.bottom)-Math.max(b.top,other.top));
        assert.ok(overlap<2,`buttons overlap in ${name}`);
      }
    }
  }
  const panel=page.locator(".shop-panel");
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({path:`${out}/shop-${name}.png`,animations:"disabled"});
  // Store switching must invalidate the currently loaded menu, quote and cart.
  await page.locator("#shop-stores .shop-store-option").nth(1).click();
  assert.equal(await page.locator("#shop-menu .shop-menu-card").count(),0);
  assert.equal(await page.locator("#shop-stores .shop-store-option[aria-pressed=true]").count(),1);
  console.log(`PASS ${name} ${width}px: 130 fixture products, 3 aligned actions/card, no overflow or overlap, store change invalidates old menu`);
  await context.close();
 }
} finally {await browser.close();}
