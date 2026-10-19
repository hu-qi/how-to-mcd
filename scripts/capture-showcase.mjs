// Real-browser contest evidence capture. Runs against the deployed public
// GitHub Pages URL, with no credentials and no mocked page/data responses.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_ROOT || "playwright");
const url = process.env.SHOWCASE_URL || "https://hu-qi.github.io/how-to-mcd/";
const dest = path.resolve("demo-evidence");
const errors = [];
await fs.mkdir(dest, { recursive: true });

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: path.join(dest, "raw-video"), size: { width: 1280, height: 720 } },
});
const page = await desktop.newPage();
const video = page.video();

function watch(page, name) {
  page.on("pageerror", (error) => errors.push(name + ": " + error.message));
}
async function loaded(page) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(
    () => document.getElementById("rust-mode")?.textContent?.includes("WEBASSEMBLY"),
    null,
    { timeout: 45000 }
  );
  await page.locator(".recipe-card").first().waitFor({ timeout: 20000 });
  assert.ok((await page.locator(".recipe-card").count()) >= 23, "expect 23+ real Rust recipes");
}
async function caption(message) {
  await page.evaluate((value) => {
    let banner = document.getElementById("showcase-caption");
    if (!banner) {
      banner = document.createElement("aside");
      banner.id = "showcase-caption";
      Object.assign(banner.style, {
        position: "fixed", left: "18px", right: "18px", bottom: "12px",
        zIndex: "99999", padding: "15px 24px", color: "#101814",
        background: "#d3f17b", borderRadius: "16px",
        fontFamily: "system-ui, sans-serif", fontSize: "22px",
        fontWeight: "800", boxShadow: "0 10px 45px #0009",
        pointerEvents: "none", textAlign: "center"
      });
      document.body.appendChild(banner);
    }
    banner.textContent = value;
  }, message);
}
async function quietScreenshot(file, pageToCapture = page) {
  if (pageToCapture === page) await page.locator("#showcase-caption").evaluate(el => el.hidden = true).catch(() => {});
  await pageToCapture.screenshot({ path: path.join(dest, file), fullPage: true, animations: "disabled" });
  if (pageToCapture === page) await page.locator("#showcase-caption").evaluate(el => el.hidden = false).catch(() => {});
}

try {
  watch(page, "desktop");
  await loaded(page);
  await quietScreenshot("01-desktop-home.png");
  await caption("01 / 05  打开在线厨房：浏览器真实运行 Rust WebAssembly");
  await page.waitForTimeout(7000);

  await page.locator("#pantry-input").fill("鸡腿肉、面包、生菜");
  await page.locator("#pantry-form button[type=submit]").click();
  await page.locator(".pantry-result").first().waitFor({ timeout: 20000 });
  assert.match(await page.locator(".pantry-result").first().textContent(), /鸡腿(?:汉)?堡/);
  await quietScreenshot("02-desktop-pantry-recommendations.png");
  await caption("02 / 05  输入冰箱食材 → Rust 匹配食谱与缺料清单");
  await page.waitForTimeout(7000);

  await page.locator(".pantry-result").first().click();
  await page.locator("#bench-content").waitFor({ state: "visible", timeout: 20000 });
  assert.match(await page.locator("#selected-title").textContent(), /鸡腿(?:汉)?堡/);
  while (Number(await page.locator("#serving-value").textContent()) < 4) {
    await page.locator("#increase").click();
  }
  await page.waitForFunction(
    () => document.querySelector("#ingredients-list .ingredient-amount")?.textContent?.includes("600"),
    null,
    { timeout: 20000 }
  );
  assert.match(await page.locator("#ingredients-list .ingredient-amount").first().textContent(), /600\s*g/);
  await quietScreenshot("03-desktop-four-servings.png");
  await caption("03 / 05  按人数调整 → Rust 精准计算 4 人份食材");
  await page.waitForTimeout(7000);

  await page.locator("#ingredients-list input[type=checkbox]").first().check();
  assert.match(await page.locator("#ingredient-progress").textContent(), /1\s*\/\s*\d+/);
  await caption("04 / 05  勾选已备齐食材，准备开始烹饪");
  await page.waitForTimeout(6000);

  await page.locator("#start-cooking").click();
  await page.locator("#cook-dialog").waitFor({ state: "visible" });
  await page.locator("#cook-next").click();
  await page.locator('.timer-presets button[data-minutes="10"]').click();
  assert.equal((await page.locator("#timer-display").textContent()).trim(), "10:00");
  await quietScreenshot("04-desktop-guided-cooking.png");
  await caption("05 / 05  逐步烹饪引导 + 厨房辅助计时器");
  await page.waitForTimeout(9000);
  await page.locator("#close-cooking").click();
  await page.waitForTimeout(3000);

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1, isMobile: true, hasTouch: true
  });
  const phone = await mobile.newPage();
  watch(phone, "mobile");
  await loaded(phone);
  const overflow = await phone.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  assert.ok(overflow.scrollWidth <= overflow.width + 2,
    "mobile should not overflow horizontally: " + JSON.stringify(overflow));
  await quietScreenshot("05-mobile-home.png", phone);
  await phone.locator("#pantry-input").fill("鸡腿肉、面包、生菜");
  await phone.locator("#pantry-form button[type=submit]").click();
  await phone.locator(".pantry-result").first().waitFor({ timeout: 20000 });
  await quietScreenshot("06-mobile-pantry-recommendations.png", phone);
  await phone.locator(".pantry-result").first().click();
  await phone.locator("#bench-content").waitFor({ state: "visible" });
  assert.match(await phone.locator("#selected-title").textContent(), /鸡腿(?:汉)?堡/);
  await quietScreenshot("07-mobile-workbench.png", phone);
  await phone.locator("#start-cooking").click();
  await phone.locator("#cook-dialog").waitFor({ state: "visible" });
  await phone.locator("#close-cooking").click();
  await mobile.close();

  assert.deepEqual(errors, [], "unexpected browser JavaScript errors");
  await desktop.close();
  await video.saveAs(path.join(dest, "howtomcd-demo.webm"));
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", path.join(dest, "howtomcd-demo.webm"),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    path.join(dest, "howtomcd-demo.mp4")
  ], { stdio: "pipe" });
  await fs.rm(path.join(dest, "raw-video"), { recursive: true, force: true });
  await fs.rm(path.join(dest, "howtomcd-demo.webm"), { force: true });
  const report = {
    verifiedAt: new Date().toISOString(),
    url,
    mode: "RUST / WEBASSEMBLY",
    desktopViewport: "1440x900",
    mobileViewport: "390x844",
    checked: [
      "Page initializes 23+ WASM-backed community recipes",
      "Pantry recommendation ranks chicken burger for supplied ingredients",
      "Rust WASM scales chicken burger to 600 g at four servings",
      "Shopping progress and guided cooking dialog work",
      "10 minute timer preset works",
      "Mobile has no horizontal overflow and key flows work",
      "No browser JavaScript errors"
    ],
    note: "Public WASM demo only; live official MCP was verified separately in secret-backed GitHub Actions run 39037176750."
  };
  await fs.writeFile(path.join(dest, "verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("Public browser walkthrough PASSED; captured seven screenshots and an MP4 video.");
} finally {
  await browser.close();
}
