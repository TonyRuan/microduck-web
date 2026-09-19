import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("qa-output", { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const snapshot = () =>
  page.evaluate(() => {
    const d = window.__duck;
    return {
      ready: d?.ready,
      state: d?.state && { ...d.state, geomPos: undefined, geomMat: undefined },
      mode: d?.mode,
      settings: d?.settings,
      camera: d?.camera,
      policies: d?.policies,
    };
  });
const reports = [];
async function report(name) {
  const s = await snapshot();
  reports.push({ name, ...s });
  console.log(name, JSON.stringify(s.state));
  return s;
}
try {
  await page.goto(process.env.QA_URL ?? "http://localhost:5173/?qa");
  await page.waitForFunction(() => window.__duck?.ready, null, {
    timeout: 120000,
  });
  await page.waitForTimeout(3000);
  let s = await report("boot");
  assert.equal(s.mode, "keyboard");
  assert.equal(s.state.fallen, false);
  assert.equal(s.settings.forward, 0.4);
  await page.screenshot({ path: "docs/images/desktop.png" });
  await page.keyboard.press("p");
  await page.waitForTimeout(150);
  assert.equal((await snapshot()).state.paused, true);
  await page.keyboard.press("p");
  await page.waitForTimeout(150);
  assert.equal((await snapshot()).state.paused, false);
  const origin = s.state.position;
  await page.keyboard.down("w");
  await page.waitForTimeout(3000);
  await page.keyboard.up("w");
  s = await report("walk");
  assert.ok(
    Math.hypot(
      s.state.position[0] - origin[0],
      s.state.position[1] - origin[1],
    ) > 0.15,
  );
  await page.waitForTimeout(500);
  assert.equal((await snapshot()).state.vx, 0);
  for (const [key, name, duration] of [
    ["c", "sit", 3000],
    ["c", "rise", 2200],
    ["r", "roll", 3000],
    ["q", "kick-left", 1600],
    ["e", "kick-right", 1600],
    ["f", "pick", 4000],
  ]) {
    if (["roll", "kick-left", "kick-right", "pick"].includes(name)) {
      await page.getByRole("button", { name: "打开菜单", exact: true }).click();
      await page.locator("#reset").click();
      await page.locator("#menu-close").click();
      await page.waitForTimeout(3000);
    }
    if (name.startsWith("kick-")) {
      await page.getByRole("button", { name: "打开菜单", exact: true }).click();
      await page
        .locator(name === "kick-left" ? "#ball-left" : "#ball-right")
        .click();
      await page.locator("#menu-close").click();
    }
    const ballBefore = (await snapshot()).state.ball;
    await page.keyboard.press(key);
    await page.waitForTimeout(duration);
    s = await report(name);
    assert.equal(s.state.fallen, false, name);
    if (name === "sit") assert.equal(s.state.seated, true);
    if (name.startsWith("kick-"))
      assert.ok(
        Math.hypot(
          s.state.ball[0] - ballBefore[0],
          s.state.ball[1] - ballBefore[1],
        ) > 0.05,
        "ball collision",
      );
  }
  await page.getByRole("button", { name: "打开菜单", exact: true }).click();
  await page.locator("#pause").click();
  await page.waitForTimeout(200);
  s = await snapshot();
  const t = s.state.time;
  await page.waitForTimeout(400);
  assert.equal((await snapshot()).state.time, t);
  await page.locator("#pause").click();
  await page.locator("#control-mode").selectOption("touch");
  await page.screenshot({ path: "docs/images/menu.png" });
  await page.locator("#menu-close").click();
  assert.equal((await snapshot()).mode, "touch");
  const box = await page.locator("#joystick").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 10, { steps: 5 });
  await page.waitForTimeout(1000);
  assert.ok((await snapshot()).state.vx > 0.3);
  await page.mouse.up();
  await page.waitForTimeout(150);
  assert.equal((await snapshot()).state.vx, 0);
  await report("joystick");
  const cam = (await snapshot()).camera;
  await page.mouse.move(750, 400);
  await page.mouse.wheel(0, 180);
  await page.waitForTimeout(400);
  assert.ok(Math.abs((await snapshot()).camera.distance - cam.distance) > 0.02);
  await page.reload();
  await page.waitForFunction(() => window.__duck?.ready, null, {
    timeout: 120000,
  });
  assert.equal((await snapshot()).mode, "touch");
  await report("saved-settings");
  await context.close();
  const mobile = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 15; V2324A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  });
  const p = await mobile.newPage();
  await p.goto(process.env.QA_URL ?? "http://localhost:5173/?qa");
  await p.waitForFunction(() => window.__duck?.ready, null, {
    timeout: 120000,
  });
  await p.waitForTimeout(2000);
  assert.equal(await p.evaluate(() => window.__duck.mode), "touch");
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await p.screenshot({ path: "docs/images/mobile.png" });
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log("PASS");
} finally {
  await writeFile(
    "qa-output/browser.json",
    JSON.stringify({ reports, errors }, null, 2),
  );
  await browser.close();
}
