import type { GameMap, Vec2, WallRect } from "./types";

/** Standing muzzle / torso ray height (m). */
export const BULLET_HEIGHT_STAND = 1.35;
/** Crouched ray height (m). */
export const BULLET_HEIGHT_CROUCH = 0.72;
/** Below this, debris never blocks bullets. */
export const MIN_BULLET_BLOCK_H = 0.4;
/**
 * Walls at or below this height are “low cover”: standing can peak over,
 * crouching is still blocked (CS sandbag / half-wall feel).
 */
export const LOW_COVER_MAX_H = 1.65;
/** Max step onto a standable top without a full jump (m). */
export const STEP_HEIGHT = 0.45;
/** Feet within this of a surface top counts as on it. */
export const SURFACE_EPS = 0.08;

export function bulletHeight(crouching: boolean): number {
  return crouching ? BULLET_HEIGHT_CROUCH : BULLET_HEIGHT_STAND;
}

export function wallHeight(w: WallRect): number {
  return w.h ?? 2.5;
}

/**
 * True if a ray at `shotHeight` is stopped by this wall/prop.
 * Standing peeks over low cover (h ≤ LOW_COVER_MAX_H); crouch shots do not.
 */
export function wallBlocksBullet(w: WallRect, shotHeight: number): boolean {
  const h = wallHeight(w);
  if (h < MIN_BULLET_BLOCK_H) return false;
  // Standing / high ray: only full walls block
  if (shotHeight >= BULLET_HEIGHT_STAND - 0.1) {
    return h > LOW_COVER_MAX_H;
  }
  // Crouch / low ray: any solid at or above the ray stops it
  return h + 0.02 >= shotHeight;
}

/**
 * Prop kinds that form walkable high-ground (jump/step on top).
 */
export function propIsStandable(
  kind: string | undefined,
  h: number,
): boolean {
  if (h < 0.5 || h > 2.8) return false;
  switch (kind) {
    case "crate":
    case "barrel":
    case "car":
    case "dumpster":
    case "container":
      return true;
    default:
      return false;
  }
}

