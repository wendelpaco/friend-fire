/**
 * HUD publish policy (W3): throttle counters, never delay combat feedback.
 *
 * - Counters / minimap: ~12 Hz
 * - Perf overlay fields: refreshed at most ~4 Hz (caller may attach stale perf)
 * - Immediate: hit, damage flash, killfeed, UI modals, phase, plant/defuse, reload bar
 */

/** Counter / general HUD rate. */
export const HUD_COUNTER_HZ = 12;
export const HUD_COUNTER_MS = 1000 / HUD_COUNTER_HZ;

/** Perf overlay max rate (design §W3). */
export const HUD_PERF_HZ = 4;
export const HUD_PERF_MS = 1000 / HUD_PERF_HZ;

/** Fields that must flip React state immediately when they change. */
export type HudCriticalFields = {
  hp: number;
  armor: number;
  mag: number;
  reserve: number;
  money: number;
  weaponSlot: number;
  phase: string;
  round: number;
  scoreTR: number;
  scoreCT: number;
  alive: boolean;
  paused: boolean;
  showScoreboard: boolean;
  showHelp: boolean;
  showBuyMenu: boolean;
  hitMarker: boolean;
  reloading: boolean;
  lowAmmo: boolean;
  spectating: boolean;
  roundBanner: string | null;
  bombState: string;
  bombPrompt: string | null;
  buyMessage: string | null;
  /** Latest killfeed entry id (or length). */
  killFeedHead: string;
  chatHead: string;
  cameraMode: string;
  matchOver: boolean;
};

/** Continuous feedback that should stream while active (not only on edge). */
export type HudContinuousUrgent = {
  damageFlash: number;
  plantProgress: number;
  defuseProgress: number;
  reloading: boolean;
  hitMarker: boolean;
};

export function hudCriticalSignature(f: HudCriticalFields): string {
  return [
    f.hp,
    f.armor,
    f.mag,
    f.reserve,
    f.money,
    f.weaponSlot,
    f.phase,
    f.round,
    f.scoreTR,
    f.scoreCT,
    f.alive ? 1 : 0,
    f.paused ? 1 : 0,
    f.showScoreboard ? 1 : 0,
    f.showHelp ? 1 : 0,
    f.showBuyMenu ? 1 : 0,
    f.hitMarker ? 1 : 0,
    f.reloading ? 1 : 0,
    f.lowAmmo ? 1 : 0,
    f.spectating ? 1 : 0,
    f.roundBanner ?? "",
    f.bombState,
    f.bombPrompt ?? "",
    f.buyMessage ?? "",
    f.killFeedHead,
    f.chatHead,
    f.cameraMode,
    f.matchOver ? 1 : 0,
  ].join("|");
}

export function isHudContinuousUrgent(c: HudContinuousUrgent): boolean {
  if (c.hitMarker) return true;
  if (c.reloading) return true;
  if (c.damageFlash > 0.02) return true;
  if (c.plantProgress > 0.001) return true;
  if (c.defuseProgress > 0.001) return true;
  return false;
}

/**
 * Whether to call the React HUD listener this frame.
 */
export function shouldPublishHud(opts: {
  now: number;
  lastPublishAt: number;
  criticalSig: string;
  lastCriticalSig: string;
  continuousUrgent: boolean;
}): boolean {
  if (opts.criticalSig !== opts.lastCriticalSig) return true;
  if (opts.continuousUrgent) return true;
  if (opts.lastPublishAt <= 0) return true;
  return opts.now - opts.lastPublishAt >= HUD_COUNTER_MS;
}

/** Whether to rebuild perf block (else reuse last published perf). */
export function shouldRefreshPerf(
  now: number,
  lastPerfAt: number,
  showFps: boolean,
): boolean {
  if (!showFps) return false;
  if (lastPerfAt <= 0) return true;
  return now - lastPerfAt >= HUD_PERF_MS;
}
