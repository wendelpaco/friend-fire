import { describe, expect, it } from "vitest";
import { DEFAULT_MATCH } from "./types";
import { createMatchPhase, tickPhase, onRoundWin } from "./phases";

describe("match phases", () => {
  it("starts in warmup", () => {
    const m = createMatchPhase();
    expect(m.phase).toBe("warmup");
    expect(m.buyTime).toBe(DEFAULT_MATCH.buyTime);
  });

  it("warmup expiry enters buy for round 1", () => {
    let m = createMatchPhase({ warmupTime: 1 });
    m = tickPhase(m, 1.1);
    expect(m.phase).toBe("buy");
    expect(m.round).toBe(1);
    expect(m.timeLeft).toBe(DEFAULT_MATCH.buyTime);
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

  it("ended expiry enters buy for next round", () => {
    let m = createMatchPhase({ endPause: 1, buyTime: 15 });
    m = { ...m, phase: "ended", round: 2, timeLeft: 0.2 };
    m = tickPhase(m, 1);
    expect(m.phase).toBe("buy");
    expect(m.round).toBe(3);
    expect(m.timeLeft).toBe(15);
  });

  it("match_over when team reaches roundsToWin", () => {
    let m = createMatchPhase({ roundsToWin: 2 });
    m = { ...m, phase: "live", scoreTR: 1, round: 2 };
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
