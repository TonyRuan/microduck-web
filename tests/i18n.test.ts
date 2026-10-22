import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";
import {
  createLanguageSettings,
  LANGUAGE_STORAGE_KEY,
  resolveLanguage,
  msg,
  translate,
  errorMessage,
} from "../src/i18n/core";
import { english, type MessageKey } from "../src/i18n/messages";

test("first preferred browser language selects Chinese for zh variants, English otherwise", () => {
  for (const locale of ["zh", "zh-CN", "zh-TW", "zh-Hant-HK", "ZH-sg"])
    assert.equal(resolveLanguage("auto", [locale, "en"]), "zh-CN");
  for (const locales of [["en-US"], ["fr-FR", "zh-CN"], ["ja"], [], ["zho"]])
    assert.equal(resolveLanguage("auto", locales), "en");
  assert.equal(resolveLanguage("en", ["zh-CN"]), "en");
  assert.equal(resolveLanguage("zh-CN", ["en"]), "zh-CN");
});

test("explicit language survives reload; auto follows changed browser preferences", () => {
  const values = new Map<string, string>();
  const storage = () => ({
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  });
  let languages = ["zh-TW"];
  const settings = createLanguageSettings(storage, () => languages);
  assert.equal(settings.preference, "auto");
  assert.equal(settings.language, "zh-CN");
  assert.equal(settings.setPreference("en"), true);
  assert.equal(createLanguageSettings(storage, () => languages).language, "en");
  settings.setPreference("auto");
  languages = ["fr"];
  assert.equal(settings.language, "en");
  assert.equal(values.get(LANGUAGE_STORAGE_KEY), "auto");
  values.set(LANGUAGE_STORAGE_KEY, "unsupported");
  assert.equal(
    createLanguageSettings(storage, () => ["zh"]).preference,
    "auto",
  );
});

test("blocked reads and writes retain usable session language and safe browser fallback", () => {
  const settings = createLanguageSettings(
    () => {
      throw new Error("blocked");
    },
    () => ["zh"],
  );
  assert.equal(settings.language, "zh-CN");
  assert.equal(settings.setPreference("en"), false);
  assert.equal(settings.language, "en");
  assert.equal(settings.setPreference("auto"), false);
  assert.equal(settings.language, "zh-CN");
});

test("worker messages retain arguments and retranslate instantly; user metadata stays literal", () => {
  const message = msg(
    "仿真已暂停：{0}",
    msg("策略未加载：{0}", "custom-policy"),
  );
  assert.equal(
    translate(message, "en"),
    "Simulation paused: Policy not loaded: custom-policy",
  );
  assert.equal(
    translate(message, "zh-CN"),
    "仿真已暂停：策略未加载：custom-policy",
  );
  assert.equal(translate("我的动作 <b> & $&", "en"), "我的动作 <b> & $&");
  assert.equal(
    translate(msg("已应用 {0}", "$& {0} <script>"), "en"),
    "Applied $& {0} <script>",
  );
  assert.match(
    translate(errorMessage(new SyntaxError("bad")), "en"),
    /not valid JSON/,
  );
  assert.match(
    translate(errorMessage(new TypeError("Failed to fetch")), "zh-CN"),
    /网络请求失败/,
  );
});

test("catalog preserves interpolation contracts and covers every application source message", () => {
  const placeholders = (s: string) =>
    [...s.matchAll(/\{\d+\}/g)].map((x) => x[0]).sort();
  for (const [key, value] of Object.entries(english)) {
    assert.ok(value.length, key);
    assert.deepEqual(placeholders(key), placeholders(value), key);
    assert.ok(
      !translate(msg(key as MessageKey, "a", "b"), "en").includes(
        "@microduck-message:",
      ),
      key,
    );
  }
  function inspect(dir: string) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${item.name}`;
      if (item.isDirectory()) {
        if (item.name !== "i18n") inspect(path);
        continue;
      }
      if (!path.endsWith(".ts")) continue;
      const source = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node: ts.Node) => {
        if (ts.isStringLiteralLike(node) && /[\u4e00-\u9fff]/.test(node.text)) {
          assert.ok(
            ts.isCallExpression(node.parent) &&
              node.parent.expression.getText(source) === "msg" &&
              node.parent.arguments[0] === node,
            `${path}: untranslated literal ${node.text}`,
          );
          assert.ok(
            Object.hasOwn(english, node.text),
            `${path}: missing catalog entry`,
          );
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  inspect("src");
  for (const key of readFileSync("index.html", "utf8").matchAll(
    /data-i18n(?:-[a-z-]+)?="([^"]+)"/g,
  ))
    assert.ok(
      Object.hasOwn(english, key[1]),
      `Missing HTML message: ${key[1]}`,
    );
});
