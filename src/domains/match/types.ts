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
  /** Buy / freezetime at start of each live round (normal rounds). */
  buyTime: number;
  /** Freezetime on round 1 and first round after half. */
  firstBuyTime: number;
  roundTime: number;
  endPause: number;
  roundsToWin: number;
  /** After this round completes, swap sides + eco reset (half). */
  halfAfterRound: number;
}

/** Default match timing / win condition (seconds, rounds). Sprint 1 B2/F2/F3. */
export const DEFAULT_MATCH = {
  /** Warmup: ~30s or until lobby full (early-start handled by room if any). */
  warmup: 30,
  /** Freezetime / buy window before live combat (normal rounds). */
  buyTime: 10,
  /** Round 1 + first round after side swap. */
  firstBuyTime: 12,
  /** Live round length (1:40). */
  round: 100,
  /** First to this many rounds (FT5 → max 9 natural). */
  roundsToWin: 5,
  /** Short post-round banner before next buy. */
  endPause: 5,
  /** Match-finished pause (`match_over` phase) length. */
  endMatchPause: 10,
  /** Half-time after this round number completes (F3). */
  halfAfterRound: 4,
} as const;
