/** Port of reference/control.rs and obs.rs. Physical state stays outside the renderer. */
import { HOME, type PolicyDef, type Sensors } from "../types";
export interface PolicyRunner {
  infer(obs: Float32Array): Promise<Float32Array>;
  reset(): void;
}
export class Controller {
  lastAction = new Float32Array(14);
  previous: Float64Array | null = null;
  seated = false;
  rising = 0;
  phase: number | null = null;
  active: { def: PolicyDef; remaining: number; unwinding: boolean } | null =
    null;
  twist = [0, 0, 0];
  lastNet = "";
  label = "站立";
  walk = "velstand";
  stand: string | null = null;
  sitPolicy = "sitstand";
  pickPolicy = "pick";
  constructor(
    public defs: Map<string, PolicyDef>,
    public runners: Map<string, PolicyRunner>,
  ) {}
  get busy() {
    return this.active !== null || this.phase !== null || this.rising > 0;
  }
  reset(profile: string) {
    this.lastAction.fill(0);
    this.previous = null;
    this.seated = false;
    this.rising = 0;
    this.phase = null;
    this.active = null;
    this.twist = [0, 0, 0];
    this.lastNet = "";
    this.walk = profile;
    this.stand = profile === "alpha" ? "stand" : null;
    for (const p of this.runners.values()) p.reset();
  }
  trigger(id: string) {
    if (this.busy) throw new Error("请等待当前动作完成");
    this.twist = [0, 0, 0];
    if (id === "sitstand") {
      if (this.seated) {
        this.seated = false;
        this.rising = this.defs.get(this.sitPolicy)?.unwind || 1;
      } else this.seated = true;
      return;
    }
    if (this.seated) throw new Error("请先让鸭子站起");
    if (id === "pick") {
      this.phase = 0;
      return;
    }
    const def = this.defs.get(id);
    if (!def || !this.runners.has(id)) throw new Error("动作尚未加载");
    this.runners.get(id)!.reset();
    this.active = { def, remaining: def.duration, unwinding: false };
  }
  observation(s: Sensors, command: number[]) {
    const obs = new Float32Array(61);
    obs.set(s.gyro, 0);
    obs.set(s.gravity, 3);
    for (let i = 0; i < 14; i++) {
      const j = i < 9 ? i : i + 1;
      obs[6 + i] = s.positions[j] - HOME[j];
      obs[20 + i] = s.velocities[j];
    }
    obs.set(this.lastAction, 34);
    obs.set(command, 48);
    return obs;
  }
  async step(s: Sensors, vx: number, yaw: number) {
    for (let i = 0; i < 3; i++)
      this.twist[i] += 0.2 * ([vx, 0, yaw][i] - this.twist[i]);
    if (this.active && this.active.remaining <= 0) {
      if (!this.active.unwinding && this.active.def.unwind > 0) {
        this.active.unwinding = true;
        this.active.remaining = this.active.def.unwind;
      } else this.active = null;
    }
    let key = this.walk,
      command = this.twist.slice(),
      scale = 0.9,
      gain = 200;
    if (this.active) {
      key = this.active.def.id;
      command = (
        this.active.unwinding ? this.active.def.idle : this.active.def.command
      ).slice();
      this.label =
        this.active.def.name + (this.active.unwinding ? " · 收尾" : "");
    } else if (this.phase !== null) {
      key = this.pickPolicy;
      const angle = Math.PI * 2 * this.phase;
      command = [Math.cos(angle), Math.sin(angle), 0];
      this.label = "捡拾";
    } else if (this.seated || this.rising > 0) {
      key = this.sitPolicy;
      command = [this.seated ? 1 : 0, 0, 0];
      this.label = this.seated ? "坐下" : "站起";
    } else {
      if (this.stand && Math.hypot(...command) <= 0.05) key = this.stand;
      this.label = Math.hypot(...command) <= 0.05 ? "站立" : "行走";
    }
    const standing = !!this.stand && Math.hypot(...command) <= 0.05;
    if (
      key === this.stand ||
      ((this.active || key === this.sitPolicy) && standing)
    ) {
      scale = 1;
      gain = 160;
    }
    if (key === this.pickPolicy || key === this.sitPolicy) scale = 1;
    const def = this.defs.get(key)!;
    if (def.actionScale !== undefined) scale = def.actionScale;
    const runner = this.runners.get(key);
    if (!runner) throw new Error(`策略未加载：${key}`);
    if (key !== this.lastNet) {
      runner.reset();
      this.lastNet = key;
    }
    const action = await runner.infer(this.observation(s, command));
    if (action.length !== 14 || !action.every(Number.isFinite))
      throw new Error("策略返回了无效关节目标");
    this.lastAction.set(action);
    const targets = Float64Array.from(HOME);
    for (let i = 0; i < 14; i++) {
      const j = i < 9 ? i : i + 1;
      targets[j] += scale * action[i];
    }
    if (this.previous)
      for (let j = 0; j < 15; j++) {
        if (j === 9) continue;
        const a = j >= 5 && j < 9 ? 0.5 : 0.7;
        targets[j] = a * targets[j] + (1 - a) * this.previous[j];
      }
    this.previous = targets;
    if (this.phase !== null) {
      const p = this.defs.get(this.pickPolicy)!;
      this.phase += 0.02 / p.period;
      if (this.phase >= p.endPhase) this.phase = null;
    }
    if (this.active) this.active.remaining -= 0.02;
    if (this.rising > 0) this.rising = Math.max(0, this.rising - 0.02);
    return { targets, gain };
  }
}
