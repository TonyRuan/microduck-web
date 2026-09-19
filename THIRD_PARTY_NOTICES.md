# Third-party sources and modifications

This is an independent port, not an official Pollen Robotics product.

| Component | Source / license | Included use |
| --- | --- | --- |
| Microduck control / observation reference | [TonyRuan/microduck-imx6ull](https://github.com/TonyRuan/microduck-imx6ull/tree/55ce6009d7c8f2d34f494c05679d6bdab4eede0e), derived from [pollen-robotics/microduck](https://github.com/pollen-robotics/microduck), Apache-2.0 | Rust reference snapshots; TypeScript port; recurrent test fixture |
| Robot XML / STL | [pollen-robotics/microduck_rl](https://github.com/pollen-robotics/microduck_rl), Apache-2.0 | Original local Android-port simulation assets; scene adds a physical ball |
| Eight foot-mode ONNX policies | [pollen-robotics/microduck-policies](https://huggingface.co/pollen-robotics/microduck-policies/tree/v5) | Apache-2.0 (publisher model card); v5 model files, unchanged; hashes in public/assets-manifest.json |
| MuJoCo | [google-deepmind/mujoco](https://github.com/google-deepmind/mujoco), Apache-2.0 | Official @mujoco/mujoco 3.13.0 WASM |
| ONNX Runtime | [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime), MIT | onnxruntime-web 1.30.0 WASM; upstream third-party notices apply |
| Three.js | [mrdoob/three.js](https://github.com/mrdoob/three.js), MIT | Three.js 0.186.0 and OrbitControls |

Robot resource license is retained at `public/simulation/LICENSE.txt`. Root `LICENSE` carries Apache-2.0. Runtime license copies are under `licenses/`. Build/test tools remain package dependencies with their respective upstream licenses.

Modifications in this project: browser UI, input model, static packaging, TypeScript controller port, Worker bridge, rendering, ONNX validation/import, IndexedDB persistence, cache generation, tests and documentation. The original source snapshots under `reference/` are unmodified comparison material, not the browser runtime. New code is Apache-2.0.

The downloaded community bow model is used only for QA and is not bundled. User-imported models retain the original publisher's licensing and provenance; importing a model does not change its license.
