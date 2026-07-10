/**
 * Shared gunfight accuracy model (CS-lite top-down).
 * Pure — used by offline GameClient and mirrored on the server hitscan path.
 *
 * σ = σ_shot · (1 + k_move · m) · m_air
 * See docs/superpowers/specs/2026-07-09-cs-mechanics-v1-design.md §4.
 * Crouch mult removed (F4 / Sprint 1 gunfeel pack).
 */

import type { WeaponDef, WeaponId } from "./types";
import { WEAPONS } from "./weapons";

/** Speed below this fraction of standSpeed counts as fully stopped (m = 0). */
export const STOP_SPEED_FRACTION = 0.12;
/** Airborne inaccuracy multiplier. */
export const AIR_INACCURACY = 3.0;
/**
 * When fully stopped, recovery to first-shot collapses in this window (ms).
 * Counter-strafe / stop-shoot skill (Sprint 1 gunfeel).
 */
export const STOP_SHOOT_RECOVERY_MS = 100;
/** Cap bloom stacks so long sprays don't grow without bound. */
export const DEFAULT_MAX_BLOOM_SHOTS = 10;

export type AccuracyInput = {
  weaponId: WeaponId;
  /** Horizontal speed m/s */
  speed: number;
  /** Run cap m/s */
  standSpeed: number;
  airborne: boolean;
  /** Shots already fired in the current burst (0 = about to fire first). */
  shotsInBurst: number;
  msSinceLastShot: number;
};

/** Resolved knobs after defaults (§4.3). */
export type AccuracyKnobs = {
  spread: number;
  firstShotSpread: number;
  bloomPerShot: number;
  recoveryMs: number;
  moveInaccuracyScale: number;
  maxBloomShots: number;
};

/** Minimal weapon shape for resolving knobs (client WeaponDef or server stats). */
export type AccuracyWeaponSource = {
  id?: string;
  slot?: number;
  spread: number;
  firstShotSpread?: number;
  bloomPerShot?: number;
  recoveryMs?: number;
  moveInaccuracyScale?: number;
  maxBloomShots?: number;
};

function defaultRecoveryMs(w: AccuracyWeaponSource): number {
  if (w.id === "awp") return 500;
  if (w.slot === 2) return 180; // pistols
  return 280; // rifles / SMG / default
}

function defaultMoveScale(w: AccuracyWeaponSource): number {
  if (w.id === "awp") return 1.8;
  if (w.id === "mp5") return 0.7;
  return 1;
}

/** Resolve optional WeaponDef / server knobs with §4.3 defaults. */
export function resolveAccuracyKnobs(w: AccuracyWeaponSource): AccuracyKnobs {
  const spread = w.spread ?? 0;
  return {
    spread,
    firstShotSpread: w.firstShotSpread ?? spread * 0.25,
    bloomPerShot: w.bloomPerShot ?? spread * 0.15,
    recoveryMs: w.recoveryMs ?? defaultRecoveryMs(w),
    moveInaccuracyScale: w.moveInaccuracyScale ?? defaultMoveScale(w),
    maxBloomShots: w.maxBloomShots ?? DEFAULT_MAX_BLOOM_SHOTS,
  };
}

export function knobsForWeapon(weaponId: WeaponId): AccuracyKnobs {
  return resolveAccuracyKnobs(WEAPONS[weaponId] as WeaponDef);
}

/**
 * Movement factor m ∈ [0, 1]. Full stop when speed < 0.12 · standSpeed.
 */
export function movementFactor(speed: number, standSpeed: number): number {
  if (!(standSpeed > 0) || !(speed > 0)) return 0;
  if (speed < STOP_SPEED_FRACTION * standSpeed) return 0;
  return Math.min(1, speed / standSpeed);
}

/**
 * Effective recovery window: while fully stopped, first-shot returns in
 * {@link STOP_SHOOT_RECOVERY_MS} (or weapon recovery if shorter).
 */
export function effectiveRecoveryMs(
  knobs: AccuracyKnobs,
  speed: number,
  standSpeed: number,
): number {
  const m = movementFactor(speed, standSpeed);
  if (m <= 0) {
    return Math.min(knobs.recoveryMs, STOP_SHOOT_RECOVERY_MS);
  }
  return knobs.recoveryMs;
}

/**
 * Radians of aim error (half-angle); 0 = perfect aim.
 */
export function shotSpreadRadians(input: AccuracyInput): number {
  const knobs = knobsForWeapon(input.weaponId);
  return shotSpreadRadiansWithKnobs(input, knobs);
}

/**
 * Same formula with explicit knobs (server mirror / tests without WEAPONS table).
 */
export function shotSpreadRadiansWithKnobs(
  input: Omit<AccuracyInput, "weaponId"> & { weaponId?: WeaponId },
  knobs: AccuracyKnobs,
): number {
  if (knobs.spread <= 0 && knobs.firstShotSpread <= 0) return 0;

  const recoveryMs = effectiveRecoveryMs(
    knobs,
    input.speed,
    input.standSpeed,
  );
  const recovered = input.msSinceLastShot >= recoveryMs;
  const burst = recovered ? 0 : Math.max(0, input.shotsInBurst);

  const sigmaShot =
    burst === 0
      ? knobs.firstShotSpread
      : knobs.spread +
        knobs.bloomPerShot * Math.min(burst, knobs.maxBloomShots);

  const m = movementFactor(input.speed, input.standSpeed);
  const mAir = input.airborne ? AIR_INACCURACY : 1;

  return sigmaShot * (1 + knobs.moveInaccuracyScale * m) * mAir;
}

/**
 * World-space radius of the half-angle cone at a given aim distance.
 * Used by the ground dispersion circle.
 */
export function spreadWorldRadius(
  spreadRadians: number,
  aimDistance: number,
): number {
  if (!(spreadRadians > 0) || !(aimDistance > 0)) return 0;
  return Math.tan(spreadRadians) * aimDistance;
}

/**
 * Offset yaw by uniform error in [-spread, +spread] (half-angle cone).
 */
export function applySpreadToYaw(
  yaw: number,
  spread: number,
  rng: () => number = Math.random,
): number {
  if (!(spread > 0)) return yaw;
  const u = rng();
  const offset = (u * 2 - 1) * spread;
  return yaw + offset;
}

/**
 * Burst counter after a shot is fired (recovery resets to 1).
 */
export function nextShotsInBurst(
  shotsInBurst: number,
  msSinceLastShot: number,
  recoveryMs: number,
): number {
  if (msSinceLastShot >= recoveryMs) return 1;
  return Math.max(0, shotsInBurst) + 1;
}
