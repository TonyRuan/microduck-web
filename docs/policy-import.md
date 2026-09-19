# 社区策略导入规范

## ONNX 接口

单个模型不超过 32 MiB，float32 `obs[1,61]` 输入，float32 `actions[1,14]` 输出（单输出允许其他名字）。批次维可以是动态符号；不支持不同机器人、轮式模型、额外传感器、观测历史堆叠或自定义 Python 前后处理。观测布局参照 `reference/obs.rs`。归一化等训练所需变换必须正确导出到图中。

LSTM 支持 `obs, h_in, c_in → actions, h_out, c_out`，四个状态张量形状一致，为 `[layers, 1, hidden]`，float32，每个最多 1,048,576 个元素。隐藏状态随每帧推理更新，重置、动作开始、网络切换时归零。内置测试使用原仓库 LSTM fixture 检查推进与重置，不能据此保证所有循环网络兼容。

网页先检查张量元数据，再实际试推理并拒绝 NaN / Infinity。不凭 schema_version / model_api 号拒绝可运行模型；具体缺失能力会显示错误。接口匹配只说明能够接入，动作的稳定性和语义仍取决于训练内容。

## 清单

支持官方单策略 manifest 的相关字段：name、description、kind、slot、duration_s、action_scale、unwind_s、mode、obs_len、action_len、robot.model / control_hz、command.encoding / idle / period_s / end_phase。约定 50 Hz、足式 Microduck。持续动作的 `duration_s: null` 使用界面填写的保持时间。

```json
{
  "schema_version": 2,
  "model_api": 1,
  "name": "bow",
  "robot": {"model": "microduck", "control_hz": 50},
  "obs_len": 61,
  "action_len": 14,
  "kind": "episodic",
  "duration_s": 4,
  "action_scale": 1,
  "command": {"encoding": "constant", "idle": [0, 0, 0]}
}
```

- `episodic`：运行 duration_s，然后回到行走 / 站立；有 unwind_s 时先执行收尾。
- `perpetual` + slot walk / stand：作为新的行走或站立网络。
- `perpetual` 无 slot：必须有 unwind_s，按界面时长保持，再执行 command.idle 收尾。
- `phase`：捡拾，twist = `[cos(2πphase), sin(2πphase), 0]`，依据 period_s、end_phase 退出。
- `posture_flag`：坐起，第一项 1 坐、0 站；支持这个具体编码，其他标志需要适配。

扩展 `command.active: [x,y,z]` 可指定技能保持时的三维常量指令，也接受数值形式的 command.twist；缺省为全零。官方清单中 twist / head / body 的文字说明仅展示语义，不能从文字自动生成控制逻辑。头部 / 身体指令保留零填充。`chain` 目前不自动循环，每次点击执行一轮；ramp_s、entry_pose、training、eval 作为源清单保留，不实现新的脚本或动作安全保证。

例如需要非零标志的持续单脚站姿，必须由模型作者提供 active、idle、unwind_s；不能把缺少这些信息的网络当作通用零指令动作。可以下载模型并自行提供明确的清单。

## Hugging Face 与本地文件

输入公开 `owner/repo` 或该仓库网页链接。程序获取 SHA、查找根目录唯一 ONNX 和可选 manifest.json，从固定 SHA 下载。多模型仓库 / policies 合集需要先选择单模型及对应单策略清单，通过本地导入使用；不支持私有仓库登录。

没有 manifest 时，使用“补充动作信息”的用途、名称与时长；默认是 4 秒一次性动作，应根据发布者说明修改。仓库网络不可用或 CORS 不允许时，可下载后导入本地文件。

真实验证样本：`fffiloni/microduck-polite-bow-b1d864@9a9d21a85cf7b5cbd1854c03ad58bd949502a5ea`，ONNX SHA-256 `f2f777919cee080d2d172c635d4b6ead14c0e01a7065ac64bd21cc5fad14158c`，无 manifest，使用 4 秒零指令一次性动作。模型下载在本地 QA 临时目录，不作为本项目附带资源再分发。

模型相同 SHA 使用同一个动作库条目；再次导入会更新它的元数据。新增后仍需点击“执行动作”或“应用策略”，不会立刻改变鸭子的行为。
