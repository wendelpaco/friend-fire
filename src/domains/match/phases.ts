import type { Team } from "@/shared/types/team";
import { DEFAULT_MATCH, type MatchPhaseState } from "./types";

export type { RoundPhase, MatchPhaseState } from "./types";

/** Round intermission length (seconds). Match-over break uses DEFAULT_MATCH.endMatchPause in UI (Task 5). */
const DEFAULT_END_PAUSE = 5;

export function createMatchPhase(
  opts?: Partial<
    Pick<MatchPhaseState, "warmupTime" | "roundTime" | "endPause" | "roundsToWin">
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
    roundTime: opts?.roundTime ?? DEFAULT_MATCH.round,
    endPause: opts?.endPause ?? DEFAULT_END_PAUSE,
    roundsToWin: opts?.roundsToWin ?? DEFAULT_MATCH.roundsToWin,
  };
}

export function tickPhase(m: MatchPhaseState, dt: number): MatchPhaseState {
  if (m.phase === "match_over") return m;
  const timeLeft = m.timeLeft - dt;
  if (timeLeft > 0) return { ...m, timeLeft };

  if (m.phase === "warmup") {
    return {
      ...m,
      phase: "live",
      round: m.round + 1,
      timeLeft: m.roundTime,
    };
  }
  if (m.phase === "live") {
    // timer expired → CT wins (defuse default)
    return onRoundWin({ ...m, timeLeft: 0 }, "CT");
  }
  if (m.phase === "ended") {
    return {
      ...m,
      phase: "live",
      round: m.round + 1,
      timeLeft: m.roundTime,
    };
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
      timeLeft: m.endPause,
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
