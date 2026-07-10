import { describe, expect, it } from "vitest";
import {
  BULLET_HEIGHT_LOW,
  BULLET_HEIGHT_STAND,
  firstWallImpactAlongRay,
  resolveCircleWalls,
  sampleGroundY,
  segmentBlockedByWalls,
  wallBlocksBullet,
} from "./collision";
import type { WallRect } from "./types";

describe("resolveCircleWalls", () => {
  it("pushes circle out of AABB", () => {
    const walls = [{ x: 0, z: 0, w: 2, d: 2, h: 3 }];
    const p = resolveCircleWalls(0, 0, 0.5, walls);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(0.4);
  });

  it("leaves free space unchanged", () => {
    const walls = [{ x: 0, z: 0, w: 2, d: 2, h: 3 }];
    const p = resolveCircleWalls(10, 10, 0.5, walls);
    expect(p.x).toBe(10);
    expect(p.z).toBe(10);
  });

  it("does not block when standing on standable top", () => {
    const walls: WallRect[] = [
      { x: 0, z: 0, w: 2, d: 2, h: 1.2, standable: true },
    ];
    const p = resolveCircleWalls(0, 0, 0.45, walls, 1.2);
    expect(p.x).toBe(0);
    expect(p.z).toBe(0);
  });
});

describe("height-aware cover (CS LOS)", () => {
  const lowCover: WallRect = { x: 0, z: 5, w: 4, d: 1, h: 1.5 };
  const fullWall: WallRect = { x: 0, z: 5, w: 4, d: 1, h: 3.0 };

  it("low cover blocks low rays but not stand shots", () => {
    expect(wallBlocksBullet(lowCover, BULLET_HEIGHT_STAND)).toBe(false);
    expect(wallBlocksBullet(lowCover, BULLET_HEIGHT_LOW)).toBe(true);
  });

  it("full wall blocks standing shots", () => {
    expect(wallBlocksBullet(fullWall, BULLET_HEIGHT_STAND)).toBe(true);
  });

  it("segmentBlockedByWalls respects shot height", () => {
    const walls = [lowCover];
    expect(
      segmentBlockedByWalls(0, 0, 0, 10, walls, BULLET_HEIGHT_STAND),
    ).toBe(false);
    expect(
      segmentBlockedByWalls(0, 0, 0, 10, walls, BULLET_HEIGHT_LOW),
    ).toBe(true);
  });

  it("firstWallImpactAlongRay skips low cover when standing", () => {
    const hit = firstWallImpactAlongRay(
      0,
      0,
      0,
      1,
      12,
      [lowCover],
      BULLET_HEIGHT_STAND,
    );
    expect(hit).toBeNull();
    const lowHit = firstWallImpactAlongRay(
      0,
      0,
      0,
      1,
      12,
      [lowCover],
      BULLET_HEIGHT_LOW,
    );
    expect(lowHit).not.toBeNull();
  });
});

describe("sampleGroundY platforms", () => {
  it("returns crate top when overlapping standable", () => {
    const walls: WallRect[] = [
      { x: 0, z: 0, w: 1.5, d: 1.5, h: 1.3, standable: true },
    ];
    expect(sampleGroundY(0, 0, 0.45, walls)).toBeCloseTo(1.3);
  });

  it("returns floor when clear", () => {
    const walls: WallRect[] = [
      { x: 0, z: 0, w: 1.5, d: 1.5, h: 1.3, standable: true },
    ];
    expect(sampleGroundY(10, 10, 0.45, walls)).toBe(0);
  });
});
