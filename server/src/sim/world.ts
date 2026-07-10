/** Server collision + spawns — keep parity with client map layouts (72×72 CS style). */

export interface WallRect {
  x: number;
  z: number;
  w: number;
  d: number;
  h?: number;
}

export const PLAYER_RADIUS = 0.45;
export const PLAYER_SPEED = 6.5;
export const BOT_SPEED = 4.0;
export const FIRE_COOLDOWN = 0.14;
export const BULLET_DAMAGE = 32;
export const HIT_RANGE = 28;
export const HIT_RADIUS = 0.55;

/** Shared outer bounds for 72 maps. */
function bounds72(): WallRect[] {
  const H = 36;
  const S = 72;
  return [
    { x: 0, z: -H, w: S, d: 1.6 },
    { x: 0, z: H, w: S, d: 1.6 },
    { x: -H, z: 0, w: 1.6, d: S },
    { x: H, z: 0, w: 1.6, d: S },
  ];
}

/** Dust FF — long A / mid / B tunnels (match client dust.ts). */
const DUST_WALLS: WallRect[] = [
  ...bounds72(),
  { x: -22, z: -28, w: 14, d: 1.5 },
  { x: -28, z: -20, w: 1.5, d: 12 },
  { x: 22, z: 28, w: 14, d: 1.5 },
  { x: 28, z: 20, w: 1.5, d: 12 },
  { x: 18, z: -8, w: 1.5, d: 28 },
  { x: 26, z: -12, w: 1.5, d: 20 },
  { x: 22, z: -26, w: 16, d: 1.5 },
  { x: 30, z: -18, w: 1.5, d: 10 },
  { x: 10, z: -14, w: 12, d: 1.5 },
  { x: 8, z: -8, w: 1.5, d: 10 },
  { x: 12, z: -4, w: 8, d: 1.4 },
  { x: -2, z: -4, w: 1.5, d: 18 },
  { x: 4, z: 2, w: 1.5, d: 16 },
  { x: 0, z: 12, w: 14, d: 1.5 },
  { x: 1, z: -16, w: 10, d: 1.5 },
  { x: -6, z: 4, w: 6, d: 1.4 },
  { x: -18, z: 4, w: 1.5, d: 22 },
  { x: -26, z: 8, w: 1.5, d: 18 },
  { x: -22, z: 20, w: 14, d: 1.5 },
  { x: -14, z: 14, w: 1.5, d: 10 },
  { x: -20, z: -6, w: 12, d: 1.5 },
  { x: -12, z: -10, w: 1.5, d: 12 },
  { x: 14, z: 14, w: 12, d: 1.5 },
  { x: 16, z: 8, w: 1.5, d: 10 },
  { x: -8, z: -2, w: 3.0, d: 1.4 },
  { x: 6, z: 6, w: 2.5, d: 2.5 },
  { x: 20, z: -10, w: 2.2, d: 1.4 },
  { x: -22, z: 12, w: 2.4, d: 1.4 },
  { x: 0, z: 22, w: 4, d: 1.4 },
  { x: -4, z: -22, w: 3.5, d: 1.4 },
];

const FAVELA_WALLS: WallRect[] = [
  ...bounds72(),
  { x: -24, z: -28, w: 16, d: 1.4 },
  { x: -30, z: -20, w: 1.4, d: 14 },
  { x: 24, z: 28, w: 16, d: 1.4 },
  { x: 30, z: 20, w: 1.4, d: 14 },
  { x: -16, z: -10, w: 14, d: 1.4 },
  { x: -20, z: 0, w: 1.4, d: 16 },
  { x: -12, z: 8, w: 12, d: 1.4 },
  { x: -24, z: 12, w: 1.4, d: 12 },
  { x: -18, z: 20, w: 14, d: 1.4 },
  { x: 14, z: -12, w: 14, d: 1.4 },
  { x: 20, z: -2, w: 1.4, d: 16 },
  { x: 12, z: 6, w: 12, d: 1.4 },
  { x: 24, z: 10, w: 1.4, d: 12 },
  { x: 16, z: -22, w: 16, d: 1.4 },
  { x: -4, z: -6, w: 1.3, d: 14 },
  { x: 4, z: 2, w: 1.3, d: 14 },
  { x: 0, z: 12, w: 10, d: 1.3 },
  { x: 0, z: -16, w: 12, d: 1.3 },
  { x: -6, z: 22, w: 1.2, d: 10 },
  { x: 6, z: 22, w: 1.2, d: 10 },
  { x: 0, z: 28, w: 10, d: 1.0 },
  { x: -8, z: 2, w: 3, d: 1.3 },
  { x: 10, z: -4, w: 2.5, d: 1.3 },
  { x: 0, z: 6, w: 2.8, d: 2.8 },
  { x: -22, z: -4, w: 2.4, d: 1.3 },
  { x: 22, z: 4, w: 2.4, d: 1.3 },
];

