/**
 * Server mirror of domains/combat/accuracy.ts — keep formulas in sync.
 * Pure; used by GameRoom hitscan for movement/bloom aim error.
 * Crouch mult removed (F4 / Sprint 1 gunfeel pack).
 */

export const STOP_SPEED_FRACTION = 0.12;
export const AIR_INACCURACY = 3.0;
/** Stop-shoot recovery window when fully stopped (ms). */
export const STOP_SHOOT_RECOVERY_MS = 100;
export const DEFAULT_MAX_BLOOM_SHOTS = 10;

export type AccuracyInput = {
  speed: number;
  standSpeed: number;
  airborne: boolean;
  shotsInBurst: number;
  msSinceLastShot: number;
};

export type AccuracyKnobs = {
  spread: number;
  firstShotSpread: number;
  bloomPerShot: number;
  recoveryMs: number;
  moveInaccuracyScale: number;
  maxBloomShots: number;
};

export type AccuracyWeaponSource = {
  id?: string;
  slot?: number;
  spread?: number;
  firstShotSpread?: number;
  bloomPerShot?: number;
  recoveryMs?: number;
  moveInaccuracyScale?: number;
  maxBloomShots?: number;
};

function defaultRecoveryMs(w: AccuracyWeaponSource): number {
  if (w.id === "awp") return 500;
  if (w.slot === 2) return 180;
  return 280;
}

function defaultMoveScale(w: AccuracyWeaponSource): number {
  if (w.id === "awp") return 1.8;
  if (w.id === "mp5") return 0.7;
  return 1;
}

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

export function movementFactor(speed: number, standSpeed: number): number {
  if (!(standSpeed > 0) || !(speed > 0)) return 0;
  if (speed < STOP_SPEED_FRACTION * standSpeed) return 0;
  return Math.min(1, speed / standSpeed);
}

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

export function shotSpreadRadians(
  input: AccuracyInput,
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

export function applySpreadToYaw(
  yaw: number,
  spread: number,
  rng: () => number = Math.random,
): number {
  if (!(spread > 0)) return yaw;
  const offset = (rng() * 2 - 1) * spread;
  return yaw + offset;
}

export function nextShotsInBurst(
  shotsInBurst: number,
  msSinceLastShot: number,
  recoveryMs: number,
): number {
  if (msSinceLastShot >= recoveryMs) return 1;
  return Math.max(0, shotsInBurst) + 1;
}
