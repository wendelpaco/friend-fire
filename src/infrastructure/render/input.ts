export class Input {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  private mouseButtons = new Set<number>();
  private mouseJustPressed = new Set<number>();
  mouseX = 0;
  mouseY = 0;
  aimWorldX = 0;
  aimWorldZ = 0;
  private bound = false;

  /**
   * When true, keyboard/mouse combat edges are ignored (chat focus trap).
   * Set by GameClient while SquadChat input is focused.
   */
  private suppressed = false;

  /** True when combat input is suppressed (chat focus trap). */
  isSuppressed(): boolean {
    return this.suppressed;
  }

  /**
   * True when focus is in a form field. Does **not** include the suppressed
   * flag — so a stuck chatFocused cannot permanently block mouse forever.
   */
  isDomTyping(target: EventTarget | null = null): boolean {
    const el =
      (target as HTMLElement | null) ??
      (typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null);
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  /** @deprecated prefer isDomTyping / isSuppressed — kept for callers */
  isTypingTarget(target: EventTarget | null = null): boolean {
    if (this.suppressed) return true;
    return this.isDomTyping(target);
  }

  setSuppressed(suppressed: boolean) {
    this.suppressed = suppressed;
    if (suppressed) {
      this.keys.clear();
      this.justPressed.clear();
      this.mouseButtons.clear();
      this.mouseJustPressed.clear();
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Chat / form focus: do not capture game keys (Meta-3 input trap).
    if (this.suppressed || this.isDomTyping(e.target)) {
      return;
    }
    if (!this.keys.has(e.code)) {
      this.justPressed.add(e.code);
    }
    this.keys.add(e.code);
    // Prevent browser chrome: Space scrolls, arrows scroll, Tab focus.
    if (
      [
        "Space",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Tab",
      ].includes(e.code)
    ) {
      e.preventDefault();
    }
  };

  /** Jump edge (Space). */
  wasJumpPressed() {
    return this.wasPressed("Space");
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent) => {
    // Allow combat clicks on the canvas even if chat was focused —
    // canvas mousedown should re-enable aim/fire (clears stuck trap).
    const t = e.target as HTMLElement | null;
    const onCanvas = t?.tagName === "CANVAS";
    if (!onCanvas && (this.suppressed || this.isDomTyping(e.target))) {
      return;
    }
    if (onCanvas) {
      // Always drop suppress + blur form fields so death-social chat cannot
      // keep isDomTyping true (which blocks fire wire to the server forever).
      this.suppressed = false;
      if (typeof document !== "undefined") {
        const active = document.activeElement as HTMLElement | null;
        if (
          active &&
          active !== t &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.tagName === "SELECT" ||
            active.isContentEditable)
        ) {
          active.blur();
        }
      }
    }
    if (!this.mouseButtons.has(e.button)) {
      this.mouseJustPressed.add(e.button);
    }
    this.mouseButtons.add(e.button);
  };

  private onMouseUp = (e: MouseEvent) => {
    this.mouseButtons.delete(e.button);
  };

  private onMouseMove = (e: MouseEvent) => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  };

  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  private onBlur = () => {
    this.keys.clear();
    this.mouseButtons.clear();
  };

  bind(target: Window = window) {
    if (this.bound) return;
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("mousedown", this.onMouseDown);
    target.addEventListener("mouseup", this.onMouseUp);
    target.addEventListener("mousemove", this.onMouseMove);
    target.addEventListener("contextmenu", this.onContextMenu);
    target.addEventListener("blur", this.onBlur);
    this.bound = true;
  }

  unbind(target: Window = window) {
    if (!this.bound) return;
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
    target.removeEventListener("mousedown", this.onMouseDown);
    target.removeEventListener("mouseup", this.onMouseUp);
    target.removeEventListener("mousemove", this.onMouseMove);
    target.removeEventListener("contextmenu", this.onContextMenu);
    target.removeEventListener("blur", this.onBlur);
    this.bound = false;
  }

  /** Call once per frame after reading edge events */
  endFrame() {
    this.justPressed.clear();
    this.mouseJustPressed.clear();
  }

  isDown(code: string) {
    return this.keys.has(code);
  }

  wasPressed(code: string) {
    return this.justPressed.has(code);
  }

  isMouseDown(button = 0) {
    return this.mouseButtons.has(button);
  }

  moveVector(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.isDown("KeyW") || this.isDown("ArrowUp")) z -= 1;
    if (this.isDown("KeyS") || this.isDown("ArrowDown")) z += 1;
    if (this.isDown("KeyA") || this.isDown("ArrowLeft")) x -= 1;
    if (this.isDown("KeyD") || this.isDown("ArrowRight")) x += 1;
    const len = Math.hypot(x, z);
    if (len > 0) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  weaponSlotKey(): number | null {
    for (let i = 1; i <= 5; i++) {
      if (
        this.wasPressed(`Digit${i}`) ||
        this.wasPressed(`Numpad${i}`)
      ) {
        return i;
      }
    }
    return null;
  }
}
