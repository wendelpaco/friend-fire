import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPERATOR_ID,
  OPERATORS,
  SKINS,
  getOperator,
  getSkin,
  operatorsByGender,
  resolveSkinColors,
  skinsForOperator,
} from "./catalog";

describe("operator catalog", () => {
  it("ships 4 operators × 2 skins", () => {
    expect(OPERATORS).toHaveLength(4);
    expect(SKINS).toHaveLength(8);
    for (const op of OPERATORS) {
      expect(skinsForOperator(op.id)).toHaveLength(2);
      expect(getSkin(op.defaultSkinId)?.operatorId).toBe(op.id);
    }
  });

  it("has two masc and two fem", () => {
    expect(operatorsByGender("masc").map((o) => o.id)).toEqual([
      "brick",
      "rook",
    ]);
    expect(operatorsByGender("fem").map((o) => o.id)).toEqual([
      "vesper",
      "nyx",
    ]);
    expect(operatorsByGender("all")).toHaveLength(4);
  });

  it("defaults to first masc (brick)", () => {
    expect(DEFAULT_OPERATOR_ID).toBe("brick");
    expect(getOperator(DEFAULT_OPERATOR_ID)?.gender).toBe("masc");
  });

  it("looks up operators and skins by id", () => {
    expect(getOperator("vesper")?.name).toBe("Vesper");
    expect(getSkin("rook-alt")?.operatorId).toBe("rook");
    expect(getOperator("nope")).toBeUndefined();
    expect(getSkin("")).toBeUndefined();
  });

  it("resolveSkinColors prefers explicit skin, else operator default", () => {
    const alt = resolveSkinColors("brick", "brick-alt");
    expect(alt?.primaryColor).toBe(getSkin("brick-alt")!.primaryColor);
    expect(alt?.secondaryColor).toBe(getSkin("brick-alt")!.secondaryColor);

    const def = resolveSkinColors("nyx", "missing-skin");
    expect(def?.primaryColor).toBe(getSkin("nyx-default")!.primaryColor);

    expect(resolveSkinColors(null, null)).toBeNull();
  });

  it("every skin has finite colors and gradient", () => {
    for (const s of SKINS) {
      expect(Number.isFinite(s.primaryColor)).toBe(true);
      expect(Number.isFinite(s.secondaryColor)).toBe(true);
      expect(s.previewGradient.length).toBeGreaterThan(0);
      expect(s.rarity).toBe("common");
    }
  });
});
