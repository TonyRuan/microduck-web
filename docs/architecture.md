# 架构与移植边界

## 运行链路

DOM / 键盘 / 摇杆 → 每 50 ms 发送移动意图 → Worker → TypeScript 控制器 → ONNX Runtime WASM → 关节位置目标 → MuJoCo 四个 5 ms 步 → 几何世界坐标 → Three.js。

相机与 UI 不决定机器人位置。球的运动来自 MuJoCo 接触力。单线程 WASM Worker 通过可转移 ArrayBuffer 发送姿态，不依赖 SharedArrayBuffer、COOP / COEP 或后端。启动时加载官方资源，按 `public/assets-manifest.json` 的 SHA-256 校验。

## 对应原工程

`reference/control.rs` 与 `reference/obs.rs` 是 TypeScript 控制和观测布局的来源；`reference/engine.cpp` 是 Android 仿真接线参考。源工程版本 `55ce6009d7c8f2d34f494c05679d6bdab4eede0e`，见第三方出处。

保持：HOME 关节角、嘴关节排除、原始上一帧动作回灌、gyro / projected gravity / joint position / joint velocity / commands、0.2 移动指令滤波、头 0.5 / 腿 0.7 目标滤波、0.9 默认动作缩放、200 默认增益与独立站立时 160 增益、坐起标志、捡拾相位和原动作窗口。

差异：运控逻辑用 TypeScript 重写；MuJoCo 是 npm 官方 3.13.0，而 Android 是 3.3.7。ONNX Runtime 替代固定结构 `.duckmlp` 推理，允许导入新网络。页面不暴露真机协议、摄像头或硬件电压补偿。泛化策略兼容性见模型导入规范。

## 状态与生命周期

- Worker 串行处理策略加载、动作、重置、切换步态，避免推理过程释放会话。
- `reset` 清空关节滤波、上一帧动作、技能计时及 LSTM 状态；策略切换和重复启动新动作同样重置相应隐藏状态。
- 250 ms 没有新移动输入就归零。失焦、松手、指针取消、模式切换与菜单打开均清空输入。
- 后台暂停物理，恢复前台仍从零移动开始。暂停保存用户意图，不会被后台 / 前台转换取消。
- 倾斜超限且不是活动技能窗口时，持续 0.8 模拟秒判倒地并减小关节增益，等待重置。
- 控制周期基于模拟时间；若设备处理不过来，减慢模拟，不跳大步长追赶。页面 Hz 是实际每秒推进的控制次数。

## 存储与发布

设置存 localStorage，导入模型及解析后的清单存 IndexedDB。同源站点重新打开后恢复；清站点数据后删除。HF 导入锁定 API 返回的提交 SHA，记录模型 SHA-256，不运行仓库中的 Python / JS。读取本地 ONNX 不上传文件。

Vite 使用相对资源路径。构建脚本依据整个 dist 内容生成缓存版本，预缓存完整产物后激活 SW；离线导航回退至缓存 index。缓存前缀包含部署 scope，只清理本应用旧版本缓存。HTTPS / localhost 启用服务工作线程；普通局域网 HTTP 不具有完整安全上下文，手机调试应使用 adb reverse 或 HTTPS。

已导入的策略不会通过 Service Worker 上网重新下载，直接从 IndexedDB 加载。默认运行资源同源，无外部 CDN。仅主动从 Hugging Face 导入时访问外站。
