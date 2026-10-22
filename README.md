# Microduck Web

[English](README.md) | [简体中文](README.zh-CN.md)

Control Microduck in your browser. The original MJCF / STL robot, MuJoCo physics, and ONNX locomotion policies all run locally. The app can be deployed as a fully static site.

[Live demo](https://tonyruan.github.io/microduck-web/) · [GitHub repository](https://github.com/TonyRuan/microduck-web)

![Desktop keyboard interface](docs/images/desktop.png)

## Getting started

Requires Node.js 22.12+ (or 20.19+). Run these commands from this standalone project's directory:

```sh
npm ci
npm run dev
```

Open the local URL shown in the terminal. The first load downloads the robot, eight built-in policies, and the WASM engine. The current deployment directory is about 74 MiB uncompressed; enable gzip / Brotli on your static host. Serve the app over HTTP(S): opening `index.html` directly will not support its Worker, resource requests, and modules.

```sh
npm run build
npm run preview
```

`dist/` contains the complete static deployment. No Node server, Python server, login, or remote inference is needed. Use HTTPS in production; `localhost` works for local testing. Deployment under a subdirectory, such as `/microduck/`, is supported. The build includes offline caching: after the first successful load and completion of background caching, the app can be reopened without a network connection. Clearing the browser's site data removes the cache and imported models.

## GitHub Pages deployment

The repository uses `.github/workflows/pages.yml` to test, build, and deploy `dist/` automatically. Every push to the default branch, `codex/static-web`, triggers deployment. You can also run Deploy Microduck Web manually in Actions. Set the Pages build source to GitHub Actions. The production URL is https://tonyruan.github.io/microduck-web/ .

## Controls

The interface supports English and Simplified Chinese. On first use it follows your browser's preferred language: `zh` variants use Chinese, and other languages use English. In Menu → Controls → Language, choose Follow browser, English, or 中文. Explicit choices are saved locally and take priority over browser detection; choose Follow browser to restore automatic selection. Switching updates the interface immediately without reloading or resetting the simulation, policies, or robot. If browser storage is blocked, language switching still works for the current session.

Mobile browsers show a translucent joystick and action buttons by default; desktop browsers use the keyboard. The menu lets you choose Auto / Touch / Keyboard, and saves your choice. Default command speeds are **0.4 m/s** forward, **0.4 m/s** backward, and **1.0 rad/s** turning. These are policy commands; actual motion depends on the physics state and policy.

| Action                                    | Desktop                          | Mobile                                    |
| ----------------------------------------- | -------------------------------- | ----------------------------------------- |
| Move forward/backward and turn left/right | WASD / arrow keys                | Left joystick                             |
| Sit down / stand up                       | C                                | Sit/stand button                          |
| Roll                                      | R                                | Roll button                               |
| Left / right kick                         | Q / E                            | Left / right kick buttons                 |
| Pick up                                   | F                                | Pick-up button                            |
| Place the ball in front of the right foot | B                                | Place-ball button                         |
| Pause / resume                            | P / menu                         | Menu                                      |
| Stop walking                              | Space / top stop button          | Top stop button                           |
| Reset camera                              | 0 / crosshair                    | Crosshair                                 |
| Orbit / pan / zoom                        | Drag / right-drag / scroll wheel | One-finger drag / two-finger drag / pinch |

The menu also provides ball placement in front of either foot, speed, gait, follow camera, scene reset, restore defaults, and the action library. The ball responds to physical contact forces; place it in front of the appropriate foot before kicking. Stop clears movement commands while allowing an action already in progress to finish; Pause freezes the simulation immediately. Losing focus, changing input modes, or releasing the joystick clears movement commands. Moving the app to the background pauses it.

<p align="center"><img src="docs/images/mobile.png" width="300" alt="Touch interface"> <img src="docs/images/menu.png" width="540" alt="Expanded settings"></p>

## Importing community actions

Open Menu → Action library. Select a local `.onnx` file and `manifest.json`, or enter a public Hugging Face model repository as `author/repository`. The app checks the inputs and outputs and runs a trial inference. Successful imports are saved in the browser's IndexedDB; no source changes or rebuild are needed.

- One-shot actions add an Execute action control. Gait, standing, sit/stand, and pick-up policies can be assigned to their corresponding controls.
- Without a manifest, expand the additional action information section and enter the name, purpose, and duration manually. These settings also apply to online repositories without a manifest; the app cannot infer an action's meaning from its weights.
- Compatible MLP and explicit-hidden-state LSTM ONNX models are supported. Not every RL checkpoint can be used directly; export `.pt` files to ONNX in the training project.
- See the [model import specification](docs/policy-import.md) for interfaces, sustained poses, custom commands, limitations, and examples.

The public community model [fffiloni/microduck-polite-bow-b1d864](https://huggingface.co/fffiloni/microduck-polite-bow-b1d864) has been tested for download, import, bow execution, restoration after refresh, and removal. This repository has no manifest; the test used a one-shot action with a duration of 4 seconds. The model version was pinned to its commit SHA at download time.

![Community action import](docs/images/community.png)

## Technology and validation

TypeScript / Vite, Three.js, MuJoCo 3.13.0 WASM, and ONNX Runtime Web 1.30.0. Control runs at 50 Hz, advancing four 5 ms physics steps per control step. Physics and inference run in a Worker; the main thread handles input and rendering. Simulation time slows down on devices with insufficient performance, and the page displays the measured control frequency.

The controller is ported from the original project's Rust control logic, preserving the 61-dimensional observations, 14-dimensional actions, joint order, HOME, filtering, skill timing, and gain switching. It does not run the Android Rust static library directly, and the Web MuJoCo version differs from Android's 3.3.7. See the [architecture](docs/architecture.md) and [third-party notices](THIRD_PARTY_NOTICES.md) for implementation details and sources.

```sh
npm test                    # Real WASM / ONNX + controller contract tests
npm run test:browser        # Chrome desktop, touch, actions, camera, and settings persistence
npm run test:i18n           # Browser languages, saved preferences, live switching, and mobile layout
node scripts/qa-import.mjs  # Real community repository import regression; requires network access
node scripts/qa-static.mjs  # Production subdirectory, offline cache, and mobile two-finger gestures
```

Browser scripts use Google Chrome installed on macOS by default. Set `CHROME_PATH` to another Chrome / Chromium executable and `QA_URL` to the site to test. Browser tests generate `qa-output/` and the README screenshots. See the [validation record](docs/validation.md) for test details and reproduction steps.

The original RL policies have stability limits: repeated actions, collisions, and a tilted starting pose can cause falls. By default, the app does not force the duck upright with an animation; reset it in the menu after a fall. This is a local simulator; it does not connect to or control a physical robot.

## Project layout

```text
src/input/        Browser and touch input
src/simulation/   Controller, MuJoCo, Worker, and communication
src/policies/     ONNX, import validation, and IndexedDB
src/render/       Three.js rendering of the actual physics geometry
public/           Original model, eight policies, and resource hashes
reference/        Snapshots of the original controller and interface documentation
scripts/          Build, caching, and browser validation
```

This is a separate Git repository from the original Microduck and Android projects. Licensed under Apache-2.0; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the sources of third-party code, robot assets, and models. This project is an unofficial port and does not represent an official Pollen Robotics product.