export function circleHitsWall(
  x: number,
  z: number,
  radius: number,
  walls: WallRect[],
): boolean {
  for (const w of walls) {
    const halfW = w.w / 2;
    const halfD = w.d / 2;
    const nearestX = Math.max(w.x - halfW, Math.min(x, w.x + halfW));
    const nearestZ = Math.max(w.z - halfD, Math.min(z, w.z + halfD));
    const dx = x - nearestX;
    const dz = z - nearestZ;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

/** Horizontal overlap of player circle with wall AABB (XZ). */
export function circleOverlapsWall(
  x: number,
  z: number,
  radius: number,
  w: WallRect,
): boolean {
  const halfW = w.w / 2;
  const halfD = w.d / 2;
  const nearestX = Math.max(w.x - halfW, Math.min(x, w.x + halfW));
  const nearestZ = Math.max(w.z - halfD, Math.min(z, w.z + halfD));
  const dx = x - nearestX;
  const dz = z - nearestZ;
  return dx * dx + dz * dz < radius * radius;
}

/**
 * Highest standable surface under the feet (world floor = 0).
 * Used by motor for crates/cars/containers — CS high-ground.
 */
export function sampleGroundY(
  x: number,
  z: number,
  radius: number,
  walls: WallRect[],
): number {
  let ground = 0;
  const r = radius * 0.85;
  for (const w of walls) {
    if (!w.standable) continue;
    const top = wallHeight(w);
    if (top < 0.5) continue;
    if (!circleOverlapsWall(x, z, r, w)) continue;
    if (top > ground) ground = top;
  }
  return ground;
}

/**
 * Should this solid block lateral movement given feet height?
 * - On top of standable → no (walk on surface)
 * - Feet clearly above top → no (jumped over / landed past)
 */
export function wallBlocksMovementAtFeet(
  w: WallRect,
  feetY: number,
): boolean {
  const top = wallHeight(w);
  if (w.standable && feetY >= top - SURFACE_EPS) return false;
  if (feetY >= top - 0.02) return false;
  return true;
}

/**
 * Push circle out of solid AABBs. Optional feetY enables platform / jump-over.
 */
export function resolveCircleWalls(
  x: number,
  z: number,
  radius: number,
  walls: WallRect[],
  feetY = 0,
): Vec2 {
  let nx = x;
  let nz = z;

  for (const w of walls) {
    if (!wallBlocksMovementAtFeet(w, feetY)) continue;

    const halfW = w.w / 2 + radius;
    const halfD = w.d / 2 + radius;
    const dx = nx - w.x;
    const dz = nz - w.z;

    if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
      const overlapX = halfW - Math.abs(dx);
      const overlapZ = halfD - Math.abs(dz);
      if (overlapX < overlapZ) {
        nx += dx > 0 ? overlapX : -overlapX;
      } else {
        nz += dz > 0 ? overlapZ : -overlapZ;
      }
    }
  }

  return { x: nx, z: nz };
}

export type WallImpactFx = {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  surface: "wall";
};

/**
 * First wall hit along a horizontal ray that blocks at `shotHeight`.
 * Low cover (h < stand height) is ignored for standing shots — CS peak.
 */
export function firstWallImpactAlongRay(
  ox: number,
  oz: number,
  dirX: number,
  dirZ: number,
  maxDist: number,
  walls: WallRect[],
  shotHeight: number = BULLET_HEIGHT_STAND,
): WallImpactFx | null {
  const len = Math.hypot(dirX, dirZ);
  if (!(len > 1e-6) || !(maxDist > 0)) return null;
  const dx = dirX / len;
  const dz = dirZ / len;
  const steps = Math.max(4, Math.ceil(maxDist / 0.35));
  const step = maxDist / steps;
  let px = ox;
  let pz = oz;
  for (let i = 0; i < steps; i++) {
    const nx = px + dx * step;
    const nz = pz + dz * step;
    for (const w of walls) {
      if (!wallBlocksBullet(w, shotHeight)) continue;
      const halfW = w.w / 2;
      const halfD = w.d / 2;
      const inside =
        Math.abs(nx - w.x) <= halfW && Math.abs(nz - w.z) <= halfD;
      const wasInside =
        Math.abs(px - w.x) <= halfW && Math.abs(pz - w.z) <= halfD;
      if (inside && !wasInside) {
        const toCx = nx - w.x;
        const toCz = nz - w.z;
        const oxAbs = halfW - Math.abs(toCx);
        const ozAbs = halfD - Math.abs(toCz);
        let nxn = 0;
        let nzn = 0;
        if (oxAbs < ozAbs) {
          nxn = toCx > 0 ? 1 : -1;
        } else {
          nzn = toCz > 0 ? 1 : -1;
        }
        const h = wallHeight(w);
        return {
          x: nx - dx * 0.05,
          y: Math.min(h * 0.55, shotHeight),
          z: nz - dz * 0.05,
          nx: nxn,
          ny: 0,
          nz: nzn,
          surface: "wall",
        };
      }
    }
    px = nx;
    pz = nz;
  }
  return null;
}

export function segmentBlockedByWalls(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  walls: WallRect[],
  shotHeight: number = BULLET_HEIGHT_STAND,
): boolean {
  return (
    firstWallImpactAlongRay(
      x0,
      z0,
      x1 - x0,
      z1 - z0,
      Math.hypot(x1 - x0, z1 - z0),
      walls,
      shotHeight,
    ) != null
  );
}

/** Collision boxes for walls + props + billboard poles. */
export function mapCollisionWalls(map: GameMap): WallRect[] {
  const extra: WallRect[] = [];
  for (const p of map.props) {
    extra.push({
      x: p.x,
      z: p.z,
      w: p.w,
      d: p.d,
      h: p.h,
      standable: propIsStandable(p.kind, p.h),
    });
  }
  for (const b of map.billboards) {
    if (b.style === "wall") continue;
    extra.push({ x: b.x, z: b.z, w: b.width * 0.85, d: 0.6, h: 1 });
  }
  // Low cover walls (short height) stay non-standable unless flagged.
  return [
    ...map.walls.map((w) => ({
      ...w,
      standable: w.standable === true,
    })),
    ...extra,
  ];
}
