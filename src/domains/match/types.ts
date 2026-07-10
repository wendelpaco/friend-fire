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

/** Default match timing / win condition (seconds, rounds). CS-like. */
export const DEFAULT_MATCH = {
  warmup: 20,
  /** Freezetime / buy window before live combat (~CS 20s). */
  buyTime: 20,
  /** Live round length (~CS 1:55). */
  round: 115,
  /** First to this many rounds (MR24 → 13). */
  roundsToWin: 13,
  /** Short post-round banner before next buy. */
  endPause: 5,
  /** Match-finished pause (`match_over` phase) length. */
  endMatchPause: 10,
} as const;
