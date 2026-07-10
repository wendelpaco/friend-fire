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

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.keys.has(e.code)) {
      this.justPressed.add(e.code);
    }
    this.keys.add(e.code);
    // Prevent browser chrome: Space scrolls, Ctrl+click menus, arrows scroll, Tab focus.
    if (
      [
        "Space",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Tab",
        "ControlLeft",
        "ControlRight",
      ].includes(e.code)
    ) {
      e.preventDefault();
    }
  };

  /**
   * Crouch is a toggle: rising edge on either Control key.
   * Use for client prediction (`applyPlayerMotor`).
   */
  wasCrouchPressed() {
    return this.wasPressed("ControlLeft") || this.wasPressed("ControlRight");
  }

  /**
   * Control currently held (either key).
   * Multiplayer wire bit only — server rising-edge detects toggle; not "hold to crouch".
   */
  isCrouchDown() {
    return this.isDown("ControlLeft") || this.isDown("ControlRight");
  }

  /** Jump edge (Space). */
  wasJumpPressed() {
    return this.wasPressed("Space");
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent) => {
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