const YARD_WALLS: WallRect[] = [
  ...bounds72(),
  { x: -24, z: -28, w: 16, d: 1.3 },
  { x: -30, z: -20, w: 1.3, d: 14 },
  { x: 24, z: 28, w: 16, d: 1.3 },
  { x: 30, z: 20, w: 1.3, d: 14 },
  { x: -8, z: 0, w: 1.5, d: 18 },
  { x: 8, z: 0, w: 1.5, d: 18 },
  { x: 0, z: -10, w: 14, d: 1.5 },
  { x: 0, z: 10, w: 14, d: 1.5 },
  { x: -4, z: -10, w: 4, d: 1.2 },
  { x: 4, z: 10, w: 4, d: 1.2 },
  { x: 20, z: -18, w: 1.5, d: 20 },
  { x: 28, z: -12, w: 1.5, d: 16 },
  { x: 22, z: -26, w: 14, d: 1.5 },
  { x: 12, z: -16, w: 10, d: 1.4 },
  { x: -20, z: 12, w: 1.5, d: 18 },
  { x: -28, z: 16, w: 1.5, d: 14 },
  { x: -22, z: 24, w: 16, d: 1.5 },
  { x: -12, z: 14, w: 1.4, d: 12 },
  { x: 14, z: 8, w: 12, d: 1.4 },
  { x: -14, z: -6, w: 12, d: 1.4 },
  { x: 6, z: 18, w: 1.4, d: 10 },
  { x: -6, z: -18, w: 1.4, d: 10 },
  { x: 0, z: 0, w: 3, d: 3 },
  { x: 18, z: -8, w: 2.5, d: 1.3 },
  { x: -18, z: 8, w: 2.5, d: 1.3 },
  { x: 10, z: 4, w: 2.2, d: 2.2 },
  { x: -10, z: -4, w: 2.2, d: 2.2 },
];

/** Legacy alias — dust layout. */
export const WALLS: WallRect[] = DUST_WALLS;

export const SPAWNS = {
  TR: [
    { x: -28, z: -28 },
    { x: -24, z: -30 },
    { x: -30, z: -24 },
    { x: -22, z: -26 },
  ],
  CT: [
    { x: 28, z: 28 },
    { x: 24, z: 30 },
    { x: 30, z: 24 },
    { x: 22, z: 26 },
  ],
} as const;

export type MapId = "dust" | "favela" | "yard";

const MAP_WALLS: Record<MapId, WallRect[]> = {
  dust: DUST_WALLS,
  favela: FAVELA_WALLS,
  yard: YARD_WALLS,
};

export function resolveMapId(raw?: string): MapId {
  if (raw === "favela" || raw === "yard" || raw === "dust") return raw;
  return "dust";
}

export function wallsForMap(mapId: string): WallRect[] {
  return MAP_WALLS[resolveMapId(mapId)] ?? DUST_WALLS;
}

export function spawnsForTeam(
  mapId: string,
  team: "TR" | "CT",
): ReadonlyArray<{ x: number; z: number }> {
  void mapId;
  return SPAWNS[team];
}

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

export function segmentBlockedByWalls(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  walls: WallRect[] = WALLS,
): boolean {
  return (
    firstWallImpactAlongRay(
      x0,
      z0,
      x1 - x0,
      z1 - z0,
      Math.hypot(x1 - x0, z1 - z0),
      walls,
    ) != null
  );
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

export function firstWallImpactAlongRay(
  ox: number,
  oz: number,
  dirX: number,
  dirZ: number,
  maxDist: number,
  walls: WallRect[] = WALLS,
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
        const h = w.h ?? 2.5;
        return {
          x: nx - dx * 0.05,
          y: h * 0.45,
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
