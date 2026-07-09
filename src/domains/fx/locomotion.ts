import { DEFAULT_RUN_THRESHOLD, type LocomotionState } from "./types";

export { DEFAULT_RUN_THRESHOLD };

/**
 * Map horizontal speed (m/s) to locomotion anim state.
 * `speed < threshold` → idle; otherwise run.
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
