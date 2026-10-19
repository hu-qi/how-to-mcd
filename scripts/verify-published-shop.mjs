// Automated browser verification on the PUBLISHED public Pages site.
// Read-only official MCP calls + calculate-price only. NEVER click actual
// create-order confirmation, never record screenshots/traces/token values.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_ROOT);
const token = process.env.MCD_MCP_TOKEN;
if (!token) throw Error("MCD_MCP_TOKEN is required only for trusted main browser smoke");
const site = process.env.HOWTOMCD_SITE_URL || "https://hu-qi.github.io/how-to-mcd/";
const expected = "https://how-to-mcd-api.vercel.app";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  await page.goto(site + "?ci-gateway-check=" + Date.now(), {
    waitUntil: "domcontentloaded", timeout: 45000
  });
  const config = await page.evaluate(async () => {
    const r = await fetch(new URL("api-config.json", document.baseURI), { cache: "no-store" });
    return r.ok ? r.json() : null;
  });
  assert.equal(new URL(config?.apiBase).origin, expected,
    "Published Pages API config does not point to the vetted production gateway");
  console.log("PASS: published Pages loaded the production HTTPS Rust API config");
  await page.locator("#shop-token").fill(token);
  await page.locator("#shop-connect button[type=submit]").click();
  await page.locator("#shop-controls").waitFor({ state: "visible", timeout: 120000 });
  assert.match(await page.locator("#shop-status").textContent(), /独立 Rust HTTPS API/);
  console.log("PASS: browser connected with personal token through hosted Rust gateway");

  await page.locator("#shop-city").fill("北京市");
  await page.locator("#shop-keyword").fill("朝阳区");
  await page.locator("#shop-stores-load").click();
  await page.locator("#shop-stores button").first().waitFor({ state: "visible", timeout: 90000 });
  const stores = await page.locator("#shop-stores button").count();
  assert.ok(stores > 0, "Official MCP returned no store buttons");
  await page.locator("#shop-stores button").first().click();
  await page.locator("#shop-menu-load").click();
  await page.locator("#shop-menu .shop-product").first()
    .waitFor({ state: "visible", timeout: 90000 });
  const productCount = await page.locator("#shop-menu .shop-product").count();
  assert.ok(productCount > 0, "Published page did not render genuine store menu");
  console.log(`PASS: real stores and ${productCount} official menu items rendered in live browser`);
  const meta = await page.locator("#shop-menu-source").textContent();
  assert.match(meta, /麦当劳中国官方 MCP/);
  const firstName = (await page.locator("#shop-menu .shop-product strong").first().textContent()).trim();
  await page.locator("#shop-menu-search").fill(firstName.slice(0, 2));
  assert.ok(await page.locator("#shop-menu .shop-product").count() > 0);
  await page.locator("#shop-menu-search").fill("不存在的菜品qqq");
  assert.equal(await page.locator("#shop-menu .shop-product").count(), 0);
  await page.locator("#shop-menu-clear").click();
  assert.equal(await page.locator("#shop-menu .shop-product").count(), productCount);
  assert.ok(await page.locator("#shop-menu-category option").count() > 1);
  console.log("PASS: official menu search, empty state, category selector, and reset");

  // This only builds a local cart and requests a read-only price quote.
  await page.locator("#shop-menu .shop-product").first()
    .locator("button.shop-primary").click();
  await page.locator("#shop-cart .shop-quantity button").last().click();
  assert.equal(await page.locator("#shop-cart .shop-quantity-value").first().textContent(), "2");
  await page.locator("#shop-cart .shop-quantity button").first().click();
  assert.equal(await page.locator("#shop-cart .shop-quantity-value").first().textContent(), "1");
  await page.locator("#shop-price-load").click();
  await page.locator("#shop-quote").waitFor({ state: "visible", timeout: 90000 });
  const quote = await page.locator("#shop-price").textContent();
  assert.match(quote, /^¥\d+\.\d{2}$/);
  assert.equal(await page.locator("#shop-confirm").isChecked(), false,
    "New official quote must start without user consent");
  assert.equal(await page.locator("#shop-payment").innerText(), "",
    "Quote must not submit or pay for an order");
  console.log("PASS: real official quote rendered; no order created, consent unchecked");
  await page.locator("#shop-disconnect").click();
  assert.equal(await page.locator("#shop-token").inputValue(), "");
  console.log("PASS: disconnect cleared transient personal token from UI");
  await context.close();
} finally {
  await browser.close();
}
