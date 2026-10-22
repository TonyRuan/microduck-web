import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { installUIWorkerStub } from "./ui-worker-stub.mjs";

// Browser plugin not available in this environment; use the project's Playwright.
const url = process.env.QA_URL ?? "http://127.0.0.1:5173/?qa";
const output = process.env.QA_OUTPUT_DIR ?? "../i18n-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    (process.platform === "win32"
      ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
      : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const errors = [];
const checks = [];
async function context(options = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
    ...options,
  });
  await ctx.addInitScript(installUIWorkerStub);
  const page = await ctx.newPage();
  page.on("request", (request) => {
    if (
      /\/(?:policies|simulation|runtime)\/|\.wasm(?:\?|$)/.test(request.url())
    )
      errors.push(
        "Unexpected model/runtime request in UI test: " + request.url(),
      );
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
      errors.push(m.text());
  });
  return { ctx, page };
}
const ready = async (p) => {
  await p.goto(url);
  await p.waitForFunction(() => window.__duck?.ready, null, {
    timeout: 15000,
  });
  assert.equal(await p.locator("vite-error-overlay").count(), 0);
  assert.equal(await p.evaluate(() => window.__qaUIStub), true);
  assert.match(await p.title(), /Microduck/);
  assert.equal(new URL(p.url()).pathname, new URL(url).pathname);
};
const language = (p) => p.locator("html").getAttribute("lang");
const select = async (p, value) => p.locator("#language").selectOption(value);
const snapshot = (p) =>
  p.evaluate(() => ({
    time: window.__duck.state.time,
    position: window.__duck.state.position,
    paused: window.__duck.state.paused,
    settings: window.__duck.settings,
    policies: window.__duck.policies,
    navigation: performance.timeOrigin,
    messages: [...window.__qaMessages],
  }));
