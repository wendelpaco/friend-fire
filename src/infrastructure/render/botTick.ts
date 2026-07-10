/**
 * Bot simulation rate by distance from the local player (W2 CPU budget).
 * Near bots stay full-rate; far bots step at lower Hz with accumulated dt.
 */

/** Full sim every frame within this range. */
export const BOT_NEAR_DIST = 18;
/** 15 Hz band up to this range; beyond = 8 Hz. */
export const BOT_MID_DIST = 32;

const INTERVAL_MID = 1 / 15;
const INTERVAL_FAR = 1 / 8;

/**
 * Seconds between bot AI/movement steps for a given distance.
 * `0` means every frame (use raw frame dt).
 */
export function botSimInterval(dist: number): number {
  if (!(dist >= 0) || !Number.isFinite(dist)) return 0;
  if (dist <= BOT_NEAR_DIST) return 0;
  if (dist <= BOT_MID_DIST) return INTERVAL_MID;
  return INTERVAL_FAR;
}

/**
 * Accumulator step: returns the dt to simulate, or `null` to skip this frame.
 * When interval is 0, always returns `frameDt` and clears accum.
 */
export function botAccumStep(
  accum: number,
  frameDt: number,
  interval: number,
): { stepDt: number; nextAccum: number } | null {
  const dt = frameDt > 0 && Number.isFinite(frameDt) ? frameDt : 0;
  if (interval <= 0) {
    return { stepDt: dt, nextAccum: 0 };
  }
  const next = accum + dt;
  if (next < interval) {
    return null;
  }
  // Cap step so a long hitch doesn't teleport bots
  const stepDt = Math.min(next, interval * 3);
  return { stepDt, nextAccum: 0 };
}
