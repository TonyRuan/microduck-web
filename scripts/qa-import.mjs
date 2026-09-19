import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await mkdir("qa-output", { recursive: true });
execFileSync("curl", [
  "--fail",
  "--location",
  "--max-time",
  "90",
  "--silent",
  "https://huggingface.co/fffiloni/microduck-polite-bow-b1d864/resolve/9a9d21a85cf7b5cbd1854c03ad58bd949502a5ea/policy.onnx",
  "--output",
  "qa-output/bow.onnx",
]);
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const out = {};
try {
  await page.goto(process.env.QA_URL ?? "http://localhost:5173/?qa");
  await page.waitForFunction(() => window.__duck?.ready, null, {
    timeout: 120000,
  });
  await page.getByRole("button", { name: "打开菜单", exact: true }).click();
  await page.locator("#tab-library").click();
  await page
    .locator("#model-file")
    .setInputFiles({
      name: "broken.onnx",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("invalid model"),
    });
  await page.locator("#import-submit").click();
  await page.waitForFunction(
    () => !document.querySelector("#import-submit").disabled,
  );
  out.invalid = await page
    .locator("#import-feedback")
    .getAttribute("data-error");
  assert.equal(out.invalid, "true");
  assert.equal(await page.locator(".policy-item").count(), 0);
  await page.locator("#model-file").setInputFiles([]);
  await page.locator("#hub-repo").fill("fffiloni/microduck-polite-bow-b1d864");
  await page.locator("#import-submit").click();
  await page.waitForFunction(
    () => !document.querySelector("#import-submit").disabled,
    null,
    { timeout: 120000 },
  );
  out.hub = await page.locator("#import-feedback").innerText();
  console.log("Hub:", out.hub);
  if (!out.hub.startsWith("已导入")) {
    await page.locator("#model-file").setInputFiles("qa-output/bow.onnx");
    await page.locator("#import-submit").click();
    await page.waitForFunction(
      () => !document.querySelector("#import-submit").disabled,
      null,
      { timeout: 120000 },
    );
    out.local = await page.locator("#import-feedback").innerText();
    console.log("Local:", out.local);
    assert.ok(out.local.startsWith("已导入"));
  }
  assert.equal(await page.locator(".policy-item").count(), 1);
  const before = await page.evaluate(() => window.__duck.state.position);
  await page.getByRole("button", { name: "执行动作", exact: true }).click();
  await page.waitForTimeout(1100);
  out.during = await page.evaluate(() => ({
    position: window.__duck.state.position,
    label: window.__duck.state.label,
    busy: window.__duck.state.busy,
  }));
  assert.equal(out.during.busy, true);
  await page.waitForTimeout(5000);
  out.after = await page.evaluate(() => ({
    position: window.__duck.state.position,
    fallen: window.__duck.state.fallen,
    busy: window.__duck.state.busy,
  }));
  assert.equal(out.after.busy, false);
  assert.equal(out.after.fallen, false);
  await page.screenshot({ path: "docs/images/community.png" });
  await page.reload();
  await page.waitForFunction(() => window.__duck?.ready, null, {
    timeout: 120000,
  });
  out.saved = await page.evaluate(() => window.__duck.policies);
  assert.equal(out.saved.length, 1);
  await page.getByRole("button", { name: "打开菜单", exact: true }).click();
  await page.locator("#tab-library").click();
  await page.getByRole("button", { name: /^移除 / }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".policy-item").length === 0,
  );
  await page.reload();
  await page.waitForFunction(() => window.__duck?.ready, null, {
    timeout: 120000,
  });
  assert.equal(await page.evaluate(() => window.__duck.policies.length), 0);
  await page.getByRole("button", { name: "打开菜单", exact: true }).click();
  await page.locator("#tab-library").click();
  await page.locator("#model-file").setInputFiles("qa-output/bow.onnx");
  await page.locator("#import-submit").click();
  await page.waitForFunction(
    () => !document.querySelector("#import-submit").disabled,
    null,
    { timeout: 120000 },
  );
  out.local = await page.locator("#import-feedback").innerText();
  assert.ok(out.local.startsWith("已导入"));
  assert.equal(await page.locator(".policy-item").count(), 1);
  console.log(
    "PASS invalid rejection, hub/local import, execute, persistence, delete",
  );
} finally {
  await writeFile("qa-output/import.json", JSON.stringify(out, null, 2));
  await browser.close();
}
