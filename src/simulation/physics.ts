import type { MainModule, MjModel, MjData } from "@mujoco/mujoco";
import {
  JOINTS,
  HOME,
  type Geometry,
  type Sensors,
  type Snapshot,
} from "../types";
import { Controller } from "./controller";
export class Physics {
  model: MjModel;
  data: MjData;
  act: number[] = [];
  pos: number[] = [];
  vel: number[] = [];
  gains: number[] = [];
  trunk: number;
  trunkDof: number;
  ballPos: number;
  ballDof: number;
  fallen = false;
  fallTime = 0;
  ms = 0;
  total = 0;
  paused = false;
  constructor(
    public mj: MainModule,
    public controller: Controller,
  ) {
    this.model = mj.MjModel.mj_loadXML("/simulation/scene.xml");
    this.data = new mj.MjData(this.model);
    this.model.opt.timestep = 0.005;
    const m = this.model;
    for (const name of JOINTS) {
      const a = mj.mj_name2id(m, 19, name),
        j = mj.mj_name2id(m, 3, name);
      if (name !== "mouth" && (a < 0 || j < 0))
        throw new Error("模型缺少关节 " + name);
      this.act.push(a);
      this.pos.push(j < 0 ? -1 : m.jnt_qposadr[j]);
      this.vel.push(j < 0 ? -1 : m.jnt_dofadr[j]);
      this.gains.push(a < 0 ? 0 : m.actuator_gainprm[a * 10]);
    }
    const joint = (name: string) => {
      const j = mj.mj_name2id(m, 3, name);
      if (j < 0) throw new Error("缺少自由关节 " + name);
      return j;
    };
    let j = joint("trunk_base_freejoint");
    this.trunk = m.jnt_qposadr[j];
    this.trunkDof = m.jnt_dofadr[j];
    j = joint("football_free");
    this.ballPos = m.jnt_qposadr[j];
    this.ballDof = m.jnt_dofadr[j];
    this.reset("velstand");
  }
  reset(profile: string) {
    this.mj.mj_resetData(this.model, this.data);
    this.data.qpos[this.trunk + 2] = 0.125;
    this.data.qpos[this.trunk + 3] = 1;
    for (let i = 0; i < 15; i++)
      if (this.act[i] >= 0) {
        this.data.qpos[this.pos[i]] = HOME[i];
        this.data.ctrl[this.act[i]] = HOME[i];
        this.gain(i, 1);
      }
    this.fallen = false;
    this.fallTime = 0;
    this.controller.reset(profile);
    this.ball("right", 0.22);
    this.mj.mj_forward(this.model, this.data);
  }
  rotation() {
    const q = this.data.qpos;
    const w = q[this.trunk + 3],
      x = q[this.trunk + 4],
      y = q[this.trunk + 5],
      z = q[this.trunk + 6];
    return [
      1 - 2 * (y * y + z * z),
      2 * (x * y - z * w),
      2 * (x * z + y * w),
      2 * (x * y + z * w),
      1 - 2 * (x * x + z * z),
      2 * (y * z - x * w),
      2 * (x * z - y * w),
      2 * (y * z + x * w),
      1 - 2 * (x * x + y * y),
    ];
  }
  ball(side = "right", distance = 0.08) {
    const lateral = side === "left" ? 0.045 : -0.045;
    const q = this.data.qpos,
      r = this.rotation(),
      b = this.ballPos;
    q[b] = q[this.trunk] + r[0] * distance + r[1] * lateral;
    q[b + 1] = q[this.trunk + 1] + r[3] * distance + r[4] * lateral;
    q[b + 2] = 0.026;
    q[b + 3] = 1;
    q.fill(0, b + 4, b + 7);
    this.data.qvel.fill(0, this.ballDof, this.ballDof + 6);
    this.mj.mj_forward(this.model, this.data);
  }
  gain(i: number, ratio: number) {
    this.model.actuator_gainprm[this.act[i] * 10] = this.gains[i] * ratio;
    this.model.actuator_biasprm[this.act[i] * 10 + 1] = -this.gains[i] * ratio;
  }
  sensors(): Sensors {
    const q = this.data.qpos,
      v = this.data.qvel,
      r = this.rotation();
    return {
      positions: Float64Array.from(this.pos.map((p) => (p < 0 ? 0 : q[p]))),
      velocities: Float64Array.from(this.vel.map((p) => (p < 0 ? 0 : v[p]))),
      gyro: Array.from(v.slice(this.trunkDof + 3, this.trunkDof + 6)),
      gravity: [-r[6], -r[7], -r[8]],
    };
  }
  async tick(vx: number, yaw: number) {
    if (this.paused) return;
    const start = performance.now(),
      s = this.sensors();
    if (!this.controller.busy && s.gravity[2] > -0.35) this.fallTime += 0.02;
    else this.fallTime = 0;
    if (this.fallTime > 0.8) this.fallen = true;
    if (!this.fallen) {
      const out = await this.controller.step(s, vx, yaw);
      for (let i = 0; i < 15; i++)
        if (this.act[i] >= 0) {
          this.data.ctrl[this.act[i]] = out.targets[i];
          this.gain(i, out.gain / 200);
        }
    } else for (let i = 0; i < 15; i++) if (this.act[i] >= 0) this.gain(i, 0.1);
    for (let i = 0; i < 4; i++) this.mj.mj_step(this.model, this.data);
    if (!this.data.qpos.every(Number.isFinite))
      throw new Error("物理状态无效，请重置场景");
    // Update visual positions at the completed time step.
    this.mj.mj_forward(this.model, this.data);
    this.total++;
    this.ms = this.ms
      ? this.ms * 0.95 + (performance.now() - start) * 0.05
      : performance.now() - start;
  }
  snapshot(hz: number, vx: number, yaw: number): Snapshot {
    const q = this.data.qpos;
    return {
      time: this.data.time,
      position: Array.from(q.slice(this.trunk, this.trunk + 3)),
      ball: Array.from(q.slice(this.ballPos, this.ballPos + 3)),
      busy: this.controller.busy,
      seated: this.controller.seated,
      fallen: this.fallen,
      paused: this.paused,
      label: this.controller.label,
      hz,
      ms: this.ms,
      vx,
      yaw,
      geomPos: new Float64Array(this.data.geom_xpos),
      geomMat: new Float64Array(this.data.geom_xmat),
    };
  }
  geometry() {
    const m = this.model,
      geoms: Geometry[] = [];
    for (let i = 0; i < m.ngeom; i++) {
      if (m.geom_group[i] >= 3) continue;
      const mat = m.geom_matid[i];
      const color = Array.from(
        (mat >= 0 ? m.mat_rgba : m.geom_rgba).slice(
          (mat >= 0 ? mat : i) * 4,
          (mat >= 0 ? mat : i) * 4 + 4,
        ),
      ) as number[];
      const g: Geometry = {
        id: i,
        type: m.geom_type[i],
        size: Array.from(m.geom_size.slice(i * 3, i * 3 + 3)),
        color,
      };
      if (g.type === 7) {
        const id = m.geom_dataid[i],
          count = m.mesh_facenum[id] * 3;
        g.vertices = new Float32Array(count * 3);
        g.normals = new Float32Array(count * 3);
        for (let k = 0; k < count; k++) {
          const f = m.mesh_faceadr[id] * 3 + k,
            vi = (m.mesh_vertadr[id] + m.mesh_face[f]) * 3,
            ni = (m.mesh_normaladr[id] + m.mesh_facenormal[f]) * 3;
          for (let j = 0; j < 3; j++) {
            g.vertices[k * 3 + j] = m.mesh_vert[vi + j];
            g.normals[k * 3 + j] = m.mesh_normal[ni + j];
          }
        }
      }
      geoms.push(g);
    }
    return { geoms };
  }
}
