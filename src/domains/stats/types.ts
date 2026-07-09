/** Match end outcome for local player. */
export type MatchResult = "win" | "loss" | "draw";

/** One finished match stored in `ff_match_history`. */
export interface MatchHistoryEntry {
  /** Unix ms when the match was recorded. */
  at: number;
  nickname: string;
  kills: number;
  deaths: number;
  /** End-of-match money (optional). */
  money?: number;
  result: MatchResult;
  /** Map display name or id. */
  map: string;
}

/** Input for appending a match (timestamp optional). */
export interface AppendMatchInput {
  nickname: string;
  kills: number;
  deaths: number;
  money?: number;
  result: MatchResult;
  map: string;
  at?: number;
}

/** One player row on the daily local leaderboard. */
export interface LeaderboardEntry {
  nickname: string;
  kills: number;
  wins: number;
  matches: number;
}

/** Persisted daily leaderboard snapshot (resets when dayKey changes). */
export interface LeaderboardState {
  dayKey: string;
  entries: LeaderboardEntry[];
}

/** Input for upserting local player stats after match_over. */
export interface UpsertPlayerStatsInput {
  nickname: string;
  kills: number;
  /** When true, increments wins by 1. */
  won: boolean;
}
