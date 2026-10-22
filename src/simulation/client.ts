import { msg, errorMessage } from "../i18n/core";
import type { Request, Snapshot, WorldDescription } from "../types";
export class SimulationClient {
  worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  serial = 0;
  pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  onState: (s: Snapshot) => void = () => {};
  onProgress: (message: string, progress: number) => void = () => {};
  onError: (message: string) => void = () => {};
  async start(base: string): Promise<WorldDescription> {
    return new Promise((resolve, reject) => {
      this.worker.onerror = (e) => {
        const message = e.message
          ? errorMessage(new Error(e.message))
          : msg("浏览器未能启动仿真线程");
        reject(new Error(message));
        this.onError(message);
      };
      this.worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === "ready") resolve(m.world);
        else if (m.type === "state") this.onState(m.state);
        else if (m.type === "loading") this.onProgress(m.message, m.progress);
        else if (m.type === "error") {
          reject(new Error(m.message));
          this.onError(m.message);
        } else if (m.type === "response") {
          const p = this.pending.get(m.id);
          if (p) {
            m.ok ? p.resolve(m) : p.reject(new Error(m.error));
            this.pending.delete(m.id);
          }
        }
      };
      this.worker.postMessage({ type: "init", base });
    });
  }
  request(type: string, data: Record<string, unknown> = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.serial;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type, id, ...data } satisfies Request);
    });
  }
  move(vx: number, yaw: number) {
    this.worker.postMessage({ type: "move", vx, yaw });
  }
  visibility(hidden: boolean) {
    this.worker.postMessage({ type: "visibility", hidden });
  }
  dispose() {
    this.worker.terminate();
    for (const p of this.pending.values())
      p.reject(new Error(msg("仿真已关闭")));
    this.pending.clear();
  }
}
