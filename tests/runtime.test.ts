import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as ort from "onnxruntime-web/wasm";
import loadMujoco from "@mujoco/mujoco";
import { OnnxPolicy } from "../src/policies/runtime";
import { BUILTINS } from "../src/policies/manifest";
import { Controller } from "../src/simulation/controller";
import { Physics } from "../src/simulation/physics";
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmBinary = new Uint8Array(
  await readFile("public/runtime/ort-wasm-simd-threaded.wasm"),
);
async function bytes(p: string) {
  const b = await readFile(p);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
test("real ONNX recurrent state advances and resets deterministically", async () => {
  const p = await OnnxPolicy.load(await bytes("tests/fixtures/lstm.onnx"));
  try {
    const obs = new Float32Array(61);
    obs[5] = -1;
    const a = await p.infer(obs),
      b = await p.infer(obs);
    assert.notDeepEqual(a, b);
    p.reset();
    assert.deepEqual(await p.infer(obs), a);
  } finally {
    await p.dispose();
  }
});
test("real WASM physics and eight policies: walk, sit/rise, nominal skills and ball collision", async () => {
  const mj = await loadMujoco();
  mj.FS.mkdir("/simulation");
  mj.FS.mkdir("/simulation/assets");
  const manifest = JSON.parse(
    await readFile("public/assets-manifest.json", "utf8"),
  );
  for (const f of Object.keys(manifest.files))
    if (f.startsWith("simulation/"))
      mj.FS.writeFile("/" + f, await readFile("public/" + f));
  const defs = new Map(BUILTINS.map((d) => [d.id, d]));
  const runners = new Map<string, OnnxPolicy>();
  for (const d of BUILTINS)
    runners.set(
      d.id,
      await OnnxPolicy.load(await bytes("public/policies/" + d.file)),
    );
  const c = new Controller(defs, runners),
    p = new Physics(mj, c);
  const ticks = async (n: number, vx = 0, yaw = 0) => {
    for (let i = 0; i < n; i++) await p.tick(vx, yaw);
  };
  try {
    await ticks(150);
    const start = p.data.qpos[0];
    await ticks(150, 0.4);
    assert.ok(p.data.qpos[0] - start > 0.15);
    await ticks(60);
    c.trigger("sitstand");
    await ticks(150);
    assert.ok(p.data.qpos[2] < 0.08);
    c.trigger("sitstand");
    await ticks(150);
    assert.ok(p.data.qpos[2] > 0.1);
    for (const profile of ["velstand", "alpha"]) {
      for (const id of ["roll", "kick-left", "kick-right", "pick"]) {
        p.reset(profile);
        await ticks(150);
        if (id.startsWith("kick-"))
          p.ball(id === "kick-left" ? "left" : "right");
        const before = p.data.qpos.slice(p.ballPos, p.ballPos + 2);
        c.trigger(id);
        await ticks(250);
        assert.equal(p.fallen, false, profile + " " + id);
        assert.equal(c.busy, false);
        if (id.startsWith("kick-"))
          assert.ok(
            Math.hypot(
              p.data.qpos[p.ballPos] - before[0],
              p.data.qpos[p.ballPos + 1] - before[1],
            ) > 0.05,
            profile + " " + id + " ball",
          );
      }
    }
    p.paused = true;
    const time = p.data.time;
    await ticks(10, 0.4, 1);
    assert.equal(p.data.time, time);
  } finally {
    for (const r of runners.values()) await r.dispose();
    p.data.delete();
    p.model.delete();
  }
});
