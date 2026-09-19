import loadMujoco from "@mujoco/mujoco";
import { Controller } from "./controller";
import { Physics } from "./physics";
import { OnnxPolicy, configureRuntime } from "../policies/runtime";
import { BUILTINS } from "../policies/manifest";
import type { Request, PolicyDef } from "../types";
const ctx = self as unknown as {
  postMessage: (v: unknown, transfer?: Transferable[]) => void;
  onmessage: ((e: MessageEvent<Request>) => void) | null;
};
const defs = new Map(BUILTINS.map((d) => [d.id, d]));
const runners = new Map<string, OnnxPolicy>();
let physics: Physics;
let controller: Controller;
let vx = 0,
  yaw = 0,
  lastInput = 0,
  base = "",
  hz = 0,
  sample = 0,
  count = 0,
  ready = false;
let userPaused = false,
  background = false,
  profile = "velstand";
const queue: Request[] = [];
let bindings: Record<string, string> = {};
const emit = (type: string, data: Record<string, unknown> = {}) =>
  ctx.postMessage({ type, ...data });
async function checked(path: string, hash: string) {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error("资源下载失败：" + path);
  const bytes = await response.arrayBuffer();
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  if (digest !== hash) throw new Error("资源校验失败：" + path);
  return bytes;
}
function bind() {
  controller.sitPolicy = bindings.sitstand ?? "sitstand";
  controller.pickPolicy = bindings.ground_pick ?? "pick";
  if (bindings.stand) controller.stand = bindings.stand;
}
async function init(url: string) {
  base = url;
  configureRuntime(base);
  emit("loading", { message: "正在载入物理引擎…", progress: 0.03 });
  const mj = await loadMujoco({
    locateFile: (name: string) => base + "runtime/" + name,
    printErr: (message: string) => emit("diagnostic", { message }),
  });
  mj.FS.mkdir("/simulation");
  mj.FS.mkdir("/simulation/assets");
  const res = await fetch(base + "assets-manifest.json");
  if (!res.ok) throw new Error("资源清单下载失败");
  const manifest = await res.json();
  const entries = Object.entries(manifest.files) as [string, string][];
  let done = 0;
  const buffers = new Map<string, ArrayBuffer>();
  // Bound parallelism for mobile networks and visibly report actual completed assets.
  for (let i = 0; i < entries.length; i += 5)
    await Promise.all(
      entries.slice(i, i + 5).map(async ([path, hash]) => {
        const bytes = await checked(path, hash);
        buffers.set(path, bytes);
        if (path.startsWith("simulation/"))
          mj.FS.writeFile("/" + path, new Uint8Array(bytes));
        emit("loading", {
          message: "正在校验机器人与策略…",
          progress: 0.05 + (++done / entries.length) * 0.6,
        });
      }),
    );
  for (let i = 0; i < BUILTINS.length; i++) {
    const def = BUILTINS[i];
    runners.set(
      def.id,
      await OnnxPolicy.load(buffers.get("policies/" + def.file)!),
    );
    emit("loading", {
      message: "正在准备 " + def.name,
      progress: 0.65 + ((i + 1) / BUILTINS.length) * 0.35,
    });
  }
  controller = new Controller(defs, runners);
  physics = new Physics(mj, controller);
  physics.paused = true;
  userPaused = true;
  ready = true;
  sample = performance.now();
  count = 0;
  emit("ready", { world: physics.geometry() });
  void loop();
}
async function command(m: Request) {
  const data = m as any;
  switch (m.type) {
    case "pause":
      userPaused = !!m.value;
      vx = yaw = 0;
      break;
    case "reset":
      profile = String(m.profile ?? profile);
      if (!runners.has(profile)) throw new Error("选择的步态尚未加载");
      physics.reset(profile);
      bind();
      vx = yaw = 0;
      break;
    case "ball":
      physics.ball(m.side === "left" ? "left" : "right");
      vx = yaw = 0;
      break;
    case "action":
      if (physics.paused || physics.fallen)
        throw new Error("请先继续仿真或重置鸭子");
      vx = yaw = 0;
      controller.trigger(String(m.action));
      break;
    case "bindings":
      bindings = data.bindings;
      bind();
      break;
    case "register": {
      const def = data.def as PolicyDef;
      if (!def.id.startsWith("import-")) throw new Error("导入动作标识不正确");
      const next = await OnnxPolicy.load(data.bytes);
      const old = runners.get(def.id);
      runners.set(def.id, next);
      defs.set(def.id, def);
      if (old) await old.dispose();
      break;
    }
    case "remove": {
      const id = String(m.policy);
      if (!id.startsWith("import-")) throw new Error("默认动作不能删除");
      if (controller.busy) throw new Error("请等动作完成后再删除");
      if (profile === id) profile = "velstand";
      for (const slot of Object.keys(bindings))
        if (bindings[slot] === id) delete bindings[slot];
      physics.reset(profile);
      bind();
      const p = runners.get(id);
      runners.delete(id);
      defs.delete(id);
      await p?.dispose();
      break;
    }
    default:
      throw new Error("无法识别的操作");
  }
  physics.paused = userPaused || background;
}
async function loop() {
  const start = performance.now();
  while (queue.length) {
    const m = queue.shift()!;
    try {
      await command(m);
      emit("response", { id: m.id, ok: true });
    } catch (e) {
      emit("response", {
        id: m.id,
        ok: false,
        error: String((e as Error).message ?? e),
      });
    }
  }
  physics.paused = userPaused || background;
  if (start - lastInput > 250 || physics.paused || physics.fallen) {
    vx = 0;
    yaw = 0;
  }
  try {
    await physics.tick(vx, yaw);
  } catch (e) {
    userPaused = true;
    physics.paused = true;
    vx = yaw = 0;
    emit("error", {
      message: "仿真已暂停：" + String((e as Error).message ?? e),
    });
  }
  const now = performance.now();
  if (now - sample >= 1000) {
    hz = ((physics.total - count) * 1000) / (now - sample);
    sample = now;
    count = physics.total;
  }
  const state = physics.snapshot(hz, vx, yaw);
  ctx.postMessage({ type: "state", state }, [
    state.geomPos.buffer,
    state.geomMat.buffer,
  ]);
  setTimeout(() => void loop(), Math.max(0, 20 - (performance.now() - start)));
}
ctx.onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    void init(String(m.base)).catch((e) =>
      emit("error", { message: String(e.message ?? e) }),
    );
    return;
  }
  if (m.type === "move") {
    vx = Number.isFinite(m.vx)
      ? Math.max(-0.4, Math.min(0.4, m.vx as number))
      : 0;
    yaw = Number.isFinite(m.yaw)
      ? Math.max(-1, Math.min(1, m.yaw as number))
      : 0;
    lastInput = performance.now();
    return;
  }
  if (m.type === "visibility") {
    background = !!m.hidden;
    vx = yaw = 0;
    return;
  }
  if (!ready) {
    emit("response", { id: m.id, ok: false, error: "模型还在加载" });
    return;
  }
  queue.push(m);
};
