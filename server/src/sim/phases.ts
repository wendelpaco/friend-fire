/**
 * Keep in sync with src/domains/match/phases.ts + types.ts
 * Minimal pure phase timer for server tick.
 */

export type Team = "TR" | "CT";
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
  buyTime: number;
  roundTime: number;
  endPause: number;
  roundsToWin: number;
}

export const DEFAULT_MATCH = {
  warmup: 20,
  buyTime: 18,
  round: 90,
  roundsToWin: 8,
  endPause: 4,
  endMatchPause: 8,
} as const;

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

export function tickPhase(m: MatchPhaseState, dt: number): MatchPhaseState {
  if (m.phase === "match_over") return m;
  const timeLeft = m.timeLeft - dt;
  if (timeLeft > 0) return { ...m, timeLeft };

  if (m.phase === "warmup") {
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
    return onRoundWin({ ...m, timeLeft: 0 }, "CT");
  }
  if (m.phase === "ended") {
    return enterBuyPhase(m, m.round + 1);
  }
  return m;
}
