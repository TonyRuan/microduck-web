// Playwright-only replacement, never imported by production code.
// Exercise UI events without downloading models or starting physics/inference.
export function installUIWorkerStub() {
  window.__qaMessages = [];
  window.__qaUIStub = true;
  const message = (key, ...args) =>
    "@microduck-message:" + JSON.stringify([key, args]);
  window.Worker = class {
    constructor() {
      this.time = 0;
      this.paused = true;
      this.busy = false;
      this.label = message("站立");
      this.names = new Map();
    }
    emit(data) {
      this.onmessage?.({ data });
    }
    snapshot() {
      this.emit({
        type: "state",
        state: {
          time: this.time,
          position: [0, 0, 0.12],
          ball: [0.22, -0.045, 0.025],
          busy: this.busy,
          seated: false,
          fallen: false,
          paused: this.paused,
          label: this.label,
          hz: 50,
          ms: 0,
          vx: 0,
          yaw: 0,
          geomPos: new Float64Array(),
          geomMat: new Float64Array(),
        },
      });
    }
    postMessage(data) {
      if (data.type !== "move") window.__qaMessages.push(data.type);
      if (data.type === "init") {
        setTimeout(() => {
          this.emit({
            type: "loading",
            message: message("正在载入物理引擎…"),
            progress: 0.1,
          });
          this.emit({ type: "ready", world: { geoms: [] } });
          this.timer = setInterval(() => {
            if (!this.paused) this.time += 0.02;
            this.snapshot();
          }, 20);
        }, 0);
        return;
      }
      if (data.type === "move" || data.type === "visibility") return;
      if (data.type === "pause") this.paused = data.value;
      if (data.type === "reset") {
        this.time = 0;
        this.busy = false;
      }
      if (data.type === "register") this.names.set(data.def.id, data.def.name);
      if (data.type === "remove") this.names.delete(data.policy);
      if (data.type === "action") {
        this.busy = true;
        this.label = this.names.get(data.action) ?? message("翻滚");
        setTimeout(() => {
          this.busy = false;
          this.label = message("站立");
        }, 1000);
      }
      setTimeout(() => {
        this.snapshot();
        this.emit({ type: "response", id: data.id, ok: true });
      }, 0);
    }
    terminate() {
      clearInterval(this.timer);
    }
  };
}
