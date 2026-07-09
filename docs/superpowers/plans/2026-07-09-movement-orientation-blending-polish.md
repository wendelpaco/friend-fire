# Movement Orientation & Blending Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate snap turns, back-facing flicker, and animation pops in character locomotion by adding velocity smoothing, move/idle hysteresis, a turn-rate cap, and per-channel blend-weight smoothing.

**Architecture:** All new math lands as pure functions in `src/domains/fx/locomotion.ts` (unit-tested with vitest). `CharacterController` (render-side, per-character state) wires them together: EMA-smoothed velocity feeds a hysteresis-gated facing target, yaw is rate-capped, and locomotion weights are exponentially smoothed before reaching the animator. `CharacterAnimator` additionally smooths walk-cycle cadence. No server, network, or public-API changes — `CharacterHandle.update` signature is untouched.

**Tech Stack:** TypeScript, Three.js (untouched here), vitest, bun.

**Spec:** `docs/superpowers/specs/2026-07-09-movement-visual-polish-design.md` (sections 1–2).

## Global Constraints

- Run tests with `bun run test` (vitest run) from repo root.
- Keep existing NaN/non-finite guards pattern: invalid input → safe fallback, never NaN out.
- Do not change `CharacterHandle.update` or `ThreeRenderer.sync` call sites.
- Constants (from spec): velocity EMA lambda **20**; hysteresis enter **0.6** / exit **0.3** world-units/s; turn-rate cap **12.5 rad/s**; `TURN_LAMBDA` **14 → 9**; weight smoothing lambda **14** (~120 ms settle); cadence smoothing lambda **6**.
- Existing exports from `src/domains/fx/locomotion.ts` are re-exported via `export *` in `src/domains/fx/index.ts` — new exports are automatically available as `@/domains/fx`.
- Comments in code: English, same doc-comment style as the files already use.

---

### Task 1: Hysteresis + moving-aware facing target (pure functions)

**Files:**
- Modify: `src/domains/fx/locomotion.ts`
- Test: `src/domains/fx/locomotion.test.ts`

**Interfaces:**
- Consumes: existing `yawFromDirection(dx, dz)` from the same file.
- Produces:
  - `MOVE_ENTER_SPEED = 0.6`, `MOVE_EXIT_SPEED = 0.3` (exported consts)
  - `movingHysteresis(wasMoving: boolean, speed: number, enter?: number, exit?: number): boolean`
  - `bodyYawTargetMoving(moving: boolean, moveX: number, moveZ: number, aimYaw: number): number`
  - Existing `bodyYawTarget` stays untouched (backward compat).

- [ ] **Step 1: Write the failing tests**

Append to `src/domains/fx/locomotion.test.ts` (add `movingHysteresis`, `bodyYawTargetMoving`, `MOVE_ENTER_SPEED`, `MOVE_EXIT_SPEED` to the existing import block from `./locomotion`):

```ts
describe("movingHysteresis", () => {
  it("enters at ≥ enter threshold, exits at ≤ exit threshold, holds between", () => {
    expect(movingHysteresis(false, 0.59)).toBe(false);
    expect(movingHysteresis(false, 0.6)).toBe(true);
    // between thresholds: keeps previous state
    expect(movingHysteresis(true, 0.45)).toBe(true);
    expect(movingHysteresis(false, 0.45)).toBe(false);
    expect(movingHysteresis(true, 0.3)).toBe(false);
  });

  it("is safe on non-finite speed", () => {
    expect(movingHysteresis(true, NaN)).toBe(false);
    expect(movingHysteresis(false, Infinity)).toBe(true);
  });

  it("exposes spec thresholds", () => {
    expect(MOVE_ENTER_SPEED).toBe(0.6);
    expect(MOVE_EXIT_SPEED).toBe(0.3);
  });
});

describe("bodyYawTargetMoving", () => {
  it("faces aim when not moving", () => {
    expect(bodyYawTargetMoving(false, 3, 0, 1.2)).toBeCloseTo(1.2);
  });

  it("faces velocity when moving (+X → π/2)", () => {
    expect(bodyYawTargetMoving(true, 3, 0, 1.2)).toBeCloseTo(Math.PI / 2);
  });

  it("falls back to aim on zero vector even while moving", () => {
    expect(bodyYawTargetMoving(true, 0, 0, 1.2)).toBeCloseTo(1.2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- src/domains/fx/locomotion.test.ts`
