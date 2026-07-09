import { describe, expect, it } from "vitest";
import { resolveCircleWalls } from "./collision";

describe("resolveCircleWalls", () => {
  it("pushes circle out of AABB", () => {
    const walls = [{ x: 0, z: 0, w: 2, d: 2 }];
    const p = resolveCircleWalls(0, 0, 0.5, walls);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(0.4);
  });

  it("leaves free space unchanged", () => {
    const walls = [{ x: 0, z: 0, w: 2, d: 2 }];
    const p = resolveCircleWalls(10, 10, 0.5, walls);
    expect(p.x).toBe(10);
    expect(p.z).toBe(10);
  });
});
