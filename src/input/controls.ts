import type { Mode, Settings } from "../types";
export function detectedMode(): Exclude<Mode, "auto"> {
  const mobile = (
    navigator as Navigator & { userAgentData?: { mobile: boolean } }
  ).userAgentData?.mobile;
  return mobile === true ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && matchMedia("(pointer:coarse)").matches)
    ? "touch"
    : "keyboard";
}
export class Controls {
  keys = new Set<string>();
  axis = { forward: 0, turn: 0 };
  pointer: number | null = null;
  mode: "touch" | "keyboard";
  enabled = true;
  constructor(
    public settings: Settings,
    public pad: HTMLElement,
    public move: (vx: number, yaw: number) => void,
    public action: (id: string) => void,
  ) {
    this.mode = settings.mode === "auto" ? detectedMode() : settings.mode;
    addEventListener("keydown", (e) => {
      // Pause remains reachable while movement is disabled by pause or a menu.
      if (
        e.code === "KeyP" &&
        !e.repeat &&
        this.mode === "keyboard" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        this.clear();
        this.action("pause");
        return;
      }
      if (
        !this.enabled ||
        this.mode !== "keyboard" ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      ) {
        e.preventDefault();
        this.keys.add(e.code);
      }
      if (e.repeat) return;
      const id: Record<string, string> = {
        Space: "stop",
        KeyC: "sitstand",
        KeyR: "roll",
        KeyQ: "kick-left",
        KeyE: "kick-right",
        KeyF: "pick",
        KeyB: "ball",
        KeyP: "pause",
        Digit0: "home",
      };
      if (id[e.code]) {
        e.preventDefault();
        this.clear();
        this.action(id[e.code]);
      }
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => this.clear());
    const update = (e: PointerEvent) => {
      const b = pad.getBoundingClientRect();
      const x = (e.clientX - b.left - b.width / 2) / (b.width * 0.37),
        y = (e.clientY - b.top - b.height / 2) / (b.height * 0.37);
      const n = Math.max(1, Math.hypot(x, y));
      const dx = x / n,
        dy = y / n;
      this.axis = {
        forward: Math.abs(dy) < 0.1 ? 0 : -dy,
        turn: Math.abs(dx) < 0.1 ? 0 : -dx,
      };
      pad.style.setProperty("--jx", dx * b.width * 0.28 + "px");
      pad.style.setProperty("--jy", dy * b.height * 0.28 + "px");
    };
    pad.addEventListener("pointerdown", (e) => {
      if (!this.enabled || this.pointer !== null || this.mode !== "touch")
        return;
      e.preventDefault();
      this.pointer = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      update(e);
    });
    pad.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.pointer) update(e);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      pad.addEventListener(type, (e) => {
        if ((e as PointerEvent).pointerId === this.pointer) this.clear();
      });
    setInterval(() => {
      let forward = this.axis.forward,
        turn = this.axis.turn;
      if (this.mode === "keyboard") {
        forward =
          +(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
          +(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
        turn =
          +(this.keys.has("KeyA") || this.keys.has("ArrowLeft")) -
          +(this.keys.has("KeyD") || this.keys.has("ArrowRight"));
      }
      if (!this.enabled || document.hidden) {
        forward = turn = 0;
      }
      this.move(
        forward *
          (forward >= 0 ? this.settings.forward : this.settings.backward),
        turn * this.settings.turn,
      );
    }, 50);
  }
  clear() {
    this.keys.clear();
    this.axis = { forward: 0, turn: 0 };
    this.pointer = null;
    this.pad.style.setProperty("--jx", "0px");
    this.pad.style.setProperty("--jy", "0px");
    this.move(0, 0);
  }
  setMode(mode: Mode) {
    this.clear();
    this.settings.mode = mode;
    this.mode = mode === "auto" ? detectedMode() : mode;
    document.body.dataset.controls = this.mode;
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }
}