Expected: FAIL — `movingHysteresis is not defined` (import error).

- [ ] **Step 3: Implement**

Append to `src/domains/fx/locomotion.ts` (after `bodyYawTarget`):

```ts
/** Speed (world units/s) at which the body starts following velocity. */
export const MOVE_ENTER_SPEED = 0.6;
/** Speed below which the body goes back to following aim. */
export const MOVE_EXIT_SPEED = 0.3;

/**
 * Move/idle state with hysteresis. A single threshold flickers when the
 * (noisy) snapshot-delta speed hovers around it — this is the root cause
 * of the "shows back sometimes" bug. Enter high, exit low, hold between.
 */
export function movingHysteresis(
  wasMoving: boolean,
  speed: number,
  enter: number = MOVE_ENTER_SPEED,
  exit: number = MOVE_EXIT_SPEED,
): boolean {
  if (!Number.isFinite(speed)) return false;
  return wasMoving ? speed > exit : speed >= enter;
}

/**
 * Facing target from an explicit moving state (see {@link movingHysteresis})
 * instead of a raw speed threshold. Zero vector falls back to aim.
 */
export function bodyYawTargetMoving(
  moving: boolean,
  moveX: number,
  moveZ: number,
  aimYaw: number,
): number {
  if (!moving) return aimYaw;
  if (
    !Number.isFinite(moveX) ||
    !Number.isFinite(moveZ) ||
    (moveX === 0 && moveZ === 0)
  ) {
    return aimYaw;
  }
  return yawFromDirection(moveX, moveZ);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- src/domains/fx/locomotion.test.ts`
Expected: PASS (all suites in the file).

- [ ] **Step 5: Commit**

```bash
git add src/domains/fx/locomotion.ts src/domains/fx/locomotion.test.ts
git commit -m "feat(fx): move/idle hysteresis and moving-aware facing target"
```

---

### Task 2: Turn-rate cap in `smoothYaw`

**Files:**
- Modify: `src/domains/fx/locomotion.ts` (existing `smoothYaw`)
- Test: `src/domains/fx/locomotion.test.ts`

