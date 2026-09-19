import type { PolicyDef } from "../types";
const finite = (v: unknown, fallback: number, min: number, max: number) => {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new Error(`参数应在 ${min}–${max} 之间`);
  return v;
};
const vector = (v: unknown): [number, number, number] => {
  if (v === undefined) return [0, 0, 0];
  if (
    !Array.isArray(v) ||
    v.length !== 3 ||
    !v.every(
      (x) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 10,
    )
  )
    throw new Error("动作指令必须是三个有限数值");
  return v as [number, number, number];
};
export function parseManifest(
  raw: unknown,
  fallbackName: string,
  source: string,
  hold = 4,
): PolicyDef {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("动作清单必须是 JSON 对象");
  const m = raw as Record<string, any>;
  if (m.policies) throw new Error("这是策略合集，请选择其中单个策略及对应清单");
  if (m.obs_len !== undefined && m.obs_len !== 61)
    throw new Error(`观测不兼容：需要 61 维，收到 ${m.obs_len}`);
  if (m.action_len !== undefined && m.action_len !== 14)
    throw new Error("关节动作不兼容：需要 14 维");
  if (m.robot?.model !== undefined && m.robot.model !== "microduck")
    throw new Error("这份策略不是为 Microduck 训练的");
  if (m.mode !== undefined && m.mode !== "walk")
    throw new Error("当前物理模型是足式 Microduck，不含轮式模型");
  // A version number alone is not a gate. Inspect concrete graph and command capabilities.
  const encoding = m.command?.encoding ?? "constant";
  if (!["constant", "phase", "posture_flag"].includes(encoding))
    throw new Error("暂不支持这份策略的指令编码");
  const kind = m.kind ?? "episodic";
  if (!["episodic", "perpetual", "scripted"].includes(kind))
    throw new Error("无法识别策略类型");
  const slot =
    m.slot ??
    (encoding === "phase"
      ? "ground_pick"
      : encoding === "posture_flag"
        ? "sitstand"
        : undefined);
  if (slot && !["walk", "stand", "ground_pick", "sitstand"].includes(slot))
    throw new Error("无法识别该策略用途");
  if (
    (encoding === "phase" && slot !== "ground_pick") ||
    (encoding === "posture_flag" && slot !== "sitstand")
  )
    throw new Error("指令编码与策略用途不匹配");
  if (kind === "scripted" && encoding !== "posture_flag")
    throw new Error("该脚本式动作需要额外的控制逻辑");
  if (kind === "perpetual" && !slot && m.unwind_s === undefined)
    throw new Error("持续姿态需要清单中的 unwind_s 才能正确退出");
  if (
    m.command?.twist !== undefined &&
    typeof m.command.twist !== "string" &&
    !Array.isArray(m.command.twist)
  )
    throw new Error("无法识别 twist 指令");
  if (m.robot?.control_hz !== undefined && m.robot.control_hz !== 50)
    throw new Error("当前控制周期为 50 Hz，该策略需要不同控制频率");
  if (
    encoding === "posture_flag" &&
    ((m.command.sit !== undefined && m.command.sit !== 1) ||
      (m.command.stand !== undefined && m.command.stand !== 0) ||
      (m.command.slot !== undefined &&
        m.command.slot !== 0 &&
        m.command.slot !== "vx"))
  )
    throw new Error("坐起策略需要 twist 第一项使用坐下 1 / 站起 0");
  const def: PolicyDef = {
    id: "",
    name: String(m.name ?? fallbackName).slice(0, 80),
    description: String(m.description ?? "本地导入的 Microduck 策略").slice(
      0,
      400,
    ),
    source,
    kind,
    slot,
    encoding,
    duration: finite(m.duration_s, hold, 0.02, 60),
    unwind: finite(m.unwind_s, 0, 0, 30),
    period: finite(m.command?.period_s, 4, 0.02, 60),
    endPhase: finite(m.command?.end_phase, 0.7, 0.01, 1),
    actionScale:
      m.action_scale === undefined
        ? undefined
        : finite(m.action_scale, 1, 0.01, 2),
    command: vector(
      m.command?.active ??
        (Array.isArray(m.command?.twist) &&
        m.command.twist.every((x: unknown) => typeof x === "number")
          ? m.command.twist
          : undefined),
    ),
    idle: vector(m.command?.idle),
  };
  if (encoding === "phase") def.duration = def.period * def.endPhase;
  return def;
}
const make = (
  id: string,
  name: string,
  file: string,
  extras: Partial<PolicyDef> = {},
): PolicyDef => ({
  id,
  name,
  file,
  description: "Pollen Robotics 官方 v5 策略",
  source: "pollen-robotics/microduck-policies@v5",
  kind: "episodic",
  encoding: "constant",
  duration: 0.5,
  unwind: 0,
  period: 4,
  endPhase: 0.7,
  command: [0, 0, 0],
  idle: [0, 0, 0],
  ...extras,
});
export const BUILTINS: PolicyDef[] = [
  make("velstand", "默认步态", "velstand.onnx", {
    kind: "perpetual",
    slot: "walk",
  }),
  make("alpha", "Alpha 行走", "alpha_walking.onnx", {
    kind: "perpetual",
    slot: "walk",
  }),
  make("stand", "独立站立", "alpha_stand.onnx", {
    kind: "perpetual",
    slot: "stand",
  }),
  make("sitstand", "坐下 / 站起", "alpha_sitstand.onnx", {
    kind: "scripted",
    slot: "sitstand",
    encoding: "posture_flag",
    unwind: 1,
    actionScale: 1,
  }),
  make("pick", "捡拾", "alpha_ground_pick.onnx", {
    slot: "ground_pick",
    encoding: "phase",
    duration: 2.8,
    actionScale: 1,
  }),
  make("roll", "翻滚", "roulade.onnx", { duration: 1 }),
  make("kick-left", "左踢", "ball_kick_left.onnx"),
  make("kick-right", "右踢", "ball_kick_right.onnx"),
];
