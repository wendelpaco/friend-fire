import type { Team } from "@/shared/types/team";
import { DEFAULT_MATCH, type MatchPhaseState } from "./types";

export type { RoundPhase, MatchPhaseState } from "./types";

export function createMatchPhase(
  opts?: Partial<
    Pick<
      MatchPhaseState,
      | "warmupTime"
      | "buyTime"
      | "roundTime"
      | "endPause"
      | "roundsToWin"
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
    roundTime: opts?.roundTime ?? DEFAULT_MATCH.round,
    endPause: opts?.endPause ?? DEFAULT_MATCH.endPause,
    roundsToWin: opts?.roundsToWin ?? DEFAULT_MATCH.roundsToWin,
  };
}

/**
 * Enter buy phase for the next round number (assigns money outside).
 */
export function enterBuyPhase(
  m: MatchPhaseState,
  nextRound: number,
): MatchPhaseState {
  return {
    ...m,
    phase: "buy",
    round: nextRound,
    timeLeft: m.buyTime,
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
