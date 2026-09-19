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
for (const profile of ["velstand", "alpha"])
  for (const duration of [1, 1.2, 1.5, 2])
    for (const scale of [0.9, 1]) {
      physics.reset(profile);
      for (let i = 0; i < 150; i++) await physics.tick(0, 0);
      defs.get("roll")!.duration = duration;
      defs.get("roll")!.actionScale = scale;
      controller.trigger("roll");
      for (let i = 0; i < 250; i++) await physics.tick(0, 0);
      const r = {
        profile,
        duration,
        scale,
        fallen: physics.fallen,
        z: physics.data.qpos[2],
        gravity: physics.sensors().gravity,
      };
      results.push(r);
      console.log(r);
    }
await writeFile("qa-output/roll-sweep.json", JSON.stringify(results, null, 2));
for (const p of runners.values()) await p.dispose();
