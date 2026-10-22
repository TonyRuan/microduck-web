import {
  initLanguage,
  text as setText,
  attribute as setAttribute,
} from "./i18n/dom";
import { msg, errorMessage } from "./i18n/core";
import "./style.css";
import {
  DEFAULTS,
  type Settings,
  type Snapshot,
  type SavedPolicy,
} from "./types";
import { SimulationClient } from "./simulation/client";
import { DuckScene } from "./render/scene";
import { Controls, detectedMode } from "./input/controls";
import { BUILTINS } from "./policies/manifest";
import { imported, fromHub } from "./policies/import";
import { listPolicies, savePolicy, deletePolicy } from "./policies/storage";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
initLanguage();
const settings: Settings = { ...DEFAULTS };
let bindings: Record<string, string> = {};
try {
  const saved = JSON.parse(localStorage.getItem("microduck-settings") ?? "{}");
  for (const key of ["forward", "backward", "turn"] as const)
    if (Number.isFinite(saved[key]))
      settings[key] = Math.max(
        0,
        Math.min(key === "turn" ? 1 : 0.4, saved[key]),
      );
  if (["auto", "keyboard", "touch"].includes(saved.mode))
    settings.mode = saved.mode;
  if (typeof saved.follow === "boolean") settings.follow = saved.follow;
  if (typeof saved.profile === "string") settings.profile = saved.profile;
  bindings = saved.bindings ?? {};
} catch {
  /* Storage is optional. */
}
let toastTimer = 0;
function toast(message: string) {
  setText($("toast"), message);
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ($("toast").hidden = true), 4200);
}
const sim = new SimulationClient();
let scene: DuckScene;
let state: Snapshot | undefined;
let ready = false,
  menuOpen = false,
  paused = false,
  importing = false;
const savedPolicies = new Map<string, SavedPolicy>();
function persist() {
  try {
    localStorage.setItem(
      "microduck-settings",
      JSON.stringify({ ...settings, bindings }),
    );
  } catch {
    toast(msg("浏览器没有允许保存设置，本次仍可使用"));
  }
}
async function request(type: string, data: Record<string, unknown> = {}) {
  try {
    await sim.request(type, data);
    return true;
  } catch (e) {
    toast(errorMessage(e));
    return false;
  }
}
async function action(id: string) {
  if (!ready) return;
  controls.clear();
  if (id === "home") {
    scene.home();
    return;
  }
  if (id === "stop") {
    toast(msg("行走已停止 · 已触发的动作会完成"));
    return;
  }
  if (id === "pause") {
    const next = !paused;
    if (await request("pause", { value: next })) {
      paused = next;
      syncPause();
    }
    return;
  }
  if (id === "ball") {
    await request("ball");
    return;
  }
  if (await request("action", { action: id }))
    toast(
      id === "sitstand"
        ? msg("坐起切换")
        : (BUILTINS.find((d) => d.id === id)?.name ??
            savedPolicies.get(id)?.def.name ??
            msg("动作已启动")),
    );
}
const controls = new Controls(
  settings,
  $("joystick"),
  (vx, yaw) => sim.move(vx, yaw),
  (id) => void action(id),
);
controls.setEnabled(false);
function syncPause() {
  setText($("pause-label"), paused ? msg("继续仿真") : msg("暂停仿真"));
  controls.setEnabled(ready && !menuOpen && !paused && !state?.fallen);
}
function syncMode() {
  controls.setMode(settings.mode);
  $("control-mode").setAttribute("data-active", controls.mode);
  setText(
    $("mode-help"),
    msg(
      "当前使用{0}，可以手动切换。",
      controls.mode === "touch" ? msg("触屏摇杆") : msg("键盘控制"),
    ),
  );
  setText(
    $("gesture-hint"),
    controls.mode === "touch"
      ? msg("单指旋转 · 双指缩放 / 平移")
      : msg("拖动旋转 · 右键平移 · 滚轮缩放"),
  );
}
function toggleMenu(open = !menuOpen) {
  menuOpen = open;
  $("menu").hidden = !open;
  document.body.classList.toggle("menu-open", open);
  $("menu-toggle").setAttribute("aria-expanded", String(open));
  controls.clear();
  syncPause();
  if (open) $("menu-close").focus();
  else $("menu-toggle").focus();
}
function tab(which: "controls" | "library") {
  for (const name of ["controls", "library"]) {
    $("tab-" + name).setAttribute("aria-selected", String(name === which));
    $(name === "controls" ? "control-panel" : "library-panel").hidden =
      name !== which;
  }
}
$("tab-controls").onclick = () => tab("controls");
$("tab-library").onclick = () => tab("library");
for (const id of ["model-file", "manifest-file"]) {
  $(id).addEventListener("change", () => {
    const file = $<HTMLInputElement>(id).files?.[0];
    setText($(id + "-name"), file?.name ?? msg("未选择文件"));
  });
}
$("menu-toggle").onclick = () => toggleMenu();
$("menu-close").onclick = () => toggleMenu(false);
$("ball-left").onclick = () => void request("ball", { side: "left" });
$("ball-right").onclick = () => void request("ball", { side: "right" });
$("home").onclick = () => scene?.home();
$("stop").onclick = () => void action("stop");
$("pause").onclick = () => void action("pause");
$("reset").onclick = async () => {
  controls.clear();
  if (await request("reset", { profile: settings.profile })) {
    scene.home();
    toast(msg("鸭子与场景已重置"));
  }
};
document
  .querySelectorAll<HTMLButtonElement>("[data-action]")
  .forEach((b) => (b.onclick = () => void action(b.dataset.action!)));
