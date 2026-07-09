import { describe, expect, it } from "vitest";
import { progressInTier, RANK_TIERS, xpToTier } from "./rank";

describe("RANK_TIERS", () => {
  it("has five tiers with expected thresholds", () => {
    expect(RANK_TIERS.map((t) => [t.name, t.minXp])).toEqual([
      ["Recruta", 0],
      ["Prata", 500],
      ["Ouro", 1500],
      ["Ás", 4000],
      ["Lenda", 10000],
    ]);
    expect(RANK_TIERS[RANK_TIERS.length - 1]!.nextXp).toBeNull();
  });
});

describe("xpToTier", () => {
  it("maps boundaries to the correct tier", () => {
    expect(xpToTier(0).id).toBe("recruta");
    expect(xpToTier(499).id).toBe("recruta");
    expect(xpToTier(500).id).toBe("prata");
    expect(xpToTier(1499).id).toBe("prata");
    expect(xpToTier(1500).id).toBe("ouro");
    expect(xpToTier(3999).id).toBe("ouro");
    expect(xpToTier(4000).id).toBe("as");
    expect(xpToTier(9999).id).toBe("as");
    expect(xpToTier(10000).id).toBe("lenda");
    expect(xpToTier(99999).id).toBe("lenda");
  });

  it("returns name, minXp, nextXp for mid tiers", () => {
    expect(xpToTier(750)).toEqual({
      id: "prata",
      name: "Prata",
      minXp: 500,
      nextXp: 1500,
    });
  });

  it("uses null nextXp at Lenda", () => {
    expect(xpToTier(10000).nextXp).toBeNull();
  });

  it("clamps negative / non-finite XP to Recruta", () => {
    expect(xpToTier(-10).id).toBe("recruta");
    expect(xpToTier(Number.NaN).id).toBe("recruta");
    expect(xpToTier(Number.POSITIVE_INFINITY).id).toBe("recruta");
  });
});

describe("progressInTier", () => {
  it("is 0 at tier floor and approaches 1 before next", () => {
    expect(progressInTier(0)).toBe(0);
    expect(progressInTier(500)).toBe(0);
    expect(progressInTier(250)).toBeCloseTo(0.5);
    expect(progressInTier(499)).toBeCloseTo(499 / 500);
    expect(progressInTier(1000)).toBeCloseTo(0.5); // Prata: (1000-500)/(1500-500)
  });

  it("stays in [0, 1]", () => {
    for (const xp of [0, 1, 250, 500, 1500, 4000, 9999, 10000, 50000]) {
      const p = progressInTier(xp);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("is 1 at max tier (Lenda)", () => {
    expect(progressInTier(10000)).toBe(1);
    expect(progressInTier(50000)).toBe(1);
  });
});
