# 验证记录

## 中英双语回归（2026-10-22）

Windows / Node 24.14.0 / Edge 155（Playwright，软件 WebGL）。`npm test` 包含 11 项测试：原有真实 WASM / ONNX 与八个策略闭环检查，以及语言选择、存储拒绝、消息参数和翻译完整性检查。`npm run build` 检查 TypeScript 并生成静态包与离线缓存。

`npm run test:i18n` 使用仅在 Playwright 中注入的 `ui-worker-stub.mjs`，不下载模型、WASM，不运行运动仿真，并阻止 Service Worker 安装缓存。覆盖首次 `zh-CN` / `zh-TW` / `zh-HK` / `en-US` / `fr-FR`，手动选择、刷新保留、恢复跟随浏览器、`languagechange`、重复切换、模拟的暂停与动作状态、动态错误、JSON 清单错误、导入表单、用户元数据保留，以及 412×915 / 915×412 触屏布局。测试记录 Worker 消息，检查语言切换没有发出重置、暂停、重新初始化或策略修改请求。stub 不进入生产包，生产默认模型加载逻辑不变。

初轮真实模型的语言专项与原有完整浏览器交互回归均通过。随后按 UI 验收范围缩小为上述 stub 检查；不再重跑运动仿真。额外的本地生产静态 / 离线回归未完成：Edge 中首次启动报告 ONNX 加载失败，具体原因未定位，没有据此宣称生产仿真或离线回归通过。

```sh
npm test
npm run build
npm run dev
# 另一个终端；CHROME_PATH 可指向已安装的 Chrome / Chromium / Edge
npm run test:i18n
```

`QA_URL` 可指定带 `?qa` 的本地或线上地址；`QA_OUTPUT_DIR` 可指定截图与 JSON 证据目录，语言测试默认输出到仓库外的 `../i18n-qa/`。已有中文交互脚本显式使用 `zh-CN`，避免测试受执行机默认语言影响。软件 WebGL 和移动端浏览器模拟不代表实体手机或 Safari / Firefox 验证。

## 此前的仿真与交互验证

日期：2026-09-19。环境：macOS ARM64 / Node 26.5.0，Chrome + 官方 MuJoCo 3.13.0 WASM / ORT 1.30.0。脚本运行真实模型与物理；没有用动画或假状态替代控制环。

## 已通过

| 范围 | 验证 |
| --- | --- |
| 6 项 Node 测试 | 61 维观测布局、嘴关节排除、上一帧原始动作、滤波、坐起与相位计时、manifest 契约、真实 LSTM 推进与重置、八个 ONNX 加载与真实物理动作 |
| 两套内置步态 | 默认 velstand 与独立 stand + Alpha 下，从稳定站姿完成翻滚、左右踢、捡拾，退出技能且没有倒地；左右踢实际推动对应脚前的球 |
| 桌面浏览器 | 自动键盘模式、0.4/0.4/1 默认参数、W 移动、松键归零、C 坐起、R/Q/E/F 动作、P 暂停及再次 P 恢复、菜单暂停、模式切换、触屏摇杆、相机滚轮、刷新保留设置 |
| 手机浏览器仿真 | Android UA + coarse touch，412×915 竖屏及 915×412 横屏，自动摇杆，双指捏合与平移，真实触摸事件推动摇杆、松手归零，无水平溢出，手动切换键盘及后退 / 左右转 |
| 社区模型 | Hugging Face 公开仓库真实下载、接口检查和试推理、执行鞠躬、动作结束后保持站立、IndexedDB 刷新恢复、移除后刷新仍不存在、本地 ONNX 文件导入、损坏 ONNX 拒绝且不添加库条目 |
| 纯静态生产版 | Python 仅充当静态文件服务器，部署到 `/microduck/`，首次所有默认资源同源，SW 安装完成后浏览器完全断网、刷新后仍能加载并仿真 |
| 视觉 | 已检查桌面、竖屏、横屏、设置面板与社区导入截图；README 使用实际运行截图 |

浏览器记录在 [validation/](validation/)；运行脚本时完整输出写入被 Git 忽略的 `qa-output/`。该记录是有限样本验证，不是所有状态下稳定性的证明。

## 实测边界与已发现问题

1. 在一次“行走 → 坐下 → 站起 → 翻滚”的连续运行中，翻滚后倒地。随后以原策略参数独立测试，从稳定站姿触发能够完成；不人为修正根部姿态，也不把动作计时完成当作站稳。界面提示倒地，菜单可重置。原生策略、接触、起始姿态及引擎版本都可能影响结果，尚未确定这条连续序列失败的根因。
2. 浏览器并行 QA 时控制频率约 40–45 Hz，低于目标 50 Hz，模拟时间相应减慢。页面展示实测 Hz；这不是实体机器人实时运控验收。单步推理 + 物理在记录样本中约 0.6–1.1 ms，不能将这个数字当成整环时延或硬实时保证。
3. 此轮 ADB 枚举为空，未完成 vivo X100 Pro 或 LG 真机网页验证。Android UA / 触摸仿真不等于该硬件的性能测试。Safari / Firefox 本轮未执行验收。
4. 社区策略通过维度 / 状态接口检查不代表语义与物理表现必然正确。无清单时需要人工选择用途和时长；多模型合集、自定义传感器及非标准控制指令不自动转换。
5. 缓存 / 模型保存依赖浏览器空间与站点数据保留；开发服务器不注册离线缓存。正式 HTTPS 部署或 localhost 才有完整安全上下文。

## 复现

```sh
npm ci
npm test
npm run dev
# 新终端
npm run test:browser
node scripts/qa-import.mjs
```

`qa-import.mjs` 需要网络和 curl，它从固定社区提交下载 QA 样本到 qa-output，不向仓库上传本地模型。

静态 / 离线检查：

```sh
npm run build
mkdir -p /tmp/microduck-web-static
ln -s "$PWD/dist" /tmp/microduck-web-static/microduck
python3 -m http.server 5174 --bind 127.0.0.1 --directory /tmp/microduck-web-static
# 新终端
node scripts/qa-static.mjs
```

自定义地址用 `QA_URL`（保留 `?qa` 以读取只读诊断），Chrome 路径用 `CHROME_PATH`。报告中的截图为浏览器生成，未通过图像生成工具补绘。`qa-physics.ts` 与 `qa-kick.ts` 是排查时的参数扫描脚本，不修改内置策略参数，不作为测试通过断言。
