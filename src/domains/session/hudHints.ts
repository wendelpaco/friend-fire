/**
 * Contextual control-strip onboarding (Sprint 1 HUD cleanup).
 * Show key hints for the first N rounds played, then only while
 * holding TAB (scoreboard) or when help is open.
 */

export const CONTROL_HINTS_MAX_ROUNDS = 2;
export const CONTROL_HINTS_LS_KEY = "ff_control_hints_rounds_played";

export function shouldShowControlHints(opts: {
  roundsPlayed: number;
  scoreboardHeld: boolean;
  helpOpen: boolean;
}): boolean {
  if (opts.helpOpen || opts.scoreboardHeld) return true;
  return opts.roundsPlayed < CONTROL_HINTS_MAX_ROUNDS;
}

/**
 * Bump onboarding counter when a live round completes.
 * Counts live → ended (mid-match) and live → match_over (deciding round).
 * Caps at CONTROL_HINTS_MAX_ROUNDS so storage stays small.
 */
export function bumpRoundsPlayedOnPhase(
  roundsPlayed: number,
  prevPhase: string | null | undefined,
  nextPhase: string,
): number {
  const n = Number.isFinite(roundsPlayed) ? Math.max(0, Math.floor(roundsPlayed)) : 0;
  if (
    prevPhase === "live" &&
    (nextPhase === "ended" || nextPhase === "match_over")
  ) {
    return Math.min(n + 1, CONTROL_HINTS_MAX_ROUNDS);
  }
  return n;
}

export function readRoundsPlayed(
  storage?: Pick<Storage, "getItem"> | null,
): number {
  if (!storage) return 0;
  try {
    const raw = storage.getItem(CONTROL_HINTS_LS_KEY);
    const n = Number(raw ?? "0");
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  } catch {
    return 0;
  }
}

export function writeRoundsPlayed(
  n: number,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  if (!storage) return;
  try {
    const v = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
    storage.setItem(CONTROL_HINTS_LS_KEY, String(v));
  } catch {
    /* private mode / quota */
  }
}
