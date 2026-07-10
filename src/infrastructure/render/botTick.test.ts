import { describe, expect, it } from "vitest";
import {
  BOT_MID_DIST,
  BOT_NEAR_DIST,
  botAccumStep,
  botSimInterval,
} from "./botTick";

describe("botSimInterval", () => {
  it("full rate near local player", () => {
    expect(botSimInterval(0)).toBe(0);
    expect(botSimInterval(BOT_NEAR_DIST)).toBe(0);
  });

  it("15 Hz mid band", () => {
    expect(botSimInterval(BOT_NEAR_DIST + 0.01)).toBeCloseTo(1 / 15, 5);
    expect(botSimInterval(BOT_MID_DIST)).toBeCloseTo(1 / 15, 5);
  });

  it("8 Hz far band", () => {
    expect(botSimInterval(BOT_MID_DIST + 0.01)).toBeCloseTo(1 / 8, 5);
    expect(botSimInterval(100)).toBeCloseTo(1 / 8, 5);
  });

  it("invalid dist is full rate", () => {
    expect(botSimInterval(Number.NaN)).toBe(0);
    expect(botSimInterval(-1)).toBe(0);
  });
});

describe("botAccumStep", () => {
  it("always runs when interval is 0", () => {
    expect(botAccumStep(0, 0.016, 0)).toEqual({
      stepDt: 0.016,
      nextAccum: 0,
    });
  });

  it("skips until accum reaches interval", () => {
    expect(botAccumStep(0, 0.016, 1 / 15)).toBeNull();
    const r = botAccumStep(0.06, 0.016, 1 / 15);
    expect(r).not.toBeNull();
    expect(r!.stepDt).toBeGreaterThan(0);
    expect(r!.nextAccum).toBe(0);
  });

  it("caps huge hitch steps", () => {
    const interval = 1 / 8;
    const r = botAccumStep(0, 2, interval);
    expect(r).not.toBeNull();
    expect(r!.stepDt).toBeLessThanOrEqual(interval * 3 + 1e-9);
  });
});
