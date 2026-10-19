// Browser layout regression: uses the real published official nutrition
// snapshot with this PR's candidate CSS/JS. No tokens or order endpoints.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_ROOT);
const site = "https://hu-qi.github.io/how-to-mcd/";
const out = "nutrition-layout-evidence";
mkdirSync(out, {recursive:true});

const browser=await chromium.launch({headless:true});
try {
  for (const [name, width, height] of [["desktop", 1280, 900],["tablet", 800, 900],["mobile", 390, 844]]) {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:"block"});
    const page=await context.newPage();
    // Test the candidate HTML too: the original bug was a missing visible
    // nutrition guide outlet, even while the shop button handler was valid.
    await page.route("**/how-to-mcd/**", async route => {
      if (route.request().isNavigationRequest()) {
        await route.fulfill({ path:"web/index.html", contentType:"text/html; charset=utf-8" });
      } else {
        await route.continue();
      }
    });
    await page.route("**/assets/app.css", async route=>route.fulfill({
      path:"web/app.css", contentType:"text/css; charset=utf-8"
    }));
    await page.route("**/assets/shop.js", async route=>route.fulfill({
      path:"web/shop.js",contentType:"application/javascript; charset=utf-8"
    }));
    await page.goto(site+"?nutrition-layout-check="+name, {waitUntil:"domcontentloaded",timeout:45000});
    await page.locator("#nutrition-products .nutrition-card").first().waitFor({state:"visible",timeout:60000});
    const metrics=await page.evaluate(()=>{
      const grid=document.querySelector("#nutrition-products");
      const cards=[...grid.querySelectorAll(".nutrition-card")];
      const card=cards[0];
      const name=card.querySelector(".nutrition-product-name");
      const actions=card.querySelector(".nutrition-card-actions");
      const stats=card.querySelector(".nutrition-stats");
      const rect=e=>{let r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      return {
        viewport:document.documentElement.clientWidth,
        documentScroll:document.documentElement.scrollWidth,
        gridClient:grid.clientWidth,gridScroll:grid.scrollWidth,
        cards:cards.length,gridColumns:getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        card:rect(card),name:rect(name),stats:rect(stats),actions:rect(actions),
        buttons:[...actions.querySelectorAll("button")].map(rect),
        nameText:name.textContent,statCount:stats.querySelectorAll(".nutrition-stat").length
      };
    });
    assert.ok(metrics.cards >= 5,`nutrition data missing: ${name}`);
    assert.ok(metrics.documentScroll <= metrics.viewport+1,`page horizontal overflow: ${name} ${JSON.stringify(metrics)}`);
    assert.ok(metrics.gridScroll <= metrics.gridClient+2,`nutrition horizontal overflow: ${name} ${JSON.stringify(metrics)}`);
    assert.ok(metrics.name.width >= 200,`Chinese product name squeezed into vertical column: ${name}`);
    assert.ok(metrics.name.height < 100,`Product name excessively wraps: ${name}`);
    assert.ok(metrics.statCount >= 2,`Nutrition facts not displayed: ${name}`);
    assert.ok(metrics.actions.top >= metrics.stats.bottom-1,`Buttons appear beside nutrition facts: ${name}`);
    for(const rect of metrics.buttons){
      assert.ok(rect.width >= 110,`Button too narrow: ${name}`);
      assert.ok(rect.left >= metrics.card.left-2 && rect.right <= metrics.card.right+2,`Button overflows card: ${name}`);
    }
    if(name==="desktop") assert.equal(metrics.gridColumns,2,"expected two readable desktop columns");
    if(name==="mobile")assert.equal(metrics.gridColumns,1,"expected one mobile column");
    const panel=page.locator(".nutrition-panel");
    await panel.scrollIntoViewIfNeeded();
    await panel.screenshot({path:`${out}/nutrition-${name}.png`,animations:"disabled",timeout:15000});
    const guideButton = page.locator(".nutrition-card .shop-guide-trigger").first();
    assert.ok(await guideButton.isVisible(),
      "Non-official recipe guide action must be visible inside nutrition card");
    assert.equal(await guideButton.getAttribute("aria-controls"), "nutrition-home-guide");
    assert.equal(await page.locator("#shop-controls").isVisible(), false,
      "Guest test must run with shopping section still hidden");
    await guideButton.click();
    await page.locator("#nutrition-home-guide").waitFor({state:"visible",timeout:12000});
    assert.equal(await page.locator("#shop-home-guide").isVisible(), false,
      "Guest guide must not render into the hidden authenticated shopping panel");
    const description = await page.locator("#nutrition-home-guide").innerText();
    assert.match(description, /社区非官方|商业配方|不是官方/);
    assert.ok(await page.locator("#nutrition-home-guide li").count() >= 2);
    await page.locator("#nutrition-home-guide").screenshot({
      path:`${out}/nutrition-${name}-guide.png`, animations:"disabled",timeout:15000
    });
    await page.locator("#nutrition-home-guide .shop-home-guide-head button").click();
    await page.locator("#nutrition-home-guide").waitFor({state:"hidden"});
    console.log(`PASS ${name}: ${metrics.cards} nutrition cards, ${metrics.gridColumns} columns; guest recipe guide opens and closes, shopping auth not required`);
    await context.close();
  }
} finally {
  await browser.close();
}
