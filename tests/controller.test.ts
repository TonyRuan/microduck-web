import { test } from "node:test";
import assert from "node:assert/strict";
import { Controller } from "../src/simulation/controller";
import { BUILTINS, parseManifest } from "../src/policies/manifest";
import { HOME, DEFAULTS } from "../src/types";
const sensors = {
  positions: Float64Array.from(HOME),
  velocities: new Float64Array(15),
  gyro: [1, 2, 3],
  gravity: [0, 0, -1],
};
function setup() {
  const calls: { id: string; obs: Float32Array }[] = [];
  const defs = new Map(BUILTINS.map((d) => [d.id, d]));
  const runners = new Map(
    BUILTINS.map((d) => [
      d.id,
      {
        reset() {},
        async infer(obs: Float32Array) {
          calls.push({ id: d.id, obs });
          return new Float32Array(14).fill(0.1);
        },
      },
    ]),
  );
  return { c: new Controller(defs, runners), calls };
}
test("observation layout excludes mouth and retains raw previous actions", () => {
  const { c } = setup();
  sensors.positions[9] = 12;
  sensors.velocities[9] = 99;
  c.lastAction.fill(0.2);
  const o = c.observation(sensors, [0.4, 0, 1]);
  assert.equal(o.length, 61);
  assert.deepEqual(Array.from(o.slice(0, 6)), [1, 2, 3, 0, 0, -1]);
  assert.ok(o.slice(6, 34).every((x) => x === 0));
  assert.ok(o.slice(34, 48).every((x) => Math.abs(x - 0.2) < 1e-6));
  assert.ok(Math.abs(o[48] - 0.4) < 1e-6);
  assert.equal(o[50], 1);
  assert.ok(o.slice(51).every((x) => x === 0));
});
test("command smoothing, scaling, sitting and rise dispatch", async () => {
  const { c, calls } = setup();
  c.reset("alpha");
  assert.equal((await c.step(sensors, 0, 0)).gain, 160);
  assert.equal(calls.at(-1)?.id, "stand");
  await c.step(sensors, 0.4, 1);
  assert.equal(calls.at(-1)?.id, "alpha");
  assert.ok(Math.abs(calls.at(-1)!.obs[48] - 0.08) < 1e-6);
  c.trigger("sitstand");
  await c.step(sensors, 0.4, 1);
  assert.equal(calls.at(-1)!.obs[48], 1);
  c.trigger("sitstand");
  assert.equal((await c.step(sensors, 0, 0)).gain, 160);
  assert.equal(calls.at(-1)!.obs[48], 0);
  assert.throws(() => c.trigger("roll"), /等待/);
  for (let i = 0; i < 55; i++) await c.step(sensors, 0, 0);
  assert.equal(c.busy, false);
});
test("phase advances in simulation time; reset clears recurrent runners and commands", async () => {
  const { c, calls } = setup();
  c.trigger("pick");
  await c.step(sensors, 0, 0);
  assert.equal(calls.at(-1)?.obs[48], 1);
  for (let i = 0; i < 141; i++) await c.step(sensors, 0, 0);
  assert.equal(c.busy, false);
  c.reset("velstand");
  assert.equal(c.previous, null);
  assert.equal(c.lastAction[0], 0);
  assert.deepEqual(c.twist, [0, 0, 0]);
});
test("manifest rejects incompatible concrete contracts, not arbitrary API numbers", () => {
  assert.equal(
    parseManifest(
      { model_api: 999, obs_len: 61, action_len: 14 },
      "test",
      "local",
    ).duration,
    4,
  );
  for (const m of [
    { obs_len: 62 },
    { action_len: 15 },
    { mode: "roller" },
    { kind: "perpetual" },
    { command: { encoding: "unknown" } },
    { action_scale: NaN },
    { policies: [] },
  ])
    assert.throws(() => parseManifest(m, "test", "local"));
  assert.equal(DEFAULTS.forward, 0.4);
  assert.equal(DEFAULTS.backward, 0.4);
  assert.equal(DEFAULTS.turn, 1);
});
