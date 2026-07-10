import type { Team } from "@/shared/types/team";
import { DEFAULT_MATCH, type MatchPhaseState } from "./types";

export type { RoundPhase, MatchPhaseState } from "./types";

export function createMatchPhase(
  opts?: Partial<
    Pick<
      MatchPhaseState,
      | "warmupTime"
      | "buyTime"
      | "firstBuyTime"
      | "roundTime"
      | "endPause"
      | "roundsToWin"
      | "halfAfterRound"
    >
  >,
): MatchPhaseState {
  const warmupTime = opts?.warmupTime ?? DEFAULT_MATCH.warmup;
  return {
    phase: "warmup",
    round: 0,
    timeLeft: warmupTime,
    scoreTR: 0,
    scoreCT: 0,
    warmupTime,
    buyTime: opts?.buyTime ?? DEFAULT_MATCH.buyTime,
    firstBuyTime: opts?.firstBuyTime ?? DEFAULT_MATCH.firstBuyTime,
    roundTime: opts?.roundTime ?? DEFAULT_MATCH.round,
    endPause: opts?.endPause ?? DEFAULT_MATCH.endPause,
    roundsToWin: opts?.roundsToWin ?? DEFAULT_MATCH.roundsToWin,
    halfAfterRound: opts?.halfAfterRound ?? DEFAULT_MATCH.halfAfterRound,
  };
}

/**
 * Freezetime length for a given round number.
 * Round 1 and first post-half (halfAfterRound+1) use firstBuyTime (12s).
 */
export function buyTimeForRound(
  m: Pick<MatchPhaseState, "buyTime" | "firstBuyTime" | "halfAfterRound">,
  round: number,
): number {
  const r = Math.floor(round);
  if (r === 1 || r === m.halfAfterRound + 1) {
    return m.firstBuyTime;
  }
  return m.buyTime;
}

/** True when entering buy for the first round after half (side swap + eco reset). */
export function isPostHalfBuyRound(
  m: Pick<MatchPhaseState, "halfAfterRound">,
  round: number,
): boolean {
  return Math.floor(round) === m.halfAfterRound + 1;
}

/**
 * Enter buy phase for the next round number (assigns money outside).
 * Uses extended freezetime on round 1 and post-half.
 */
export function enterBuyPhase(
  m: MatchPhaseState,
  nextRound: number,
): MatchPhaseState {
  return {
    ...m,
    phase: "buy",
    round: nextRound,
    timeLeft: buyTimeForRound(m, nextRound),
  };
}

export function tickPhase(m: MatchPhaseState, dt: number): MatchPhaseState {
  if (m.phase === "match_over") return m;
  const timeLeft = m.timeLeft - dt;
  if (timeLeft > 0) return { ...m, timeLeft };

  if (m.phase === "warmup") {
    // Warmup done → first buy window then live combat
    return enterBuyPhase(m, 1);
  }
  if (m.phase === "buy") {
    return {
      ...m,
      phase: "live",
      timeLeft: m.roundTime,
    };
  }
  if (m.phase === "live") {
    // timer expired → CT wins (defuse default)
    return onRoundWin({ ...m, timeLeft: 0 }, "CT");
  }
  if (m.phase === "ended") {
    // Banner done → buy for next round
    return enterBuyPhase(m, m.round + 1);
  }
  return m;
}

export function onRoundWin(m: MatchPhaseState, winner: Team): MatchPhaseState {
  const scoreTR = m.scoreTR + (winner === "TR" ? 1 : 0);
  const scoreCT = m.scoreCT + (winner === "CT" ? 1 : 0);
  if (scoreTR >= m.roundsToWin || scoreCT >= m.roundsToWin) {
    return {
      ...m,
      scoreTR,
      scoreCT,
      phase: "match_over",
      timeLeft: DEFAULT_MATCH.endMatchPause,
    };
  }
  return {
    ...m,
    scoreTR,
    scoreCT,
    phase: "ended",
    timeLeft: m.endPause,
  };
}