**Interfaces:**
- Produces: `smoothYaw(current, target, dt, lambda = 12, maxRadPerSec = Infinity): number` — 5th parameter is new and optional; omitting it preserves current behavior exactly (existing tests must keep passing).

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe("deltaAngle / smoothYaw", ...)` block in `src/domains/fx/locomotion.test.ts`:

```ts
  it("caps the per-frame step to maxRadPerSec", () => {
    const dt = 1 / 60;
    // lambda 100 wants ~the whole π in one frame; cap must clamp it
    const next = smoothYaw(0, Math.PI, dt, 100, 2);
    expect(Math.abs(next)).toBeLessThanOrEqual(2 * dt + 1e-9);
    expect(next).toBeGreaterThan(0); // still turns the right way
  });

  it("cap defaults to Infinity (behavior unchanged)", () => {
    const dt = 1 / 60;
    expect(smoothYaw(0, 1, dt, 12)).toBeCloseTo(
      smoothYaw(0, 1, dt, 12, Infinity),
      12,
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- src/domains/fx/locomotion.test.ts`
Expected: FAIL — first new test gets an uncapped step (~π·0.81) > 2/60.

- [ ] **Step 3: Implement**

Replace the body of `smoothYaw` in `src/domains/fx/locomotion.ts`:

```ts
/**
 * Exponential-ish smooth yaw toward target (frame-rate independent).
 * @param lambda higher = snappier (≈12 feels responsive for soldiers)
 * @param maxRadPerSec hard cap on turn speed — a 180° reversal becomes a
 *   visible pivot instead of a snap. Default Infinity (no cap).
 */
export function smoothYaw(
  current: number,
  target: number,
  dt: number,
  lambda = 12,
  maxRadPerSec = Infinity,
): number {
  if (!(dt > 0)) return current;
  const d = deltaAngle(current, target);
  const t = 1 - Math.exp(-lambda * dt);
  let step = d * t;
  const maxStep = maxRadPerSec * dt;
  if (Number.isFinite(maxStep)) {
    step = Math.max(-maxStep, Math.min(maxStep, step));
  }
  return current + step;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- src/domains/fx/locomotion.test.ts`
Expected: PASS — including all pre-existing `smoothYaw` tests (backward compat).

- [ ] **Step 5: Commit**

```bash
git add src/domains/fx/locomotion.ts src/domains/fx/locomotion.test.ts
git commit -m "feat(fx): optional turn-rate cap in smoothYaw"
```

---

### Task 3: Per-channel weight smoothing (pure function)

**Files:**
- Modify: `src/domains/fx/locomotion.ts`
- Test: `src/domains/fx/locomotion.test.ts`

**Interfaces:**
- Consumes: `LocomotionWeights` type (same file).
- Produces: `smoothWeights(current: LocomotionWeights, target: LocomotionWeights, dt: number, lambda = 14): LocomotionWeights` — returns a NEW normalized object (sum of all five channels = 1); never mutates inputs.

- [ ] **Step 1: Write the failing tests**

Append to `src/domains/fx/locomotion.test.ts` (add `smoothWeights` and type `LocomotionWeights` to the import):

```ts
describe("smoothWeights", () => {
  const idle: LocomotionWeights = {
    idle: 1,
    forward: 0,
    backward: 0,
    strafeLeft: 0,
    strafeRight: 0,
  };
  const fwd: LocomotionWeights = {
    idle: 0,
    forward: 1,
    backward: 0,
    strafeLeft: 0,
    strafeRight: 0,
  };

  it("converges to target and stays normalized every frame", () => {
    let w = { ...idle };
    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) {
      w = smoothWeights(w, fwd, dt);
      const sum =
        w.idle + w.forward + w.backward + w.strafeLeft + w.strafeRight;
      expect(sum).toBeCloseTo(1, 5);
    }
    expect(w.forward).toBeGreaterThan(0.99);
  });

  it("does not jump: first frame moves only a fraction toward target", () => {
    const w = smoothWeights({ ...idle }, fwd, 1 / 60);
    expect(w.forward).toBeGreaterThan(0);
    expect(w.forward).toBeLessThan(0.4); // λ=14 @60fps ≈ 0.21 per frame
  });

  it("returns current unchanged for non-positive dt and never mutates inputs", () => {
    const cur = { ...idle };
    const out = smoothWeights(cur, fwd, 0);
    expect(out).toEqual(idle);
    expect(cur).toEqual(idle);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- src/domains/fx/locomotion.test.ts`
Expected: FAIL — `smoothWeights is not defined` (import error).

- [ ] **Step 3: Implement**

Append to `src/domains/fx/locomotion.ts` (after `locomotionWeights`):

```ts
/**
 * Exponentially smooth locomotion weights per channel, then renormalize so
 * all five channels sum to 1. Raw `locomotionWeights()` output jumps 0→1
 * when direction flips — smoothing (~120 ms at λ=14) is what removes the
 * visible animation "pop" between idle/forward/backward/strafe states.
 * Pure: returns a new object, never mutates inputs.
 */
export function smoothWeights(
  current: LocomotionWeights,
  target: LocomotionWeights,
  dt: number,
  lambda = 14,
): LocomotionWeights {
  if (!(dt > 0) || !Number.isFinite(dt)) return { ...current };
  const a = 1 - Math.exp(-lambda * dt);
  const mix = (c: number, t: number) => c + (t - c) * a;
  const w: LocomotionWeights = {
    idle: mix(current.idle, target.idle),
    forward: mix(current.forward, target.forward),
    backward: mix(current.backward, target.backward),
    strafeLeft: mix(current.strafeLeft, target.strafeLeft),
    strafeRight: mix(current.strafeRight, target.strafeRight),
  };
  const sum = w.idle + w.forward + w.backward + w.strafeLeft + w.strafeRight;
  if (!(sum > 1e-6)) {
    return { idle: 1, forward: 0, backward: 0, strafeLeft: 0, strafeRight: 0 };
  }
  w.idle /= sum;
  w.forward /= sum;
  w.backward /= sum;
  w.strafeLeft /= sum;
  w.strafeRight /= sum;
  return w;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- src/domains/fx/locomotion.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/fx/locomotion.ts src/domains/fx/locomotion.test.ts
git commit -m "feat(fx): per-channel locomotion weight smoothing"
```

---

### Task 4: Wire it all into `CharacterController`

**Files:**
- Modify: `src/infrastructure/render/character/CharacterController.ts`
- Test (create): `src/infrastructure/render/character/CharacterController.test.ts`

**Interfaces:**
- Consumes (from Tasks 1–3 via `@/domains/fx`): `movingHysteresis`, `bodyYawTargetMoving`, `smoothYaw` (5-arg), `smoothWeights`, plus existing `deltaAngle`, `locomotionWeights`, `MODEL_YAW_OFFSET_PROCEDURAL`, `LocomotionWeights`.
- Produces: `CharacterController.update(input)` — same signature and same `CharacterControllerState` shape as today. Behavior change only: smoothed velocity, hysteresis facing, capped turn rate, smoothed weights. `CharacterAnimator` and `character/index.ts` need **no** changes for this task.

- [ ] **Step 1: Write the failing tests**

Create `src/infrastructure/render/character/CharacterController.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deltaAngle } from "@/domains/fx";
import { CharacterController } from "./CharacterController";

const DT = 1 / 60;

function run(
  c: CharacterController,
  frames: number,
  input: { moveX: number; moveZ: number; aimYaw: number },
) {
  let state = c.update({ ...input, dt: DT });
  for (let i = 1; i < frames; i++) state = c.update({ ...input, dt: DT });
  return state;
}

describe("CharacterController — orientation polish", () => {
  it("ignores speed jitter below the enter threshold (keeps facing aim)", () => {
    const c = new CharacterController();
    c.reset(0);
    // Noisy sub-threshold speed toward +X (would be yaw π/2 if honored)
    for (let i = 0; i < 120; i++) {
      const s = i % 2 === 0 ? 0.25 : 0.45;
      c.update({ moveX: s, moveZ: 0, aimYaw: 0, dt: DT });
    }
    expect(Math.abs(deltaAngle(c.yaw, 0))).toBeLessThan(0.05);
  });

  it("faces velocity after clearing the enter threshold", () => {
    const c = new CharacterController();
    c.reset(0);
    const state = run(c, 120, { moveX: 2, moveZ: 0, aimYaw: 0 });
    expect(Math.abs(deltaAngle(c.yaw, Math.PI / 2))).toBeLessThan(0.05);
    expect(state.weights.idle).toBeLessThan(0.05);
  });

  it("caps turn rate on a 180° reversal (no snap flip)", () => {
    const c = new CharacterController();
    c.reset(0);
    run(c, 120, { moveX: 0, moveZ: 3, aimYaw: 0 }); // settle facing +Z (yaw 0)
    let prev = c.yaw;
    for (let i = 0; i < 90; i++) {
      c.update({ moveX: 0, moveZ: -3, aimYaw: 0, dt: DT });
      const step = Math.abs(deltaAngle(prev, c.yaw));
      expect(step).toBeLessThanOrEqual(12.5 * DT + 1e-6);
      prev = c.yaw;
    }
    // ended up facing −Z (yaw π)
    expect(Math.abs(deltaAngle(c.yaw, Math.PI))).toBeLessThan(0.05);
  });

  it("smooths weights: direction flip does not jump channels in one frame", () => {
    const c = new CharacterController();
    c.reset(0);
    run(c, 120, { moveX: 0, moveZ: 3, aimYaw: 0 }); // settled forward
    const before = c.update({ moveX: 3, moveZ: 0, aimYaw: 0, dt: DT });
    // one frame after a 90° direction change: strafe/forward must be mid-blend
    const sum =
      before.weights.idle +
      before.weights.forward +
      before.weights.backward +
      before.weights.strafeLeft +
      before.weights.strafeRight;
    expect(sum).toBeCloseTo(1, 5);
    expect(before.weights.forward).toBeGreaterThan(0.5); // still mostly forward
  });

  it("stops: returns to idle weights and faces aim again", () => {
    const c = new CharacterController();
    c.reset(0);
    run(c, 120, { moveX: 2, moveZ: 0, aimYaw: 1.0 });
    const state = run(c, 180, { moveX: 0, moveZ: 0, aimYaw: 1.0 });
    expect(state.weights.idle).toBeGreaterThan(0.95);
    expect(Math.abs(deltaAngle(c.yaw, 1.0))).toBeLessThan(0.05);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- src/infrastructure/render/character/CharacterController.test.ts`
Expected: FAIL — "ignores speed jitter" fails today (single 0.3 threshold: the 0.45 frames flip the target toward π/2), and "caps turn rate" fails (λ=14 uncapped step > 12.5·dt).

- [ ] **Step 3: Implement**

Rewrite the import block and class internals of `src/infrastructure/render/character/CharacterController.ts`. Imports become:

```ts
import {
  MODEL_YAW_OFFSET_PROCEDURAL,
  bodyYawTargetMoving,
  deltaAngle,
  locomotionWeights,
  movingHysteresis,
  smoothWeights,
  smoothYaw,
  type LocomotionWeights,
} from "@/domains/fx";
```

Constants (replace `TURN_LAMBDA = 14`, keep `MAX_TORSO_TWIST` and `TWIST_LAMBDA`):

```ts
/** Max upper-body twist toward aim while hips follow velocity. */
const MAX_TORSO_TWIST = 1.15; // ~66°
/** How fast body yaw catches velocity / aim. */
const TURN_LAMBDA = 9;
/** Hard cap on body turn speed — 180° reversals pivot, never snap. */
const MAX_TURN_RATE = 12.5; // rad/s ≈ 720°/s
/** How fast torso twist eases. */
const TWIST_LAMBDA = 16;
/** EMA on the raw move vector — snapshot deltas are noisy frame to frame. */
const VEL_LAMBDA = 20;
/** Locomotion blend settle ≈120 ms. */
const WEIGHT_LAMBDA = 14;

const IDLE_WEIGHTS: LocomotionWeights = {
  idle: 1,
  forward: 0,
  backward: 0,
  strafeLeft: 0,
  strafeRight: 0,
};
```

New private state on the class:

```ts
  private bodyYaw = 0;
  private torsoTwist = 0;
  private initialized = false;
  private smoothX = 0;
  private smoothZ = 0;
  private moving = false;
  private weights: LocomotionWeights = { ...IDLE_WEIGHTS };
```

`reset` becomes:

```ts
  /** Seed facing (spawn / respawn). */
  reset(aimYaw: number): void {
    this.bodyYaw = aimYaw;
    this.torsoTwist = 0;
    this.smoothX = 0;
    this.smoothZ = 0;
    this.moving = false;
    this.weights = { ...IDLE_WEIGHTS };
    this.initialized = true;
  }
```

`update` becomes:

```ts
  update(input: CharacterControllerInput): CharacterControllerState {
    const { moveX, moveZ, aimYaw, dt } = input;

    if (!this.initialized) {
      this.bodyYaw = aimYaw;
      this.initialized = true;
    }

    // 0) EMA the move vector — raw snapshot deltas jitter around thresholds
    const velAlpha = 1 - Math.exp(-VEL_LAMBDA * Math.max(0, dt));
    const mx = Number.isFinite(moveX) ? moveX : 0;
    const mz = Number.isFinite(moveZ) ? moveZ : 0;
    this.smoothX += (mx - this.smoothX) * velAlpha;
    this.smoothZ += (mz - this.smoothZ) * velAlpha;
    const speed = Math.hypot(this.smoothX, this.smoothZ);

    // 1) Move/idle with hysteresis, then body yaw: velocity when moving,
    //    aim when idle — rate-capped so reversals pivot instead of snapping
    this.moving = movingHysteresis(this.moving, speed);
    const target = bodyYawTargetMoving(
      this.moving,
      this.smoothX,
      this.smoothZ,
      aimYaw,
    );
    this.bodyYaw = smoothYaw(this.bodyYaw, target, dt, TURN_LAMBDA, MAX_TURN_RATE);

    // 2) Torso twists toward aim (gun tracks mouse without moonwalking hips)
    const desiredTwist = clamp(
      deltaAngle(this.bodyYaw, aimYaw),
      -MAX_TORSO_TWIST,
      MAX_TORSO_TWIST,
    );
    const twistAlpha = 1 - Math.exp(-TWIST_LAMBDA * Math.max(0, dt));
    this.torsoTwist += (desiredTwist - this.torsoTwist) * twistAlpha;

    // 3) Locomotion weights in body space, smoothed per channel (kills pops)
    const rawWeights = this.moving
      ? locomotionWeights(this.smoothX, this.smoothZ, this.bodyYaw, 1e-4)
      : IDLE_WEIGHTS;
    this.weights = smoothWeights(this.weights, rawWeights, dt, WEIGHT_LAMBDA);

    return {
      bodyYaw: this.bodyYaw,
      visualYaw: this.bodyYaw + this.modelYawOffset,
      torsoTwist: this.torsoTwist,
      weights: this.weights,
      speed,
    };
  }
```

Also update the class doc comment's "Fix" section to mention hysteresis + rate cap, and delete the now-unused `DEFAULT_RUN_THRESHOLD` / `bodyYawTarget` imports. Keep the `clamp` helper.

- [ ] **Step 4: Run the full test suite**

Run: `bun run test`
Expected: PASS — new controller tests plus all existing suites (locomotion, prefs, combat, etc.). If `locomotion.test.ts` still passes, `bodyYawTarget` compat is intact.

- [ ] **Step 5: Typecheck via build lint**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/render/character/CharacterController.ts src/infrastructure/render/character/CharacterController.test.ts
git commit -m "feat(character): smooth velocity, hysteresis facing, capped turns, blended weights"
```

---

### Task 5: Cadence smoothing in `CharacterAnimator`

**Files:**
- Modify: `src/infrastructure/render/character/CharacterAnimator.ts:99-104` (cadence block) and `reset()`

**Interfaces:**
- Consumes: nothing new — internal change.
- Produces: same `update(dt, input)` behavior, but walk-cycle cadence ramps smoothly instead of jumping when speed/state changes.

- [ ] **Step 1: Implement**

In `CharacterAnimator`, add a private field next to `phase`:

```ts
  private phase = 0;
  private cadence = 2.2;
```

Replace the cadence block in `update` (currently `const cadence = moving > 0.01 ? ... : 2.2; this.phase += dt * cadence;`):

```ts
    const moving = 1 - w.idle;
    const airborne = Boolean(input.airborne);
    // Smoothed cadence — instant cadence jumps make the walk cycle "skip"
    // when the blend state changes (part of the state-transition pop).
    const targetCadence = moving > 0.01 ? 8 + Math.min(speed, 8) * 0.6 : 2.2;
    this.cadence += (targetCadence - this.cadence) * (1 - Math.exp(-6 * dt));
    this.phase += dt * this.cadence;
```

In `reset()`, add:

```ts
    this.phase = 0;
    this.cadence = 2.2;
```

(keep the rest of `reset()` as is).

- [ ] **Step 2: Run full test suite + typecheck**

Run: `bun run test && bunx tsc --noEmit`
Expected: PASS / no errors (animator has no unit tests — bone math is Three.js-bound; verified manually in Task 6).

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/render/character/CharacterAnimator.ts
git commit -m "feat(character): smooth walk-cycle cadence ramps"
```

---

### Task 6: Manual browser verification

**Files:** none (verification only).

**Interfaces:** consumes the running game (`bun dev` for Next.js client, `bun dev:server` for Colyseus — server deps must be installed: `cd server && bun install`).

- [ ] **Step 1: Start server and client**

```bash
cd server && bun install && cd ..
bun dev:server   # terminal 1
bun dev          # terminal 2 → http://localhost:3000
```

- [ ] **Step 2: Verify each original symptom is gone**

In a match (offline/bots fine):
1. **Snap turn:** hold W, then flip to S. Soldier must pivot visibly (~quarter second), never teleport-flip 180°.
2. **Back-facing flicker:** wiggle slowly (tap movement keys, speed near zero) with the mouse behind the character. Body must stay on aim — no flicker toward movement direction.
3. **Blend pop:** walk forward, then strafe (W → A/D). Legs/arms must cross-fade over ~120 ms, no single-frame pose jump.
4. **Moonwalk regression check:** press W with the cursor behind the soldier — chest still points where he walks (original fix intact).

- [ ] **Step 3: Commit any tuning deltas**

If feel requires tuning (e.g. `MAX_TURN_RATE` 12.5 → 10), change constants only, re-run `bun run test`, and commit:

```bash
git add -A src/
git commit -m "tune(character): adjust turn/blend constants after playtest"
```

---

## Follow-up plans (separate documents, in spec delivery order)

2. GLTF soldiers + team skins (spec §4) — starts with asset inspection (clip names, bone names, size) before code.
3. Impact FX upgrade (spec §3).
4. Environment visual upgrade (spec §5).
