import { describe, expect, it } from "vitest";
import {
  fxDensityFromBudget,
  isInstanceableKind,
  normalizePropKind,
  propBatchKey,
  shadowHalfExtent,
  shouldIncludePropKind,
} from "./propBatch";

describe("propBatch", () => {
  it("normalizes unknown kinds to crate", () => {
    expect(normalizePropKind(undefined)).toBe("crate");
    expect(normalizePropKind("nope")).toBe("crate");
    expect(normalizePropKind("barrel")).toBe("barrel");
  });

  it("instanceable kinds are single-body only", () => {
    expect(isInstanceableKind("crate")).toBe(true);
    expect(isInstanceableKind("barrel")).toBe(true);
    expect(isInstanceableKind("car")).toBe(false);
    expect(isInstanceableKind("pole")).toBe(false);
  });

  it("batch key includes kind + color hex", () => {
    expect(propBatchKey("crate", 0x8b6914)).toBe("crate:8b6914");
    expect(propBatchKey("barrel", 0xff)).toBe("barrel:ff");
  });

  it("propDetail 0 drops debris and poles", () => {
    expect(shouldIncludePropKind("debris", 0)).toBe(false);
    expect(shouldIncludePropKind("pole", 0)).toBe(false);
    expect(shouldIncludePropKind("crate", 0)).toBe(true);
    expect(shouldIncludePropKind("debris", 1)).toBe(true);
  });

  it("shadow half-extent grows with map and propDetail", () => {
    const low = shadowHalfExtent(48, 48, 0);
    const mid = shadowHalfExtent(48, 48, 1);
    const high = shadowHalfExtent(48, 48, 2);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThanOrEqual(high);
  });

  it("fx density clamps budget", () => {
    expect(fxDensityFromBudget(0.35)).toBe(0.35);
    expect(fxDensityFromBudget(2)).toBe(1);
    expect(fxDensityFromBudget(-1)).toBe(0);
  });
});
