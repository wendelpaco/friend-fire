import { describe, expect, it } from "vitest";
import {
  indexById,
  normalizeActiveSlot,
  normalizeTeam,
  refillArray,
  softBlendAxis,
  softBlendLocalPos,
} from "./networkApply";

describe("softBlendAxis / softBlendLocalPos", () => {
  it("pulls toward server with default weight", () => {
    expect(softBlendAxis(0, 10, 0.65)).toBeCloseTo(6.5, 5);
    const p = softBlendLocalPos(0, 0, 10, 20, 0.65);
    expect(p.x).toBeCloseTo(6.5, 5);
    expect(p.z).toBeCloseTo(13, 5);
  });

  it("serverWeight 1 snaps to server", () => {
    expect(softBlendAxis(5, 9, 1)).toBe(9);
  });
});

describe("normalizeTeam / slot", () => {
  it("maps CT else TR", () => {
    expect(normalizeTeam("CT")).toBe("CT");
    expect(normalizeTeam("TR")).toBe("TR");
    expect(normalizeTeam("x")).toBe("TR");
  });

  it("clamps active slot and drops primary if missing", () => {
    expect(normalizeActiveSlot(1, true)).toBe(1);
    expect(normalizeActiveSlot(1, false)).toBe(2);
    expect(normalizeActiveSlot(99, true)).toBe(2);
    expect(normalizeActiveSlot(4, true)).toBe(4);
  });
});

describe("refillArray / indexById", () => {
  it("reuses array storage", () => {
    const buf: number[] = [1, 2, 3, 4];
    const same = refillArray(buf, [9, 8]);
    expect(same).toBe(buf);
    expect(buf).toEqual([9, 8]);
  });

  it("indexes by id without alloc of new Map when reused", () => {
    const m = new Map<string, number>();
    indexById(m, [{ id: "a" }, { id: "b" }]);
    expect(m.get("a")).toBe(0);
    expect(m.get("b")).toBe(1);
    indexById(m, [{ id: "c" }]);
    expect(m.size).toBe(1);
    expect(m.get("c")).toBe(0);
  });
});
