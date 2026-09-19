import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("qa-output", { recursive: true });
const url = process.env.QA_URL ?? "http://127.0.0.1:5174/microduck/?qa";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const out = {};
try {
  const context = await browser.newContext();
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  const requests = [];
  p.on("request", (r) => requests.push(r.url()));
  await p.goto(url);
  await p.waitForFunction(() => window.__duck?.ready, null, {
    timeout: 120000,
  });
  await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
    timeout: 120000,
  });
  await context.setOffline(true);
  await p.reload();
  await p.waitForFunction(() => window.__duck?.ready, null, {
    timeout: 120000,
  });
  out.offline = {
    ready: true,
    localOnly: requests.every((u) => new URL(u).origin === new URL(url).origin),
    errors,
  };
  assert.ok(out.offline.localOnly);
  assert.deepEqual(errors, []);
  await context.close();
  const mobile = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 15; V2324A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  });
  const page = await mobile.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.__duck?.ready, null, {
    timeout: 120000,
  });
  const cdp = await mobile.newCDPSession(page);
  const touch = async (type, points) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map(([x, y], id) => ({ id, x, y })),
    });
  let cam = await page.evaluate(() => window.__duck.camera);
  await touch("touchStart", [
    [156, 320],
    [256, 320],
  ]);
  await touch("touchMove", [
    [116, 320],
    [296, 320],
  ]);
  await touch("touchEnd", []);
  await page.waitForTimeout(400);
  out.pinch = {
    before: cam.distance,
    after: await page.evaluate(() => window.__duck.camera.distance),
  };
  assert.ok(Math.abs(out.pinch.before - out.pinch.after) > 0.05);
  cam = await page.evaluate(() => window.__duck.camera);
  await touch("touchStart", [
    [140, 320],
    [240, 320],
  ]);
  await touch("touchMove", [
    [160, 345],
    [260, 345],
  ]);
  await touch("touchEnd", []);
  await page.waitForTimeout(400);
  out.pan = {
    before: cam.target,
    after: await page.evaluate(() => window.__duck.camera.target),
  };
  assert.ok(
    Math.hypot(...out.pan.before.map((x, i) => x - out.pan.after[i])) > 0.01,
  );
  const box = await page.locator("#joystick").boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await touch("touchStart", [[x, y]]);
  await touch("touchMove", [[x, y - 55]]);
  await page.waitForTimeout(600);
  assert.ok(await page.evaluate(() => window.__duck.state.vx > 0.3));
  await touch("touchEnd", []);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__duck.state.vx), 0);
  out.touchRelease = true;
  await page.setViewportSize({ width: 915, height: 412 });
  await page.getByRole("button", { name: "恢复默认视角", exact: true }).click();
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "docs/images/landscape.png" });
  await page.getByRole("button", { name: "打开菜单", exact: true }).click();
  await page.locator("#control-mode").selectOption("keyboard");
  await page.locator("#menu-close").click();
  await page.keyboard.down("s");
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => window.__duck.state.vx), -0.4);
  await page.keyboard.up("s");
  await page.keyboard.down("a");
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__duck.state.yaw), 1);
  await page.keyboard.up("a");
  await page.keyboard.down("d");
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__duck.state.yaw), -1);
  await page.keyboard.up("d");
  out.reverseAndYaw = true;
  await mobile.close();
  console.log(
    "PASS static subpath, offline, pinch, pan, touch release, landscape, reverse/yaw",
  );
} finally {
  await writeFile("qa-output/static.json", JSON.stringify(out, null, 2));
  await browser.close();
}
