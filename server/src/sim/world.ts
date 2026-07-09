/** Minimal collision walls for Dust FF (keep rough sync with client map). */

export interface WallRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export const WALLS: WallRect[] = [
  { x: 0, z: -24, w: 48, d: 1.4 },
  { x: 0, z: 24, w: 48, d: 1.4 },
  { x: -24, z: 0, w: 1.4, d: 48 },
  { x: 24, z: 0, w: 1.4, d: 48 },
  { x: -8, z: -6, w: 12, d: 1.5 },
  { x: 6, z: -6, w: 10, d: 1.5 },
  { x: -4, z: 2, w: 1.5, d: 14 },
  { x: 8, z: 4, w: 1.5, d: 12 },
  { x: -12, z: 10, w: 14, d: 1.5 },
  { x: 12, z: 10, w: 10, d: 1.5 },
  { x: -14, z: -12, w: 1.5, d: 10 },
  { x: 14, z: -12, w: 1.5, d: 10 },
  { x: 0, z: 16, w: 18, d: 1.5 },
  { x: -16, z: 0, w: 6, d: 1.5 },
  { x: 16, z: 0, w: 6, d: 1.5 },
  { x: 0, z: -12, w: 3.5, d: 1.4 },
  { x: 2, z: 8, w: 2.5, d: 2.5 },
];

export const PLAYER_RADIUS = 0.45;
export const PLAYER_SPEED = 6.5;
export const BOT_SPEED = 4.0;
export const FIRE_COOLDOWN = 0.14;
export const BULLET_DAMAGE = 32;
export const HIT_RANGE = 28;
export const HIT_RADIUS = 0.55;

export function resolveCircleWalls(
  x: number,
  z: number,
  radius: number,
  walls: WallRect[] = WALLS,
): { x: number; z: number } {
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

export function applyDamage(
  hp: number,
  armor: number,
  damage: number,
): { hp: number; armor: number } {
  let dmg = damage;
  let a = armor;
  if (a > 0) {
    const absorbed = Math.min(a, dmg * 0.5);
    a -= absorbed;
    dmg -= absorbed * 0.5;
  }
  return { hp: hp - dmg, armor: a };
}

export const SPAWNS = {
  TR: [
    { x: -18, z: -18 },
    { x: -15, z: -18 },
    { x: -18, z: -15 },
    { x: -12, z: -18 },
  ],
  CT: [
    { x: 18, z: 18 },
    { x: 15, z: 18 },
    { x: 18, z: 15 },
    { x: 12, z: 18 },
  ],
} as const;

export type MapId = "dust" | "favela" | "yard";

/** Per-map walls (keep rough parity with client maps). */
const MAP_WALLS: Record<MapId, WallRect[]> = {
  dust: WALLS,
  favela: [
    { x: 0, z: -24, w: 48, d: 1.4 },
    { x: 0, z: 24, w: 48, d: 1.4 },
    { x: -24, z: 0, w: 1.4, d: 48 },
    { x: 24, z: 0, w: 1.4, d: 48 },
    { x: -10, z: -8, w: 10, d: 1.4 },
    { x: 8, z: -8, w: 12, d: 1.4 },
    { x: -6, z: 0, w: 1.4, d: 12 },
    { x: 6, z: 2, w: 1.4, d: 10 },
    { x: -14, z: 8, w: 12, d: 1.4 },
    { x: 12, z: 8, w: 10, d: 1.4 },
    { x: -16, z: -4, w: 1.4, d: 10 },
    { x: 16, z: -4, w: 1.4, d: 10 },
    { x: -4, z: 14, w: 1.2, d: 8 },
    { x: 4, z: 14, w: 1.2, d: 8 },
    { x: 0, z: 18.5, w: 6, d: 1.0 },
    { x: 0, z: -14, w: 4, d: 1.2 },
  ],
  yard: WALLS,
};

export function resolveMapId(raw?: string): MapId {
  if (raw === "favela" || raw === "yard" || raw === "dust") return raw;
  return "dust";
}

export function wallsForMap(mapId: string): WallRect[] {
  return MAP_WALLS[resolveMapId(mapId)] ?? WALLS;
}

export function spawnsForTeam(
  mapId: string,
  team: "TR" | "CT",
): ReadonlyArray<{ x: number; z: number }> {
  // Shared spawn corners across maps for now (maps share 48×48 bounds).
  void mapId;
  return SPAWNS[team];
}

/**
 * True if segment from (x0,z0)→(x1,z1) intersects a wall rect (2D AABB).
 * Used so hitscan cannot shoot through cover (fixes “die through walls”).
 */
export function segmentBlockedByWalls(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  walls: WallRect[] = WALLS,
): boolean {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const dist = Math.hypot(dx, dz);
  if (!(dist > 0.05)) return false;
  const steps = Math.max(2, Math.ceil(dist / 0.35));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const z = z0 + dz * t;
    for (const w of walls) {
      const halfW = w.w / 2;
      const halfD = w.d / 2;
      if (Math.abs(x - w.x) <= halfW && Math.abs(z - w.z) <= halfD) {
        return true;
      }
    }
  }
  return false;
}
