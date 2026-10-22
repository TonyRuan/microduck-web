import { msg } from "../i18n/core";
import * as ort from "onnxruntime-web/wasm";
import type { PolicyRunner } from "../simulation/controller";
export function configureRuntime(base: string) {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = base + "runtime/";
}
export class OnnxPolicy implements PolicyRunner {
  private states: Record<string, ort.Tensor> = {};
  private stateShape: number[] | null = null;
  private constructor(public session: ort.InferenceSession) {}
  static async load(bytes: ArrayBuffer) {
    if (bytes.byteLength > 32 * 1024 * 1024)
      throw new Error(msg("单个模型限 32 MB，以控制浏览器内存占用"));
    const session = await ort.InferenceSession.create(bytes, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    }).catch(() => {
      throw new Error(
        msg(
          "ONNX 无法加载：请确认文件完整、已正确导出，并使用浏览器支持的算子。",
        ),
      );
    });
    const p = new OnnxPolicy(session);
    try {
      const input = session.inputMetadata.find((x) => x.name === "obs"),
        output =
          session.outputMetadata.find((x) => x.name === "actions") ??
          session.outputMetadata[0];
      const matrix = (v: typeof input, n: number) =>
        v?.isTensor &&
        v.type === "float32" &&
        v.shape.length === 2 &&
        (v.shape[0] === 1 || typeof v.shape[0] === "string") &&
        v.shape[1] === n;
      if (!matrix(input, 61) || !matrix(output, 14))
        throw new Error(msg("模型接口需要 float32 obs[1,61] → actions[1,14]"));
      if (session.inputNames.length === 3 && session.outputNames.length === 3) {
        for (const [list, name] of [
          [session.inputMetadata, "h_in"],
          [session.inputMetadata, "c_in"],
          [session.outputMetadata, "h_out"],
          [session.outputMetadata, "c_out"],
        ] as const) {
          const v = list.find((x) => x.name === name);
          if (!v?.isTensor || v.type !== "float32" || v.shape.length !== 3)
            throw new Error(msg("LSTM 隐藏状态接口不兼容"));
          const shape = v.shape.map((x, i) =>
            i === 1 && (x === 1 || typeof x === "string") ? 1 : Number(x),
          );
          if (
            !shape.every((x) => Number.isInteger(x) && x > 0) ||
            shape.reduce((a, b) => a * b, 1) > 1048576
          )
            throw new Error(msg("LSTM 状态大小不兼容"));
          if (p.stateShape && String(p.stateShape) !== String(shape))
            throw new Error(msg("LSTM 状态维度不一致"));
          p.stateShape = shape;
        }
      } else if (
        session.inputNames.length !== 1 ||
        session.outputNames.length !== 1
      )
        throw new Error(
          msg("该模型依赖额外传感器或自定义状态，暂不能直接运行"),
        );
      p.reset();
      const obs = new Float32Array(61);
      obs[5] = -1;
      await p.infer(obs);
      p.reset();
      return p;
    } catch (e) {
      await session.release();
      throw e;
    }
  }
  reset() {
    for (const s of Object.values(this.states)) s.dispose();
    this.states = {};
    if (this.stateShape) {
      for (const name of ["h_in", "c_in"])
        this.states[name] = new ort.Tensor(
          "float32",
          new Float32Array(this.stateShape.reduce((a, b) => a * b, 1)),
          this.stateShape,
        );
    }
  }
  async infer(obs: Float32Array) {
    const tensor = new ort.Tensor("float32", obs, [1, 61]);
    let result: Record<string, ort.Tensor> = {};
    try {
      result = await this.session.run({ obs: tensor, ...this.states });
      const t = result.actions ?? result[this.session.outputNames[0]];
      if (
        t.type !== "float32" ||
        t.dims.length !== 2 ||
        t.dims[0] !== 1 ||
        t.dims[1] !== 14
      )
        throw new Error(msg("策略输出维度不正确"));
      const actions = new Float32Array(t.data as Float32Array);
      if (!actions.every(Number.isFinite))
        throw new Error(msg("策略输出含非有限数值"));
      if (this.stateShape) {
        for (const [next, name] of [
          ["h_out", "h_in"],
          ["c_out", "c_in"],
        ]) {
          const state = result[next];
          if (
            !state ||
            String(state.dims) !== String(this.stateShape) ||
            !(state.data as Float32Array).every(Number.isFinite)
          )
            throw new Error(msg("LSTM 返回无效隐藏状态"));
          this.states[name].dispose();
          this.states[name] = new ort.Tensor(
            "float32",
            new Float32Array(state.data as Float32Array),
            this.stateShape,
          );
        }
      }
      return actions;
    } finally {
      tensor.dispose();
      for (const t of Object.values(result)) t.dispose();
    }
  }
  async dispose() {
    for (const t of Object.values(this.states)) t.dispose();
    await this.session.release();
  }
}
