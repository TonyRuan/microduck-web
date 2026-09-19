export type Mode = "auto" | "touch" | "keyboard";
export type Profile = "velstand" | "alpha" | string;
export interface Settings {
  mode: Mode;
  forward: number;
  backward: number;
  turn: number;
  follow: boolean;
  profile: Profile;
}
export interface PolicyDef {
  id: string;
  name: string;
  description: string;
  source: string;
  file?: string;
  kind: "episodic" | "perpetual" | "scripted";
  slot?: "walk" | "stand" | "sitstand" | "ground_pick";
  encoding: "constant" | "phase" | "posture_flag";
  duration: number;
  unwind: number;
  period: number;
  endPhase: number;
  actionScale?: number;
  command: [number, number, number];
  idle: [number, number, number];
  recurrent?: boolean;
  hash?: string;
}
export interface SavedPolicy {
  def: PolicyDef;
  bytes: ArrayBuffer;
  manifest: unknown;
  savedAt: number;
}
export interface Snapshot {
  time: number;
  position: number[];
  ball: number[];
  busy: boolean;
  seated: boolean;
  fallen: boolean;
  paused: boolean;
  label: string;
  hz: number;
  ms: number;
  vx: number;
  yaw: number;
  geomPos: Float64Array;
  geomMat: Float64Array;
}
export interface Geometry {
  id: number;
  type: number;
  size: number[];
  color: number[];
  vertices?: Float32Array;
  normals?: Float32Array;
}
export interface WorldDescription {
  geoms: Geometry[];
}
export type Request = { id?: number; type: string; [key: string]: unknown };
export interface Sensors {
  positions: Float64Array;
  velocities: Float64Array;
  gyro: number[];
  gravity: number[];
}
export const DEFAULTS: Settings = {
  mode: "auto",
  forward: 0.4,
  backward: 0.4,
  turn: 1,
  follow: true,
  profile: "velstand",
};
export const JOINTS = [
  "left_hip_yaw",
  "left_hip_roll",
  "left_hip_pitch",
  "left_knee",
  "left_ankle",
  "neck_pitch",
  "head_pitch",
  "head_yaw",
  "head_roll",
  "mouth",
  "right_hip_yaw",
  "right_hip_roll",
  "right_hip_pitch",
  "right_knee",
  "right_ankle",
];
export const HOME = [
  0, -0.0873, -0.4579, -0.0049, 0.453, 0.3491, 0.3491, 0, 0, 0, 0, 0.0873,
  0.4579, 0.0049, -0.453,
];
