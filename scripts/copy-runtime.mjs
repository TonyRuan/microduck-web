import { mkdirSync, copyFileSync } from "node:fs";
mkdirSync("public/runtime", { recursive: true });
for (const f of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"])
  copyFileSync("node_modules/onnxruntime-web/dist/" + f, "public/runtime/" + f);
copyFileSync(
  "node_modules/@mujoco/mujoco/mujoco.wasm",
  "public/runtime/mujoco.wasm",
);
