import { describe, expect, it } from "vitest";
import {
  DEGRADE_ORDER,
  UPGRADE_ORDER,
  QualityController,
  TIER_MAX_LEVELS,
  knobsForTier,
  knobsFromLevels,
  targetMsForTier,
} from "./QualityController";

function makeClock(start = 10_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    set: (ms: number) => {
      t = ms;
    },
  };
}

describe("targetMsForTier", () => {
  it("low is Floor 22.2, others 16.7", () => {
    expect(targetMsForTier("low")).toBe(22.2);
    expect(targetMsForTier("medium")).toBe(16.7);
    expect(targetMsForTier("high")).toBe(16.7);
  });
});

describe("knobsForTier", () => {
  it("low has no shadows / dust and low DPR", () => {
    const k = knobsForTier("low");
    expect(k.shadowsEnabled).toBe(false);
    expect(k.dustCount).toBe(0);
    expect(k.maxPixelRatio).toBe(1);
    expect(k.propCastShadow).toBe(false);
  });

  it("medium matches laptop preset", () => {
    const k = knobsForTier("medium");
    expect(k.maxPixelRatio).toBe(1.25);
    expect(k.shadowsEnabled).toBe(true);
    expect(k.shadowMapSize).toBe(1024);
    expect(k.propCastShadow).toBe(false);
    expect(k.dustCount).toBe(100);
  });

  it("high unlocks soft shadows + prop cast + DPR 2", () => {
    const k = knobsForTier("high");
    expect(k.maxPixelRatio).toBe(2);
    expect(k.shadowType).toBe("pcfsoft");
    expect(k.propCastShadow).toBe(true);
    expect(k.dustCount).toBe(280);
  });

  it("never exceeds tier ceiling when building from max levels", () => {
    const high = knobsFromLevels(TIER_MAX_LEVELS.high);
    expect(high.maxPixelRatio).toBeLessThanOrEqual(2);
  });
});

describe("QualityController", () => {
  it("respects grace period — no degrade in first 3s", () => {
    const clock = makeClock(0);
    const c = new QualityController({ now: clock.now });
    c.setUserTier("high", 0);
    clock.advance(1000);
    const r = c.tick(
      { p50FrameMs: 40, p95FrameMs: 50 },
      { autoEnabled: true, userTierMax: "high" },
    );
    expect(r.changed).toBe(false);
    expect(r.reason).toBe("grace");
    expect(r.knobs.maxPixelRatio).toBe(2);
  });

  it("degrades along sacrifice order after streak + eval cadence", () => {
    const clock = makeClock(0);
    const c = new QualityController({ now: clock.now });
    c.setUserTier("high", 0);
    // Leave grace
    clock.advance(3100);

    // First eval: bad streak 1
    clock.advance(1000);
    let r = c.tick(
      { p50FrameMs: 20, p95FrameMs: 25 },
      { autoEnabled: true, userTierMax: "high" },
    );
    expect(r.changed).toBe(false);

    // Second eval: streak 2 → degrade first axis (fxBudget)
    clock.advance(1000);
    r = c.tick(
      { p50FrameMs: 20, p95FrameMs: 25 },
      { autoEnabled: true, userTierMax: "high" },
    );
    expect(r.changed).toBe(true);
    expect(r.reason).toBe("degrade");
    expect(r.levels.fxBudget).toBe(TIER_MAX_LEVELS.high.fxBudget - 1);
  });

  it("never exceeds user tier ceiling (medium)", () => {
    const clock = makeClock(0);
    const c = new QualityController({ now: clock.now });
    c.setUserTier("medium", 0);
    clock.advance(20_000);
    // Excellent metrics — cannot climb past medium
    for (let i = 0; i < 20; i++) {
      clock.advance(1000);
      c.tick(
        { p50FrameMs: 8, p95FrameMs: 10 },
        { autoEnabled: true, userTierMax: "medium" },
      );
    }
    const k = c.getKnobs();
    expect(k.maxPixelRatio).toBeLessThanOrEqual(1.25);
    expect(k.propCastShadow).toBe(false);
    expect(k.shadowMapSize).toBeLessThanOrEqual(1024);
  });

  it("auto off freezes to exact tier preset", () => {
    const clock = makeClock(0);
    const c = new QualityController({ now: clock.now });
    c.setUserTier("high", 0);
    clock.advance(10_000);
    // Force a degrade first
    for (let i = 0; i < 5; i++) {
      clock.advance(1000);
      c.tick(
        { p50FrameMs: 30, p95FrameMs: 40 },
        { autoEnabled: true, userTierMax: "high" },
      );
    }
    expect(c.getLevels().fxBudget).toBeLessThan(TIER_MAX_LEVELS.high.fxBudget);

    const r = c.tick(
      { p50FrameMs: 30, p95FrameMs: 40 },
      { autoEnabled: false, userTierMax: "medium" },
    );
    expect(r.changed).toBe(true);
    expect(r.knobs.maxPixelRatio).toBe(1.25);
    expect(r.knobs.dustCount).toBe(100);
    expect(r.levels).toEqual(TIER_MAX_LEVELS.medium);
  });

  it("does not adapt while document is hidden", () => {
    const clock = makeClock(0);
    const c = new QualityController({ now: clock.now });
    c.setUserTier("high", 0);
    clock.advance(10_000);
    const before = c.getLevels();
    clock.advance(1000);
    const r = c.tick(
      { p50FrameMs: 40, p95FrameMs: 50 },
      { autoEnabled: true, userTierMax: "high", documentHidden: true },
    );
    expect(r.changed).toBe(false);
    expect(c.getLevels()).toEqual(before);
  });

  it("upgrades after sustained headroom (and cooldown)", () => {
    const clock = makeClock(0);
    const c = new QualityController({ now: clock.now });
    c.setUserTier("high", 0);
    // Manually drop one level via degrades
    clock.advance(3100);
    for (let i = 0; i < 4; i++) {
      clock.advance(1000);
      c.tick(
        { p50FrameMs: 25, p95FrameMs: 30 },
        { autoEnabled: true, userTierMax: "high" },
      );
    }
    const mid = c.getLevels();
    expect(mid.fxBudget).toBeLessThan(TIER_MAX_LEVELS.high.fxBudget);

    // Wait cooldown after last degrade (4s) then good streak ×4
    clock.advance(4000);
    let upgraded = false;
    for (let i = 0; i < 10; i++) {
      clock.advance(1000);
      const r = c.tick(
        { p50FrameMs: 8, p95FrameMs: 10 },
        { autoEnabled: true, userTierMax: "high" },
      );
      if (r.changed && r.reason === "upgrade") {
        upgraded = true;
        break;
      }
    }
    expect(upgraded).toBe(true);
  });

  it("degrade and upgrade orders match design", () => {
    expect(DEGRADE_ORDER[0]).toBe("fxBudget");
    expect(DEGRADE_ORDER[DEGRADE_ORDER.length - 1]).toBe("propDetail");
    expect(UPGRADE_ORDER[0]).toBe("pixelRatio");
    expect(UPGRADE_ORDER[UPGRADE_ORDER.length - 1]).toBe("fxBudget");
  });
});
