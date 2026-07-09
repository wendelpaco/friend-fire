export type { Team } from "@/shared/types/team";

/**
 * Match lifecycle:
 * warmup → buy → live → ended (banner) → buy → live → … → match_over
 */
export type RoundPhase =
  | "warmup"
  | "buy"
  | "live"
  | "ended"
  | "match_over";

export interface MatchPhaseState {
  phase: RoundPhase;
  round: number;
  timeLeft: number;
  scoreTR: number;
  scoreCT: number;
  warmupTime: number;
  /** Buy / freezetime at start of each live round. */
  buyTime: number;
  roundTime: number;
  endPause: number;
  roundsToWin: number;
}

/** Default match timing / win condition (seconds, rounds). */
export const DEFAULT_MATCH = {
  warmup: 20,
  /** CS-style freezetime / buy window before live combat. */
  buyTime: 18,
  round: 90,
  roundsToWin: 8,
  /** Short post-round banner before next buy. */
  endPause: 4,
  /** Match-finished pause (`match_over` phase) length. */
  endMatchPause: 8,
} as const;
