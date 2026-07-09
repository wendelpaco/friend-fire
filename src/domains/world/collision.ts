import type { GameMap, Vec2, WallRect } from "./types";

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

export function resolveCircleWalls(
  x: number,
  z: number,
  radius: number,
  walls: WallRect[],
): Vec2 {
  let nx = x;
  let nz = z;

  for (const w of walls) {
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

/** Collision boxes for billboard poles / cars so they block movement */
export function mapCollisionWalls(map: GameMap): WallRect[] {
  const extra: WallRect[] = [];
  for (const p of map.props) {
    extra.push({ x: p.x, z: p.z, w: p.w, d: p.d, h: p.h });
  }
  for (const b of map.billboards) {
    if (b.style === "wall") continue;
    extra.push({ x: b.x, z: b.z, w: b.width * 0.85, d: 0.6, h: 1 });
  }
  return [...map.walls, ...extra];
}