addEventListener("keydown", (e) => {
  if (e.code === "Escape" && menuOpen) {
    e.preventDefault();
    toggleMenu(false);
  }
});
$("control-mode").addEventListener("change", (e) => {
  settings.mode = (e.target as HTMLSelectElement).value as Settings["mode"];
  syncMode();
  persist();
});
for (const key of ["forward", "backward", "turn"] as const) {
  const input = $<HTMLInputElement>(key);
  input.value = String(settings[key]);
  const update = () => {
    setText(
      $(key + "-value"),
      settings[key].toFixed(2) + (key === "turn" ? " rad/s" : " m/s"),
    );
  };
  update();
  input.addEventListener("input", () => {
    controls.clear();
    settings[key] = Number(input.value);
    update();
    persist();
  });
}
$<HTMLSelectElement>("control-mode").value = settings.mode;
$<HTMLInputElement>("follow").checked = settings.follow;
$("follow").onchange = () => {
  settings.follow = $<HTMLInputElement>("follow").checked;
  scene.follow = settings.follow;
  persist();
};
$("profile").onchange = async () => {
  const profile = $<HTMLSelectElement>("profile").value;
  controls.clear();
  if (await request("reset", { profile })) {
    settings.profile = profile;
    persist();
    scene.home();
  } else $<HTMLSelectElement>("profile").value = settings.profile;
};
$("defaults").onclick = async () => {
  controls.clear();
  bindings = {};
  await request("bindings", { bindings });
  await request("reset", { profile: "velstand" });
  Object.assign(settings, DEFAULTS);
  persist();
  for (const key of ["forward", "backward", "turn"] as const) {
    $<HTMLInputElement>(key).value = String(settings[key]);
    setText(
      $(key + "-value"),
      settings[key].toFixed(2) + (key === "turn" ? " rad/s" : " m/s"),
    );
  }
  $<HTMLSelectElement>("profile").value = "velstand";
  $<HTMLSelectElement>("control-mode").value = "auto";
  $<HTMLInputElement>("follow").checked = true;
  scene.follow = true;
  scene.home();
  syncMode();
  toast(msg("已恢复默认策略、速度和控制方式；导入文件仍保留在动作库"));
};
function renderLibrary() {
  setText($("policy-count"), String(savedPolicies.size));
  setText($("saved-count"), msg("{0} 个策略", savedPolicies.size));
  const list = $("policy-list");
  list.replaceChildren();
  const select = $<HTMLSelectElement>("profile");
  for (const opt of Array.from(select.options))
    if (opt.value.startsWith("import-")) opt.remove();
  if (!savedPolicies.size) {
    const p = document.createElement("p");
    p.className = "empty";
    setText(p, msg("新的本领会出现在这里。"));
    list.append(p);
  }
  for (const p of savedPolicies.values()) {
    const d = p.def,
      item = document.createElement("article");
    item.className = "policy-item";
    item.dataset.policy = d.id;
    const title = document.createElement("h4");
    setText(title, d.name);
    const desc = document.createElement("p");
    setText(desc, d.description);
    const source = document.createElement("p");
    source.className = "source";
    setText(
      source,
      msg(
        "{0} · {1}",
        d.source,
        d.slot
          ? {
              walk: msg("行走步态"),
              stand: msg("站立策略"),
              sitstand: msg("坐起策略"),
              ground_pick: msg("捡拾策略"),
            }[d.slot]
          : msg("{0} 秒", d.duration),
      ),
    );
    const row = document.createElement("div");
    row.className = "policy-actions";
    const run = document.createElement("button");
    setText(run, d.slot ? msg("应用策略") : msg("执行动作"));
    run.onclick = async () => {
      if (d.slot === "walk") {
        if (await request("reset", { profile: d.id })) {
          settings.profile = d.id;
          select.value = d.id;
          persist();
          scene.home();
          toast(msg("已应用 {0}", d.name));
        }
      } else if (d.slot) {
        bindings[d.slot] = d.id;
        if (await request("bindings", { bindings })) {
          await request("reset", { profile: settings.profile });
          persist();
          toast(msg("已应用 {0}", d.name));
        }
      } else await action(d.id);
    };
    const remove = document.createElement("button");
    remove.className = "remove";
    setText(remove, msg("移除"));
    setAttribute(remove, "aria-label", msg("移除 {0}", d.name));
    remove.onclick = async () => {
      if (!(await request("remove", { policy: d.id }))) return;
      try {
        await deletePolicy(d.id);
      } catch {
        toast(msg("本次已移除，但浏览器未能更新保存记录"));
      }
      savedPolicies.delete(d.id);
      if (settings.profile === d.id) settings.profile = "velstand";
      for (const k of Object.keys(bindings))
        if (bindings[k] === d.id) delete bindings[k];
      persist();
      renderLibrary();
      toast(msg("已移除 {0}", d.name));
    };
    row.append(run, remove);
    item.append(title, desc, source, row);
    list.append(item);
    if (d.slot === "walk") select.add(new Option(d.name, d.id));
  }
  select.value = settings.profile;
}
for (const d of BUILTINS.filter((d) => d.kind !== "perpetual")) {
  const b = document.createElement("button");
  setText(b, d.name);
  b.onclick = () => void action(d.id === "pick" ? "pick" : d.id);
  $("builtin-list").append(b);
}
$("import-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (importing || !ready) return;
  importing = true;
  controls.clear();
  $<HTMLButtonElement>("import-submit").disabled = true;
  const feedback = $("import-feedback");
  feedback.dataset.error = "false";
  setText(feedback, msg("正在检查模型与动作清单…"));
  try {
    const hold = Number($<HTMLInputElement>("hold-duration").value);
    if (!Number.isFinite(hold) || hold <= 0 || hold > 60)
      throw new Error(msg("保持时长应在 0–60 秒之间"));
    const kind = $<HTMLSelectElement>("import-kind").value;
    const manual = {
      name: $<HTMLInputElement>("import-name").value.trim(),
      kind: kind === "episodic" ? "episodic" : "perpetual",
      ...(kind === "episodic" ? { duration_s: hold } : { slot: kind }),
    };
    let policy: SavedPolicy;
    const file = $<HTMLInputElement>("model-file").files?.[0];
    if (file) {
      if (file.size > 32 * 1024 * 1024)
        throw new Error(msg("单个模型限 32 MB"));
      if (!file.name.endsWith(".onnx"))
        throw new Error(msg("请选择导出的 .onnx 文件"));
      const mf = $<HTMLInputElement>("manifest-file").files?.[0];
      let manifest: unknown;
      if (mf) {
        if (mf.size > 1024 * 1024) throw new Error(msg("动作清单过大"));
        manifest = JSON.parse(await mf.text());
      } else {
        const kind = $<HTMLSelectElement>("import-kind").value;
        manifest = {
          name:
            $<HTMLInputElement>("import-name").value.trim() ||
            file.name.replace(/\.onnx$/, ""),
          kind: kind === "episodic" ? "episodic" : "perpetual",
          ...(kind === "episodic" ? { duration_s: hold } : { slot: kind }),
        };
      }
      policy = await imported(
        await file.arrayBuffer(),
        manifest,
        file.name.replace(/\.onnx$/, ""),
        msg("本地文件 · {0}", file.name),
        hold,
      );
    } else {
      const repo = $<HTMLInputElement>("hub-repo").value.trim();
      if (!repo) throw new Error(msg("请选择 ONNX 文件或填写公开模型仓库"));
      policy = await fromHub(repo, hold, manual);
    }
    setText(feedback, msg("接口检查与试推理中…"));
    await sim.request("register", { def: policy.def, bytes: policy.bytes });
    try {
      await savePolicy(policy);
    } catch {
      toast(msg("策略已载入，但浏览器未允许持久保存；关闭网页后需重新导入"));
    }
    savedPolicies.set(policy.def.id, policy);
    renderLibrary();
    setText(
      feedback,
      msg("已导入「{0}」。可在下方试运行，或应用为步态。", policy.def.name),
    );
    toast(msg("新本领已加入动作库"));
  } catch (e) {
    feedback.dataset.error = "true";
    setText(feedback, errorMessage(e));
  } finally {
    importing = false;
    $<HTMLButtonElement>("import-submit").disabled = false;
  }
});
function fatal(message: string) {
  toast(message);
  if (!ready) {
    setText($("loading-text"), message);
    $("retry").hidden = false;
  } else {
    paused = true;
    syncPause();
    $("status").dataset.state = "error";
  }
}
$("retry").onclick = () => location.reload();
sim.onError = fatal;
sim.onProgress = (message, p) => {
  setText($("loading-text"), message);
  $<HTMLProgressElement>("load-progress").value = p;
};
let lastText = "";
sim.onState = (s) => {
  state = s;
  scene?.update(s);
  const text = s.fallen
    ? msg("已倒地 · 菜单中重置")
    : s.paused
      ? msg("仿真已暂停")
      : s.busy
        ? s.label
        : msg("本地运行  {0} Hz", s.hz.toFixed(0));
  if (text !== lastText) {
    setText($("status").querySelector("span")!, text);
    lastText = text;
  }
  $("status").dataset.state = s.fallen ? "error" : "ok";
  setText($("sit"), s.seated ? msg("站起") : msg("坐下"));
  setText(
    $("telemetry"),
    `${s.vx >= 0 ? "+" : ""}${s.vx.toFixed(2)} m/s  ·  ${s.yaw >= 0 ? "+" : ""}${s.yaw.toFixed(2)} rad/s`,
  );
  if (s.fallen) {
    controls.clear();
    controls.setEnabled(false);
  } else if (!menuOpen && !paused && ready) controls.setEnabled(true);
};
document.addEventListener("visibilitychange", () => {
  controls.clear();
  sim.visibility(document.hidden);
});
addEventListener("pagehide", () => {
  controls.clear();
  sim.visibility(true);
});
addEventListener("pageshow", () => sim.visibility(document.hidden));
syncMode();
renderLibrary();
async function boot() {
  try {
    scene = new DuckScene($<HTMLCanvasElement>("scene"), (message) => {
      void sim.request("pause", { value: true });
      paused = true;
      syncPause();
      toast(message);
    });
    scene.follow = settings.follow;
    const base = new URL(import.meta.env.BASE_URL, location.href).href;
    const world = await sim.start(base);
    scene.setup(world);
    try {
      for (const p of await listPolicies()) {
        try {
          await sim.request("register", { def: p.def, bytes: p.bytes });
          savedPolicies.set(p.def.id, p);
        } catch {
          toast(msg("保存的「{0}」未能载入，请重新导入", p.def.name));
        }
      }
    } catch {
      toast(msg("浏览器存储不可用，本次仍可操控和导入"));
    }
    if (
      !["velstand", "alpha"].includes(settings.profile) &&
      !savedPolicies.has(settings.profile)
    )
      settings.profile = "velstand";
    for (const k of Object.keys(bindings))
      if (!savedPolicies.has(bindings[k])) delete bindings[k];
    await sim.request("bindings", { bindings });
    await sim.request("reset", { profile: settings.profile });
    await sim.request("pause", { value: false });
    ready = true;
    paused = false;
    renderLibrary();
    syncPause();
    $("loading").hidden = true;
    // Cache only after the first successful boot. It serves files, never computes simulation.
    if ("serviceWorker" in navigator && !import.meta.env.DEV)
      navigator.serviceWorker
        .register(base + "sw.js", { scope: base })
        .then(async () => {
          setText($("offline-status"), msg("正在准备离线资源…"));
          await navigator.serviceWorker.ready;
          setText($("offline-status"), msg("离线资源已就绪"));
        })
        .catch(() => {
          setText($("offline-status"), msg("离线缓存未完成，当前仍可在线使用"));
        });
  } catch (e) {
    fatal(msg("启动失败：{0}", errorMessage(e)));
  }
}
void boot();
// Read-only diagnostics, with richer test access restricted to an explicit local QA URL.
if (new URLSearchParams(location.search).has("qa"))
  (window as any).__duck = {
    get state() {
      return state;
    },
    get mode() {
      return controls.mode;
    },
    get settings() {
      return { ...settings };
    },
    get camera() {
      return {
        distance: scene?.camera.position.distanceTo(scene.controls.target),
        target: scene?.controls.target.toArray(),
        position: scene?.camera.position.toArray(),
      };
    },
    get policies() {
      return Array.from(savedPolicies.values()).map((p) => p.def);
    },
    get ready() {
      return ready;
    },
  };
