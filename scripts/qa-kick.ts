import * as ort from "onnxruntime-web/wasm";
import loadMujoco from "@mujoco/mujoco";
import { readFile, writeFile } from "node:fs/promises";
import { Controller } from "../src/simulation/controller";
import { Physics } from "../src/simulation/physics";
import { BUILTINS } from "../src/policies/manifest";
import { OnnxPolicy } from "../src/policies/runtime";
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmBinary = new Uint8Array(
  await readFile("public/runtime/ort-wasm-simd-threaded.wasm"),
);
const mj = await loadMujoco();
mj.FS.mkdir("/simulation");
mj.FS.mkdir("/simulation/assets");
const manifest = JSON.parse(
  await readFile("public/assets-manifest.json", "utf8"),
);
for (const file of Object.keys(manifest.files))
  if (file.startsWith("simulation/"))
    mj.FS.writeFile("/" + file, await readFile("public/" + file));
const defs = new Map(BUILTINS.map((d) => [d.id, { ...d }]));
const runners = new Map();
for (const d of BUILTINS) {
  const b = await readFile("public/policies/" + d.file);
  runners.set(
    d.id,
    await OnnxPolicy.load(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    ),
  );
}
const controller = new Controller(defs, runners);
const physics = new Physics(mj, controller);
const results = [];
for (const x of [0.08, 0.1, 0.12, 0.14, 0.16, 0.18])
  for (const y of [0, -0.045, 0.045])
    for (const id of ["kick-left", "kick-right"]) {
      physics.reset("velstand");
      for (let i = 0; i < 150; i++) await physics.tick(0, 0);
      const q = physics.data.qpos,
        b = physics.ballPos;
      q[b] = q[0] + x;
      q[b + 1] = q[1] + y;
      physics.mj.mj_forward(physics.model, physics.data);
      const start = [q[b], q[b + 1]];
      controller.trigger(id);
      for (let i = 0; i < 100; i++) await physics.tick(0, 0);
      const r = {
        x,
        y,
        id,
        fallen: physics.fallen,
        ballDistance: Math.hypot(q[b] - start[0], q[b + 1] - start[1]),
      };
      results.push(r);
    }
console.log(JSON.stringify(results, null, 2));
await writeFile("qa-output/kick-sweep.json", JSON.stringify(results, null, 2));
for (const p of runners.values()) await p.dispose();
