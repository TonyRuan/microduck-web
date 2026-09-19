import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  worker: { format: "es" },
  optimizeDeps: { exclude: ["@mujoco/mujoco", "onnxruntime-web"] },
  build: { target: "es2022" },
  server: { host: "0.0.0.0" },
});
