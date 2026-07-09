export type { Team } from "@/shared/types/team";

export type RoundPhase = "warmup" | "live" | "ended" | "match_over";

export interface MatchPhaseState {
  phase: RoundPhase;
  round: number;
  timeLeft: number;
  scoreTR: number;
  scoreCT: number;
  warmupTime: number;
  roundTime: number;
  endPause: number;
  roundsToWin: number;
}

/** Default match timing / win condition (seconds, rounds). */
export const DEFAULT_MATCH = {
  warmup: 20,
  round: 90,
  roundsToWin: 8,
  /** Round intermission (`ended` phase) length. */
  endPause: 5,
  /** Match-finished pause (`match_over` phase) length. */
  endMatchPause: 8,
} as const;