async function noLayoutOverflow(p) {
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  const overflow = await p
    .locator("#menu")
    .evaluate((el) => el.scrollWidth > el.clientWidth);
  assert.equal(overflow, false, "menu horizontal overflow");
}
try {
  for (const locale of ["zh-CN", "zh-TW", "zh-HK", "en-US", "fr-FR"]) {
    const { ctx, page } = await context({ locale });
    await ready(page);
    assert.equal(
      await language(page),
      locale.startsWith("zh") ? "zh-CN" : "en",
    );
    assert.equal(
      await page.locator("#stop").innerText(),
      locale.startsWith("zh") ? "停止" : "Stop",
    );
    assert.match(
      await page.locator("#status").innerText(),
      locale.startsWith("zh") ? /本地运行/ : /Running locally/,
    );
    checks.push(`first visit ${locale}`);
    await ctx.close();
  }
  const { ctx, page } = await context({ locale: "zh-CN" });
  await ready(page);
  await page.locator("#menu-toggle").click();
  await select(page, "en");
  assert.equal(await language(page), "en");
  assert.equal(
    await page.locator("#home").getAttribute("aria-label"),
    "Reset camera",
  );
  assert.equal(
    await page.locator("#hub-repo").getAttribute("placeholder"),
    "author / microduck-bow",
  );
  const before = await snapshot(page);
  for (const choice of ["zh-CN", "en", "zh-CN", "en"])
    await select(page, choice);
  await page.waitForTimeout(150);
  const after = await snapshot(page);
  assert.equal(after.navigation, before.navigation);
  assert.deepEqual(after.settings, before.settings);
  assert.deepEqual(after.policies, before.policies);
  assert.deepEqual(
    after.messages,
    before.messages,
    "language change sent a simulation command",
  );
  assert.ok(after.time > before.time, "simulation stopped or restarted");
  checks.push(
    "repeated switches preserve running worker, settings, policies, and increasing simulation time",
  );
  await page.locator("#pause").click();
  await page.waitForFunction(() => window.__duck.state.paused);
  const frozen = await snapshot(page);
  await select(page, "zh-CN");
  assert.match(await page.locator("#status").innerText(), /仿真已暂停/);
  assert.match(await page.locator("#pause").innerText(), /继续仿真/);
  await select(page, "en");
  assert.match(await page.locator("#status").innerText(), /Simulation paused/);
  assert.match(await page.locator("#pause").innerText(), /Resume simulation/);
  assert.deepEqual(
    await snapshot(page),
    frozen,
    "paused robot changed during language switch",
  );
  await page.locator("#menu").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: resolve(output, "desktop-en.png") });
  checks.push(
    "paused status and resume button translate immediately without changing frozen state",
  );
  await page.reload();
  await page.waitForFunction(() => window.__duck?.ready);
  assert.equal(await language(page), "en");
  await page.locator("#menu-toggle").click();
  assert.equal(await page.locator("#language").inputValue(), "en");
  await select(page, "auto");
  assert.equal(await language(page), "zh-CN");
  await page.reload();
  await page.waitForFunction(() => window.__duck?.ready);
  assert.equal(await language(page), "zh-CN");
  await page.locator("#menu-toggle").click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["fr"],
    });
    dispatchEvent(new Event("languagechange"));
  });
  assert.equal(await language(page), "en");
  await select(page, "zh-CN");
  await page.evaluate(() => dispatchEvent(new Event("languagechange")));
  assert.equal(await language(page), "zh-CN");
  checks.push(
    "explicit persistence, return to auto, browser languagechange, explicit override priority",
  );
  await select(page, "en");
  await page.locator("#tab-library").click();
  await page.locator("#import-submit").click();
  await page.waitForFunction(
    () => document.querySelector("#import-feedback").dataset.error === "true",
  );
  assert.match(
    await page.locator("#import-feedback").innerText(),
    /Select an ONNX file/,
  );
  await page.locator("#tab-controls").click();
  await select(page, "zh-CN");
  await page.locator("#tab-library").click();
  assert.match(
    await page.locator("#import-feedback").innerText(),
    /请选择 ONNX/,
  );
  await page.locator("#model-file").setInputFiles({
    name: "ui-test.onnx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("UI stub; never used for inference"),
  });
  await page.locator("#manifest-file").setInputFiles({
    name: "manifest.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad json"),
  });
  await page.locator("#import-submit").click();
  await page.waitForFunction(
    () => !document.querySelector("#import-submit").disabled,
  );
  assert.match(
    await page.locator("#import-feedback").innerText(),
    /不是有效的 JSON/,
  );
  await page.locator("#manifest-file").setInputFiles({
    name: "manifest.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        name: "我的 Roll <b>",
        description: "社区原文 / unchanged",
        kind: "episodic",
        duration_s: 1,
      }),
    ),
  });
  await page.locator("#import-submit").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".policy-item").length === 1,
    null,
    { timeout: 30000 },
  );
  assert.match(await page.locator("#import-feedback").innerText(), /已导入/);
  await page.locator("#tab-controls").click();
  await select(page, "en");
  await page.locator("#tab-library").click();
  assert.equal(
    await page.locator(".policy-item h4").innerText(),
    "我的 Roll <b>",
  );
  assert.equal(
    await page.locator(".policy-item p").first().innerText(),
    "社区原文 / unchanged",
  );
  assert.equal(await page.locator(".policy-item b").count(), 0);
  assert.match(
    await page.locator(".policy-item .source").innerText(),
    /Local file/,
  );
  assert.equal(
    await page
      .locator(".policy-actions button")
      .filter({ hasText: "Run action" })
      .count(),
    1,
  );
  await page.locator(".policy-item .policy-actions button").first().click();
  await page.waitForFunction(() => window.__duck.state.busy);
  assert.match(await page.locator("#status").innerText(), /我的 Roll <b>/);
  await page.locator("#tab-controls").click();
  const busyBefore = await snapshot(page);
  await select(page, "zh-CN");
  assert.deepEqual((await snapshot(page)).messages, busyBefore.messages);
  await page.waitForFunction(() => !window.__duck.state.busy);
  await page.locator("#tab-library").click();
  await page.screenshot({ path: resolve(output, "library-zh.png") });
  checks.push(
    "dynamic errors, invalid JSON, stubbed import, user metadata escaping, localized source/actions, switching during mocked action",
  );
  await ctx.close();
  const blocked = await context({ locale: "zh-TW" });
  await blocked.ctx.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    }),
  );
  await ready(blocked.page);
  assert.equal(await language(blocked.page), "zh-CN");
  await blocked.page.locator("#menu-toggle").click();
  await select(blocked.page, "en");
  assert.equal(await language(blocked.page), "en");
  await select(blocked.page, "auto");
  assert.equal(await language(blocked.page), "zh-CN");
  await blocked.page.reload();
  await blocked.page.waitForFunction(() => window.__duck?.ready);
  assert.equal(await language(blocked.page), "zh-CN");
  checks.push(
    "blocked localStorage: boot, session switches, auto, reload fallback",
  );
  await blocked.ctx.close();
  const mobile = await context({
    locale: "en-US",
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 15; V2324A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  });
  await ready(mobile.page);
  assert.equal(await mobile.page.evaluate(() => window.__duck.mode), "touch");
  await mobile.page.screenshot({ path: resolve(output, "mobile-en.png") });
  await mobile.page.locator("#menu-toggle").click();
  for (const choice of ["en", "zh-CN", "auto"]) {
    await select(mobile.page, choice);
    await noLayoutOverflow(mobile.page);
  }
  await mobile.page.screenshot({ path: resolve(output, "mobile-menu-en.png") });
  await mobile.page.setViewportSize({ width: 915, height: 412 });
  await noLayoutOverflow(mobile.page);
  await mobile.page.screenshot({
    path: resolve(output, "mobile-landscape.png"),
  });
  checks.push(
    "mobile touch mode, portrait and landscape layouts, repeated language switches",
  );
  await mobile.ctx.close();
  assert.deepEqual(errors, []);
  console.log("PASS", JSON.stringify({ url, uiOnly: true, checks, errors }));
} finally {
  await writeFile(
    resolve(output, "i18n.json"),
    JSON.stringify({ url, uiOnly: true, checks, errors }, null, 2),
  );
  await browser.close();
}
