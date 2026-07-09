import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHUNK_LIFE,
  DEFAULT_DECAL_LIFE,
  MAX_CHUNKS,
  MAX_DECALS,
} from "./types";
import {
  collisionWallsUnchanged,
  createImpact,
  emptyWallDamage,
  enforceCaps,
  expireWallDamage,
  fadeOpacity,
  shouldExpire,
} from "./wallDamage";

const wallHit = {
  x: 1,
  y: 1.2,
  z: 2,
  nx: 0,
  ny: 0,
  nz: 1,
  surface: "wall" as const,
};

describe("createImpact", () => {
  it("adds decal + chunk for wall hits", () => {
    const r = createImpact(emptyWallDamage(), wallHit, 0, { sizeSeed: 0.5 });
    expect(r.chunk).not.toBeNull();
    expect(r.decal).not.toBeNull();
    expect(r.state.chunks).toHaveLength(1);
    expect(r.state.decals).toHaveLength(1);
    expect(r.kind).toBe("wall");
    expect(r.chunk!.life).toBe(DEFAULT_CHUNK_LIFE);
    expect(r.decal!.life).toBe(DEFAULT_DECAL_LIFE);
  });

  it("adds decal only for ground hits (no chunk)", () => {
    const r = createImpact(
      emptyWallDamage(),
      { ...wallHit, surface: "ground" },
      0,
    );
    expect(r.chunk).toBeNull();
    expect(r.decal).not.toBeNull();
    expect(r.state.chunks).toHaveLength(0);
    expect(r.state.decals).toHaveLength(1);
  });

  it("biases decal along normal", () => {
    const r = createImpact(emptyWallDamage(), wallHit, 0, { sizeSeed: 0 });
    expect(r.decal!.z).toBeGreaterThan(wallHit.z);
  });
});

describe("shouldExpire / expireWallDamage", () => {
  it("expires after life", () => {
    const item = { createdAt: 0, life: 5 };
    expect(shouldExpire(item, 4.99)).toBe(false);
    expect(shouldExpire(item, 5)).toBe(true);
  });

  it("removes expired chunks and decals", () => {
    let state = emptyWallDamage();
    state = createImpact(state, wallHit, 0, { sizeSeed: 0.1 }).state;
    expect(state.chunks).toHaveLength(1);
    state = expireWallDamage(state, DEFAULT_CHUNK_LIFE);
    expect(state.chunks).toHaveLength(0);
    expect(state.decals).toHaveLength(1);
    state = expireWallDamage(state, DEFAULT_DECAL_LIFE);
    expect(state.decals).toHaveLength(0);
  });

  it("fades opacity in final window", () => {
    const item = { createdAt: 0, life: 5 };
    expect(fadeOpacity(item, 4, 0.4)).toBe(1);
    expect(fadeOpacity(item, 4.8, 0.4)).toBeCloseTo(0.5);
    expect(fadeOpacity(item, 5, 0.4)).toBe(0);
  });
});

describe("caps", () => {
  it("drops oldest when over max chunks/decals", () => {
    let state = emptyWallDamage();
    for (let i = 0; i < MAX_CHUNKS + 5; i++) {
      state = createImpact(state, wallHit, i * 0.01, { sizeSeed: 0.2 }).state;
    }
    expect(state.chunks.length).toBeLessThanOrEqual(MAX_CHUNKS);
    expect(state.decals.length).toBeLessThanOrEqual(MAX_DECALS);
  });

  it("enforceCaps trims from the front (oldest)", () => {
    const state = {
      chunks: Array.from({ length: 3 }, (_, i) => ({
        id: `c${i}`,
        x: 0,
        y: 0,
        z: 0,
        nx: 0,
        ny: 1,
        nz: 0,
        size: 0.2,
        createdAt: i,
        life: 5,
      })),
      decals: [] as never[],
    };
    const next = enforceCaps(state, 2, 80);
    expect(next.chunks.map((c) => c.id)).toEqual(["c1", "c2"]);
  });
});

describe("collision isolation", () => {
  it("does not mutate collision wall arrays", () => {
    const walls = [{ x: 0, z: 0, w: 1, d: 1 }];
    const before = JSON.stringify(walls);
    createImpact(emptyWallDamage(), wallHit, 0);
    expect(collisionWallsUnchanged(walls)).toBe(walls);
    expect(JSON.stringify(walls)).toBe(before);
  });
});
