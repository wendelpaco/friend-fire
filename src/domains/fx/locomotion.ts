import { DEFAULT_RUN_THRESHOLD, type LocomotionState } from "./types";

export { DEFAULT_RUN_THRESHOLD };

/**
 * Directional locomotion for top-down shooters.
 * Derived from the angle between **move vector** and **model facing**.
 */
export type LocomotionDir =
  | "idle"
  | "forward"
  | "backward"
  | "strafeLeft"
  | "strafeRight";

/** Blend weights for procedural / mixer clips (sum ≤ 1 for locomotor channels). */
export type LocomotionWeights = {
  idle: number;
  forward: number;
  backward: number;
  strafeLeft: number;
  strafeRight: number;
};

/**
 * Map horizontal speed (m/s) to coarse locomotion anim state.
 * Kept for backward compatibility (idle | run).
 */
export function locomotionFromSpeed(
  speed: number,
  threshold: number = DEFAULT_RUN_THRESHOLD,
): LocomotionState {
  if (!Number.isFinite(speed) || speed < threshold) return "idle";
  return "run";
}

/**
 * Horizontal speed from position delta over dt (seconds).
 * Returns 0 for non-positive dt.
 */
export function horizontalSpeed(
  dx: number,
  dz: number,
  dt: number,
): number {
  if (!(dt > 0) || !Number.isFinite(dt)) return 0;
  return Math.hypot(dx, dz) / dt;
}

/** Convenience: delta position → idle|run. */
export function locomotionFromDelta(
  dx: number,
  dz: number,
  dt: number,
  threshold: number = DEFAULT_RUN_THRESHOLD,
): LocomotionState {
  return locomotionFromSpeed(horizontalSpeed(dx, dz, dt), threshold);
}

// ─── Facing / orientation (the “walks forward but shows back” fix) ─────────

/**
 * Yaw (radians) so that **local +Z** points at world direction `(dx, dz)`.
 *
 * Three.js Y-up: after `object.rotation.y = yawFromDirection(dx, dz)`,
 * local +Z maps to world `(sin(yaw), cos(yaw))` on XZ.
 *
 * Game convention (Friend Fire): aim/move use the same
 * `dirX = sin(yaw)`, `dirZ = cos(yaw)`.
 *
 * GLTF note: many Mixamo/ReadyPlayerMe models face **−Z**. For those,
 * use `yawFromDirection(dx, dz) + MODEL_YAW_OFFSET` with
 * `MODEL_YAW_OFFSET = Math.PI`. Our procedural rig faces **+Z** (vest on +Z),
 * so offset is **0**.
 */
export function yawFromDirection(dx: number, dz: number): number {
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return 0;
  if (dx === 0 && dz === 0) return 0;
  return Math.atan2(dx, dz);
}

/**
 * Shortest signed delta from `from` to `to` in (−π, π].
 */
export function deltaAngle(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Exponential-ish smooth yaw toward target (frame-rate independent).
 * @param lambda higher = snappier (≈12 feels responsive for soldiers)
 */
export function smoothYaw(
  current: number,
  target: number,
  dt: number,
  lambda = 12,
): number {
  if (!(dt > 0)) return current;
  const d = deltaAngle(current, target);
  const t = 1 - Math.exp(-lambda * dt);
  return current + d * t;
}

/**
 * **Body facing policy** (fixes moonwalk / “de costas”):
 *
 * - Moving (`speed ≥ threshold`): face **velocity** so the chest points
 *   where the feet go. Pressing W never shows the back of the model.
 * - Idle / nearly stopped: face **aim** so the gun stays on the crosshair.
 *
 * Shooting still uses `aimYaw` in the sim; only the visual root uses this.
 */
export function bodyYawTarget(
  moveX: number,
  moveZ: number,
  aimYaw: number,
  speedThreshold: number = DEFAULT_RUN_THRESHOLD,
): number {
  const speed = Math.hypot(moveX, moveZ);
  if (!Number.isFinite(speed) || speed < speedThreshold) {
    return aimYaw;
  }
  return yawFromDirection(moveX, moveZ);
}

/**
 * Rotate world XZ velocity into the model's local frame
 * (facing = local +Z).
 *
 * localForward (+Z) = (sin f, cos f)
 * localRight   (+X) = (cos f, −sin f)
 *
 * @returns `{ forward, right }` in model space (m/s if move is m/s)
 */
export function moveInFacingSpace(
  moveX: number,
  moveZ: number,
  facingYaw: number,
): { forward: number; right: number } {
  const s = Math.sin(facingYaw);
  const c = Math.cos(facingYaw);
  // project move onto facing basis
  const forward = moveX * s + moveZ * c;
  const right = moveX * c - moveZ * s;
  return { forward, right };
}

/**
 * Discrete locomotion bucket from local move (for simple state machines).
 */
export function locomotionDirFromLocal(
  forward: number,
  right: number,
  threshold: number = DEFAULT_RUN_THRESHOLD,
): LocomotionDir {
  const speed = Math.hypot(forward, right);
  if (!Number.isFinite(speed) || speed < threshold) return "idle";

  // Dominant axis decides; ties prefer forward/back over strafe.
  if (Math.abs(forward) >= Math.abs(right)) {
    return forward >= 0 ? "forward" : "backward";
  }
  return right >= 0 ? "strafeRight" : "strafeLeft";
}

/**
 * Soft blend weights from local move — suitable for AnimationMixer or
 * procedural pose lerp. Uses a radial basis so diagonals mix forward+strafe.
 */
export function locomotionWeights(
  moveX: number,
  moveZ: number,
  facingYaw: number,
  threshold: number = DEFAULT_RUN_THRESHOLD,
): LocomotionWeights {
  const { forward, right } = moveInFacingSpace(moveX, moveZ, facingYaw);
  const speed = Math.hypot(forward, right);

  const empty: LocomotionWeights = {
    idle: 1,
    forward: 0,
    backward: 0,
    strafeLeft: 0,
    strafeRight: 0,
  };

  if (!Number.isFinite(speed) || speed < threshold) {
    return empty;
  }

  // Unit direction in local space
  const f = forward / speed;
  const r = right / speed;

  // Positive parts only (each quadrant)
  const fw = Math.max(0, f);
  const bw = Math.max(0, -f);
  const sr = Math.max(0, r);
  const sl = Math.max(0, -r);

  // Normalize so locomotor weights sum to 1 (idle = 0 while moving)
  const sum = fw + bw + sr + sl || 1;

  return {
    idle: 0,
    forward: fw / sum,
    backward: bw / sum,
    strafeRight: sr / sum,
    strafeLeft: sl / sum,
  };
}

/**
 * Procedural rig faces +Z. GLTF humanoids often face −Z → use `Math.PI`.
 */
export const MODEL_YAW_OFFSET_PROCEDURAL = 0;
export const MODEL_YAW_OFFSET_GLTF_NEG_Z = Math.PI;
