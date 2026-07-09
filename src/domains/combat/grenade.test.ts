import { describe, expect, it } from "vitest";
import {
  HE_FUSE,
  HE_MAX_DAMAGE,
  HE_RADIUS,
  explodeAt,
  heDamageAt,
  throwGrenade,
} from "./grenade";

describe("heDamageAt", () => {
  it("is max at epicenter", () => {
    expect(heDamageAt(0)).toBe(HE_MAX_DAMAGE);
  });

  it("is zero at and beyond radius", () => {
    expect(heDamageAt(HE_RADIUS)).toBe(0);
    expect(heDamageAt(HE_RADIUS + 1)).toBe(0);
  });

  it("linear falloff at half radius", () => {
    expect(heDamageAt(HE_RADIUS / 2)).toBe(HE_MAX_DAMAGE / 2);
  });
});

describe("throwGrenade", () => {
  it("returns velocity along aim and trajectory samples", () => {
    const r = throwGrenade({ x: 0, z: 0 }, { x: 1, z: 0 }, 1);
    expect(r.velocity.vx).toBeGreaterThan(0);
    expect(Math.abs(r.velocity.vz)).toBeLessThan(1e-9);
    expect(r.velocity.vy).toBeGreaterThan(0);
    expect(r.samples.length).toBeGreaterThan(1);
    expect(r.samples[0]).toMatchObject({ t: 0, x: 0, z: 0 });
    expect(r.fuse).toBe(HE_FUSE);
  });

  it("scales speed with power", () => {
    const weak = throwGrenade({ x: 0, z: 0 }, { x: 0, z: 1 }, 0.5);
    const strong = throwGrenade({ x: 0, z: 0 }, { x: 0, z: 1 }, 1.5);
    expect(strong.velocity.vz).toBeGreaterThan(weak.velocity.vz);
  });

  it("ends on ground or at fuse", () => {
    const r = throwGrenade({ x: 0, y: 1.2, z: 0 }, { x: 1, z: 0 }, 1);
    const last = r.samples[r.samples.length - 1]!;
    if (r.grounded) {
      expect(last.y).toBe(0);
      expect(last.t).toBeLessThanOrEqual(HE_FUSE + 1e-9);
    } else {
      expect(last.t).toBeCloseTo(HE_FUSE, 5);
    }
  });

  it("samples form a downward arc after apex", () => {
    const r = throwGrenade({ x: 0, y: 1.2, z: 0 }, { x: 1, z: 0 }, 1, {
      sampleCount: 40,
    });
    const ys = r.samples.map((s) => s.y);
    const apex = Math.max(...ys);
    expect(apex).toBeGreaterThan(1.2);
    expect(ys[ys.length - 1]!).toBeLessThan(apex);
  });
});

describe("explodeAt", () => {
  it("damages with falloff radius 4 max 80", () => {
    const hits = explodeAt(0, 0, [
      { id: "a", x: 0, z: 0 },
      { id: "b", x: 2, z: 0 },
      { id: "c", x: 5, z: 0 },
    ]);
    expect(hits).toHaveLength(2);
    const a = hits.find((h) => h.id === "a")!;
    const b = hits.find((h) => h.id === "b")!;
    expect(a.damage).toBe(80);
    expect(b.damage).toBe(40);
    expect(hits.find((h) => h.id === "c")).toBeUndefined();
  });

  it("skips dead players", () => {
    const hits = explodeAt(0, 0, [
      { id: "dead", x: 0, z: 0, alive: false },
      { id: "live", x: 1, z: 0, alive: true },
    ]);
    expect(hits.map((h) => h.id)).toEqual(["live"]);
  });

  it("uses horizontal distance only", () => {
    const hits = explodeAt(3, 4, [{ id: "p", x: 0, z: 0 }]);
    // dist 5 > radius 4
    expect(hits).toHaveLength(0);
  });
});
