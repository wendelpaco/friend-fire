import { describe, expect, it } from "vitest";
import { DEFAULT_MATCH } from "./types";
import {
  buyTimeForRound,
  createMatchPhase,
  enterBuyPhase,
  isPostHalfBuyRound,
  onRoundWin,
  tickPhase,
} from "./phases";

describe("match phases", () => {
  it("starts in warmup with Sprint 1 defaults", () => {
    const m = createMatchPhase();
    expect(m.phase).toBe("warmup");
    expect(m.buyTime).toBe(DEFAULT_MATCH.buyTime);
    expect(m.firstBuyTime).toBe(DEFAULT_MATCH.firstBuyTime);
    expect(m.roundTime).toBe(DEFAULT_MATCH.round);
    expect(m.roundsToWin).toBe(DEFAULT_MATCH.roundsToWin);
    expect(m.halfAfterRound).toBe(DEFAULT_MATCH.halfAfterRound);
    expect(m.warmupTime).toBe(DEFAULT_MATCH.warmup);
  });

  it("buyTimeForRound uses 12s on round 1 and post-half", () => {
    const m = createMatchPhase();
    expect(buyTimeForRound(m, 1)).toBe(12);
    expect(buyTimeForRound(m, 5)).toBe(12); // half after 4
    expect(buyTimeForRound(m, 2)).toBe(10);
    expect(buyTimeForRound(m, 3)).toBe(10);
    expect(buyTimeForRound(m, 4)).toBe(10);
    expect(buyTimeForRound(m, 6)).toBe(10);
    expect(isPostHalfBuyRound(m, 5)).toBe(true);
    expect(isPostHalfBuyRound(m, 1)).toBe(false);
  });

  it("warmup expiry enters buy for round 1 with 12s freezetime", () => {
    let m = createMatchPhase({ warmupTime: 1 });
    m = tickPhase(m, 1.1);
    expect(m.phase).toBe("buy");
    expect(m.round).toBe(1);
    expect(m.timeLeft).toBe(DEFAULT_MATCH.firstBuyTime);
  });

  it("buy expiry starts live combat", () => {
    let m = createMatchPhase({ buyTime: 2 });
    m = { ...m, phase: "buy", round: 1, timeLeft: 0.5 };
    m = tickPhase(m, 1);
    expect(m.phase).toBe("live");
    expect(m.round).toBe(1);
    expect(m.timeLeft).toBe(m.roundTime);
  });

  it("round win increments score and enters ended", () => {
    let m = createMatchPhase();
    m = { ...m, phase: "live", round: 1 };
    m = onRoundWin(m, "TR");
    expect(m.scoreTR).toBe(1);
    expect(m.phase).toBe("ended");
    expect(m.timeLeft).toBe(DEFAULT_MATCH.endPause);
  });

  it("ended after round 4 enters buy round 5 with 12s freezetime", () => {
    let m = createMatchPhase({ endPause: 1 });
    m = { ...m, phase: "ended", round: 4, timeLeft: 0.2 };
    m = tickPhase(m, 1);
    expect(m.phase).toBe("buy");
    expect(m.round).toBe(5);
    expect(m.timeLeft).toBe(DEFAULT_MATCH.firstBuyTime);
  });

  it("ended expiry enters buy for next mid-round with normal buy time", () => {
    let m = createMatchPhase({ endPause: 1, buyTime: 10 });
    m = { ...m, phase: "ended", round: 2, timeLeft: 0.2 };
    m = tickPhase(m, 1);
    expect(m.phase).toBe("buy");
    expect(m.round).toBe(3);
    expect(m.timeLeft).toBe(10);
  });

  it("enterBuyPhase sets round and freezetime", () => {
    const m = createMatchPhase();
    const buy = enterBuyPhase(m, 2);
    expect(buy.phase).toBe("buy");
    expect(buy.round).toBe(2);
    expect(buy.timeLeft).toBe(DEFAULT_MATCH.buyTime);
  });

  it("match_over when team reaches roundsToWin (FT5)", () => {
    let m = createMatchPhase({ roundsToWin: 5 });
    m = { ...m, phase: "live", scoreTR: 4, round: 8 };
    m = onRoundWin(m, "TR");
    expect(m.phase).toBe("match_over");
    expect(m.timeLeft).toBe(DEFAULT_MATCH.endMatchPause);
  });

  it("live timer expiry awards CT win", () => {
    let m = createMatchPhase({ roundTime: 1 });
    m = { ...m, phase: "live", round: 1, timeLeft: 0.5 };
    m = tickPhase(m, 1);
    expect(m.phase).toBe("ended");
    expect(m.scoreCT).toBe(1);
    expect(m.scoreTR).toBe(0);
  });
});
