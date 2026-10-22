// Chinese source messages are the catalog keys (gettext style). Keep placeholders
// in both languages; user-supplied names and descriptions are never translated.
export const english = {
  "{0} · {1}": "{0} · {1}",
  "语言 / Language": "Language / 语言",
  跟随浏览器: "Follow browser",
  "切换语言立即生效，不会重置仿真。":
    "Language changes apply immediately without resetting the simulation.",
  "Microduck · 浏览器里的机器人": "Microduck · A robot in your browser",
  "在浏览器里操控 Microduck。真实物理仿真，离线运控，导入社区新动作。":
    "Control Microduck in your browser with real physics, offline control, and community actions.",
  浏览器里的机器人: "A robot in your browser",
  准备启动: "Getting ready",
  停止: "Stop",
  让小鸭子站起来: "Getting Microduck on its feet",
  "载入本地物理世界…": "Loading the local physics world…",
  "首次打开需要下载模型，之后可使用缓存":
    "Models download on first use and can be cached for later",
  重新加载: "Reload",
  "行走 / 转向": "Move / turn",
  坐下: "Sit down",
  站起: "Stand up",
  站立: "Standing",
  行走: "Walking",
  翻滚: "Roll",
  左踢: "Left kick",
  右踢: "Right kick",
  捡拾: "Pick up",
  放球: "Place ball",
  坐起: "Sit / stand",
  踢球: "Kick",
  空格: "Space",
  本地物理仿真: "Local physics simulation",
  "拖动旋转 · 右键平移 · 滚轮缩放":
    "Drag to orbit · Right-drag to pan · Scroll to zoom",
  "单指旋转 · 双指缩放 / 平移":
    "One finger to orbit · Two fingers to zoom / pan",
  "你的鸭子，你来控制": "Your duck, your controls",
  "调整手感，或教它一个新动作。": "Adjust the controls or try a new action.",
  操控设置: "Controls",
  动作库: "Action library",
  控制界面: "Input mode",
  自动识别设备: "Detect device automatically",
  触屏摇杆: "Touch joystick",
  键盘控制: "Keyboard",
  前进速度: "Forward speed",
  后退速度: "Backward speed",
  转向速度: "Turning speed",
  "这里设置的是指令速度。低速时，鸭子可能原地踏步。":
    "These are commanded speeds. At low speeds the duck may step in place.",
  行走步态: "Walking gait",
  "默认步态 · velstand": "Default gait · velstand",
  "独立站立 + Alpha 行走": "Separate standing + Alpha walking",
  视角跟随鸭子: "Follow the duck",
  暂停仿真: "Pause simulation",
  继续仿真: "Resume simulation",
  重置鸭子与场景: "Reset duck and scene",
  放球到左脚前: "Ball at left foot",
  放球到右脚前: "Ball at right foot",
  恢复默认设置与策略: "Restore default settings and policies",
  全部快捷键: "All keyboard shortcuts",
  "W / ↑ 前进 · S / ↓ 后退": "W / ↑ Forward · S / ↓ Backward",
  "A / ← 左转 · D / → 右转": "A / ← Turn left · D / → Turn right",
  "C 坐起 · R 翻滚 · Q / E 左右踢":
    "C Sit / stand · R Roll · Q / E Left / right kick",
  "F 捡拾 · B 放球到右脚前 · P 暂停 / 继续":
    "F Pick up · B Ball at right foot · P Pause / resume",
  "空格 停止行走 · 0 恢复视角": "Space Stop walking · 0 Reset camera",
  "Esc 关闭菜单": "Esc Close menu",
  "停止只清空行走指令；正在执行的动作会完成。需要立即冻结世界时，使用暂停仿真。":
    "Stop clears walking commands; an action already in progress will finish. Use Pause simulation to freeze the world immediately.",
  给它一个新本领: "Try a new skill",
  "导入兼容的 Microduck 策略，在浏览器里试一试。":
    "Import a compatible Microduck policy and try it in your browser.",
  "Hugging Face 公开模型仓库": "Public Hugging Face model repository",
  或者选择本地文件: "Or select local files",
  "ONNX 模型": "ONNX model",
  动作清单: "Action manifest",
  "没有清单？补充动作信息": "No manifest? Enter action details",
  动作名称: "Action name",
  用途: "Purpose",
  一次性动作: "One-shot action",
  站立策略: "Standing policy",
  坐起策略: "Sit / stand policy",
  捡拾策略: "Pick-up policy",
  "执行 / 保持时长（秒）": "Action / hold duration (seconds)",
  检查并导入: "Check and import",
  "计算在本机完成，本地模型不会上传。训练 checkpoint 请先导出 ONNX。":
    "Computation stays on your device; local models are not uploaded. Export training checkpoints to ONNX first.",
  已导入: "Imported",
  "0 个动作": "0 actions",
  "新的本领会出现在这里。": "Imported skills will appear here.",
  内置动作: "Built-in actions",
  "Microduck Web · 本地运控 / MuJoCo": "Microduck Web · Local control / MuJoCo",
  "模型与策略来自 Pollen Robotics": "Models and policies by Pollen Robotics",
  生产版支持离线缓存: "Production builds support offline caching",
  "3D 鸭子场景，拖动旋转，双指或右键平移，滚轮或捏合缩放":
    "3D duck scene: drag to orbit, two-finger or right-drag to pan, scroll or pinch to zoom",
  场景工具: "Scene controls",
  恢复默认视角: "Reset camera",
  "恢复视角 · 0": "Reset camera · 0",
  打开菜单: "Open menu",
  关闭菜单: "Close menu",
  "行走摇杆：上前进，下后退，左右转向":
    "Walking joystick: up to move forward, down to move backward, left or right to turn",
  键盘控制提示: "Keyboard controls",
  控制与动作菜单: "Settings and action menu",
  "作者 / microduck-bow": "author / microduck-bow",
  "例如：鞠躬": "For example: Bow",
  "浏览器没有允许保存设置，本次仍可使用":
    "Settings could not be saved in this browser. You can still use them for this session.",
  "行走已停止 · 已触发的动作会完成":
    "Walking stopped · An action already started will finish",
  坐起切换: "Switching sit / stand",
  动作已启动: "Action started",
  "当前使用{0}，可以手动切换。":
    "Currently using {0}. You can switch manually.",
  鸭子与场景已重置: "Duck and scene reset",
  "已恢复默认策略、速度和控制方式；导入文件仍保留在动作库":
    "Default policies, speeds, and controls restored. Imported files remain in the action library.",
  "{0} 个策略": "{0} policies",
  "{0} 秒": "{0} seconds",
  应用策略: "Apply policy",
  执行动作: "Run action",
  "已应用 {0}": "Applied {0}",
  移除: "Remove",
  "移除 {0}": "Remove {0}",
  "本次已移除，但浏览器未能更新保存记录":
    "Removed for this session, but the browser could not update the saved record",
  "已移除 {0}": "Removed {0}",
  "正在检查模型与动作清单…": "Checking the model and action manifest…",
  "保持时长应在 0–60 秒之间":
    "Hold duration must be greater than 0 and at most 60 seconds",
  "单个模型限 32 MB": "Each model is limited to 32 MB",
  "请选择导出的 .onnx 文件": "Select an exported .onnx file",
  动作清单过大: "The action manifest is too large",
  "本地文件 · {0}": "Local file · {0}",
  "请选择 ONNX 文件或填写公开模型仓库":
    "Select an ONNX file or enter a public model repository",
  "接口检查与试推理中…": "Checking interfaces and running trial inference…",
  "策略已载入，但浏览器未允许持久保存；关闭网页后需重新导入":
    "Policy loaded, but persistent storage is unavailable. Import it again after closing the page.",
  "已导入「{0}」。可在下方试运行，或应用为步态。":
    "Imported “{0}”. Run it below or apply it as a gait.",
  新本领已加入动作库: "New skill added to the action library",
  "导入失败，请检查模型文件": "Import failed. Check the model file.",
  "已倒地 · 菜单中重置": "Fallen · Reset in the menu",
  仿真已暂停: "Simulation paused",
  "本地运行  {0} Hz": "Running locally  {0} Hz",
  "保存的「{0}」未能载入，请重新导入":
    "Could not load saved policy “{0}”. Import it again.",
  "浏览器存储不可用，本次仍可操控和导入":
    "Browser storage is unavailable. Controls and imports still work for this session.",
  "正在准备离线资源…": "Preparing offline assets…",
  离线资源已就绪: "Offline assets ready",
  "离线缓存未完成，当前仍可在线使用":
    "Offline caching did not finish. You can still use the app online.",
  "启动失败：{0}": "Startup failed: {0}",
  "下载失败 ({0})；可以下载文件后使用本地导入":
    "Download failed ({0}). You can download the files and import them locally.",
  文件超出大小限制: "File exceeds the size limit",
  "请输入 Hugging Face 模型仓库，如 作者/microduck-bow":
    "Enter a Hugging Face model repository, such as author/microduck-bow",
  "未找到公开模型仓库；也可以使用本地文件导入":
    "Public model repository not found. You can also import local files.",
  无法确认模型版本: "Could not verify the model revision",
  "仓库未提供 manifest.json，使用手动填写的动作信息。":
    "No manifest.json was provided; using the manually entered action details.",
  "该仓库包含多个策略；请下载需要的 ONNX 及单个策略清单后导入":
    "This repository contains multiple policies. Download the desired ONNX file and its individual manifest, then import them locally.",
  "参数应在 {0}–{1} 之间": "Parameter must be between {0} and {1}",
  动作指令必须是三个有限数值:
    "An action command must contain three finite numbers",
  "动作清单必须是 JSON 对象": "The action manifest must be a JSON object",
  "这是策略合集，请选择其中单个策略及对应清单":
    "This is a policy collection. Select one policy and its corresponding manifest.",
  "观测不兼容：需要 61 维，收到 {0}":
    "Incompatible observations: expected 61 dimensions, received {0}",
  "关节动作不兼容：需要 14 维":
    "Incompatible joint actions: expected 14 dimensions",
  "这份策略不是为 Microduck 训练的":
    "This policy was not trained for Microduck",
  "当前物理模型是足式 Microduck，不含轮式模型":
    "The current physics model is a legged Microduck; wheeled models are not included",
  暂不支持这份策略的指令编码:
    "This policy's command encoding is not supported yet",
  无法识别策略类型: "Unknown policy kind",
  无法识别该策略用途: "Unknown policy purpose",
  指令编码与策略用途不匹配:
    "Command encoding does not match the policy purpose",
  该脚本式动作需要额外的控制逻辑:
    "This scripted action requires additional control logic",
  "持续姿态需要清单中的 unwind_s 才能正确退出":
    "A sustained pose requires unwind_s in the manifest to exit correctly",
  "无法识别 twist 指令": "Unknown twist command",
  "当前控制周期为 50 Hz，该策略需要不同控制频率":
    "The controller runs at 50 Hz; this policy requires a different control frequency",
  "坐起策略需要 twist 第一项使用坐下 1 / 站起 0":
    "Sit / stand policies require the first twist component to use 1 for sitting and 0 for standing",
  "本地导入的 Microduck 策略": "Locally imported Microduck policy",
  "Pollen Robotics 官方 v5 策略": "Official Pollen Robotics v5 policy",
  默认步态: "Default gait",
  "Alpha 行走": "Alpha walking",
  独立站立: "Separate standing",
  "坐下 / 站起": "Sit down / stand up",
  "单个模型限 32 MB，以控制浏览器内存占用":
    "Each model is limited to 32 MB to keep browser memory use manageable",
  "ONNX 无法加载：请确认文件完整、已正确导出，并使用浏览器支持的算子。":
    "Could not load ONNX. Check that the file is complete, correctly exported, and uses operators supported in the browser.",
  "模型接口需要 float32 obs[1,61] → actions[1,14]":
    "The model interface must be float32 obs[1,61] → actions[1,14]",
  "LSTM 隐藏状态接口不兼容": "Incompatible LSTM hidden-state interface",
  "LSTM 状态大小不兼容": "Incompatible LSTM state size",
  "LSTM 状态维度不一致": "LSTM state dimensions do not match",
  "该模型依赖额外传感器或自定义状态，暂不能直接运行":
    "This model requires additional sensors or custom state and cannot run directly yet",
  策略输出维度不正确: "Incorrect policy output dimensions",
  策略输出含非有限数值: "Policy output contains non-finite values",
  "LSTM 返回无效隐藏状态": "LSTM returned an invalid hidden state",
  浏览器存储不可用: "Browser storage is unavailable",
  "图形上下文暂时丢失，正在等待浏览器恢复":
    "Graphics context lost. Waiting for the browser to restore it.",
  "图形已恢复，可在菜单继续仿真":
    "Graphics restored. Resume the simulation in the menu.",
  浏览器未能启动仿真线程: "The browser could not start the simulation worker",
  仿真已关闭: "Simulation closed",
  请等待当前动作完成: "Wait for the current action to finish",
  请先让鸭子站起: "Have the duck stand up first",
  动作尚未加载: "The action has not loaded yet",
  "{0} · 收尾": "{0} · Finishing",
  "策略未加载：{0}": "Policy not loaded: {0}",
  策略返回了无效关节目标: "The policy returned invalid joint targets",
  "模型缺少关节 {0}": "The model is missing joint {0}",
  "缺少自由关节 {0}": "Missing free joint {0}",
  "物理状态无效，请重置场景": "Invalid physics state. Reset the scene.",
  "资源下载失败：{0}": "Asset download failed: {0}",
  "资源校验失败：{0}": "Asset integrity check failed: {0}",
  "正在载入物理引擎…": "Loading the physics engine…",
  资源清单下载失败: "Asset manifest download failed",
  "正在校验机器人与策略…": "Verifying the robot and policies…",
  "正在准备 {0}": "Preparing {0}",
  选择的步态尚未加载: "The selected gait has not loaded yet",
  请先继续仿真或重置鸭子: "Resume the simulation or reset the duck first",
  导入动作标识不正确: "Invalid imported action ID",
  默认动作不能删除: "Built-in actions cannot be removed",
  请等动作完成后再删除: "Wait for the action to finish before removing it",
  无法识别的操作: "Unknown operation",
  "仿真已暂停：{0}": "Simulation paused: {0}",
  模型还在加载: "Models are still loading",
  "操作失败：{0}": "Operation failed: {0}",
  "动作清单不是有效的 JSON。": "The action manifest is not valid JSON.",
  "网络请求失败，请检查连接后重试。":
    "Network request failed. Check your connection and try again.",
  选择文件: "Choose file",
  未选择文件: "No file selected",
} as const;
export type MessageKey = keyof typeof english;
