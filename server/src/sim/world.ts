/**
 * Server collision + spawns — parity with client 72×72 CS layouts.
 * Engine: height-aware cover (LOS), standable props, feet-aware resolve.
 */

export interface WallRect {
  x: number;
  z: number;
  w: number;
  d: number;
  h?: number;
  /** Jump / walk on top (crates, cars, containers). */
  standable?: boolean;
}

export const PLAYER_RADIUS = 0.45;
export const PLAYER_SPEED = 6.5;
export const BOT_SPEED = 4.0;
export const FIRE_COOLDOWN = 0.14;
export const BULLET_DAMAGE = 32;
/** Longer maps need longer default hitscan (weapons still cap their own range). */
export const HIT_RANGE = 42;
export const HIT_RADIUS = 0.55;

export const BULLET_HEIGHT_STAND = 1.35;
/** Low ray for cover geometry tests — players always shoot standing (F4). */
export const BULLET_HEIGHT_LOW = 0.72;
export const MIN_BULLET_BLOCK_H = 0.4;
/** Standing peeks over walls at or below this height. */
export const LOW_COVER_MAX_H = 1.65;
export const SURFACE_EPS = 0.08;

/** Player hitscan ray height (standing only — crouch removed F4). */
export function bulletHeight(): number {
  return BULLET_HEIGHT_STAND;
}

export function wallHeight(w: WallRect): number {
  return w.h ?? 2.5;
}

export function wallBlocksBullet(w: WallRect, shotHeight: number): boolean {
  const h = wallHeight(w);
  if (h < MIN_BULLET_BLOCK_H) return false;
  if (shotHeight >= BULLET_HEIGHT_STAND - 0.1) {
    return h > LOW_COVER_MAX_H;
  }
  return h + 0.02 >= shotHeight;
}

/** Shared outer bounds for 72 maps. */
function bounds72(): WallRect[] {
  const H = 36;
  const S = 72;
  return [
    { x: 0, z: -H, w: S, d: 1.6, h: 3.6 },
    { x: 0, z: H, w: S, d: 1.6, h: 3.6 },
    { x: -H, z: 0, w: 1.6, d: S, h: 3.6 },
    { x: H, z: 0, w: 1.6, d: S, h: 3.6 },
  ];
}

function stand(
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
): WallRect {
  return { x, z, w, d, h, standable: true };
}

/** Dust FF — long A / mid / B tunnels + props (match client dust.ts). */
const DUST_WALLS: WallRect[] = [
  ...bounds72(),
  { x: -22, z: -28, w: 14, d: 1.5, h: 3.0 },
  { x: -28, z: -20, w: 1.5, d: 12, h: 3.0 },
  { x: 22, z: 28, w: 14, d: 1.5, h: 3.0 },
  { x: 28, z: 20, w: 1.5, d: 12, h: 3.0 },
  { x: 18, z: -8, w: 1.5, d: 28, h: 3.1 },
  { x: 26, z: -12, w: 1.5, d: 20, h: 3.1 },
  { x: 22, z: -26, w: 16, d: 1.5, h: 3.0 },
  { x: 30, z: -18, w: 1.5, d: 10, h: 2.9 },
  { x: 10, z: -14, w: 12, d: 1.5, h: 2.9 },
  { x: 8, z: -8, w: 1.5, d: 10, h: 2.8 },
  { x: 12, z: -4, w: 8, d: 1.4, h: 1.6 }, // low cover
  { x: -2, z: -4, w: 1.5, d: 18, h: 3.0 },
  { x: 4, z: 2, w: 1.5, d: 16, h: 3.0 },
  { x: 0, z: 12, w: 14, d: 1.5, h: 2.9 },
  { x: 1, z: -16, w: 10, d: 1.5, h: 2.9 },
  { x: -6, z: 4, w: 6, d: 1.4, h: 1.5 }, // low cover
  { x: -18, z: 4, w: 1.5, d: 22, h: 3.0 },
  { x: -26, z: 8, w: 1.5, d: 18, h: 3.0 },
  { x: -22, z: 20, w: 14, d: 1.5, h: 3.0 },
  { x: -14, z: 14, w: 1.5, d: 10, h: 2.9 },
  { x: -20, z: -6, w: 12, d: 1.5, h: 2.6 },
  { x: -12, z: -10, w: 1.5, d: 12, h: 2.8 },
  { x: 14, z: 14, w: 12, d: 1.5, h: 2.9 },
  { x: 16, z: 8, w: 1.5, d: 10, h: 2.8 },
  { x: -8, z: -2, w: 3.0, d: 1.4, h: 1.5 },
  { x: 6, z: 6, w: 2.5, d: 2.5, h: 1.5 },
  { x: 20, z: -10, w: 2.2, d: 1.4, h: 1.5 },
  { x: -22, z: 12, w: 2.4, d: 1.4, h: 1.5 },
  { x: 0, z: 22, w: 4, d: 1.4, h: 1.6 },
  { x: -4, z: -22, w: 3.5, d: 1.4, h: 1.5 },
  // props (standable high-ground)
  stand(22, -8, 1.5, 1.5, 1.3),
  stand(23.2, -6.8, 1.4, 1.4, 1.2),
  stand(20, -18, 1.6, 1.5, 1.4),
  stand(24, -20, 1.3, 1.3, 1.2),
  stand(0, 0, 1.5, 1.5, 1.3),
  stand(2, 2, 1.3, 1.3, 1.15),
  stand(-1, 8, 0.9, 0.9, 1.3),
  stand(5, -2, 0.9, 0.9, 1.25),
  stand(-20, 16, 1.6, 1.6, 1.4),
  stand(-18, 18, 1.4, 1.4, 1.2),
  stand(-24, 14, 1.5, 1.5, 1.3),
  stand(-16, 22, 0.9, 0.9, 1.3),
  stand(12, 20, 3.2, 1.6, 2.4),
  stand(-28, 0, 3.0, 1.5, 2.3),
  stand(-24, -24, 3.0, 1.4, 1.15),
  stand(24, 24, 2.9, 1.35, 1.1),
  stand(8, -24, 2.8, 1.3, 1.1),
  stand(-8, 26, 2.7, 1.3, 1.05),
  stand(16, 2, 2.0, 1.3, 1.45),
  stand(-10, 8, 1.9, 1.2, 1.4),
];

const FAVELA_WALLS: WallRect[] = [
  ...bounds72(),
  { x: -24, z: -28, w: 16, d: 1.4, h: 3.2 },
  { x: -30, z: -20, w: 1.4, d: 14, h: 3.2 },
  { x: 24, z: 28, w: 16, d: 1.4, h: 3.2 },
  { x: 30, z: 20, w: 1.4, d: 14, h: 3.2 },
  { x: -16, z: -10, w: 14, d: 1.4, h: 3.2 },
  { x: -20, z: 0, w: 1.4, d: 16, h: 3.1 },
  { x: -12, z: 8, w: 12, d: 1.4, h: 3.2 },
  { x: -24, z: 12, w: 1.4, d: 12, h: 3.0 },
  { x: -18, z: 20, w: 14, d: 1.4, h: 3.1 },
  { x: 14, z: -12, w: 14, d: 1.4, h: 3.1 },
  { x: 20, z: -2, w: 1.4, d: 16, h: 3.0 },
  { x: 12, z: 6, w: 12, d: 1.4, h: 3.0 },
  { x: 24, z: 10, w: 1.4, d: 12, h: 3.1 },
  { x: 16, z: -22, w: 16, d: 1.4, h: 3.0 },
  { x: -4, z: -6, w: 1.3, d: 14, h: 2.8 },
  { x: 4, z: 2, w: 1.3, d: 14, h: 2.8 },
  { x: 0, z: 12, w: 10, d: 1.3, h: 2.8 },
  { x: 0, z: -16, w: 12, d: 1.3, h: 2.8 },
  { x: -6, z: 22, w: 1.2, d: 10, h: 2.6 },
  { x: 6, z: 22, w: 1.2, d: 10, h: 2.6 },
  { x: 0, z: 28, w: 10, d: 1.0, h: 1.4 }, // low
  { x: -8, z: 2, w: 3, d: 1.3, h: 1.5 },
  { x: 10, z: -4, w: 2.5, d: 1.3, h: 1.5 },
  { x: 0, z: 6, w: 2.8, d: 2.8, h: 1.5 },
  { x: -22, z: -4, w: 2.4, d: 1.3, h: 1.5 },
  { x: 22, z: 4, w: 2.4, d: 1.3, h: 1.5 },
  stand(-18, -4, 1.5, 1.5, 1.3),
  stand(18, -16, 1.5, 1.5, 1.3),
  stand(-16, 16, 1.4, 1.4, 1.2),
  stand(14, 8, 1.4, 1.4, 1.2),
  stand(0, 20, 1.6, 1.6, 1.25),
  stand(-24, 4, 2.8, 1.3, 1.1),
  stand(24, -8, 2.8, 1.3, 1.1),
];

const YARD_WALLS: WallRect[] = [
  ...bounds72(),
  { x: -24, z: -28, w: 16, d: 1.3, h: 2.8 },
  { x: -30, z: -20, w: 1.3, d: 14, h: 2.8 },
  { x: 24, z: 28, w: 16, d: 1.3, h: 2.8 },
  { x: 30, z: 20, w: 1.3, d: 14, h: 2.8 },
  { x: -8, z: 0, w: 1.5, d: 18, h: 3.4 },
  { x: 8, z: 0, w: 1.5, d: 18, h: 3.4 },
  { x: 0, z: -10, w: 14, d: 1.5, h: 3.4 },
  { x: 0, z: 10, w: 14, d: 1.5, h: 3.4 },
  { x: -4, z: -10, w: 4, d: 1.2, h: 1.4 },
  { x: 4, z: 10, w: 4, d: 1.2, h: 1.4 },
  { x: 20, z: -18, w: 1.5, d: 20, h: 3.0 },
  { x: 28, z: -12, w: 1.5, d: 16, h: 3.0 },
  { x: 22, z: -26, w: 14, d: 1.5, h: 2.9 },
  { x: 12, z: -16, w: 10, d: 1.4, h: 2.6 },
  { x: -20, z: 12, w: 1.5, d: 18, h: 3.0 },
  { x: -28, z: 16, w: 1.5, d: 14, h: 3.0 },
  { x: -22, z: 24, w: 16, d: 1.5, h: 2.9 },
  { x: -12, z: 14, w: 1.4, d: 12, h: 2.8 },
  { x: 14, z: 8, w: 12, d: 1.4, h: 2.8 },
  { x: -14, z: -6, w: 12, d: 1.4, h: 2.8 },
  { x: 6, z: 18, w: 1.4, d: 10, h: 2.6 },
  { x: -6, z: -18, w: 1.4, d: 10, h: 2.6 },
  { x: 0, z: 0, w: 3, d: 3, h: 1.5 },
  { x: 18, z: -8, w: 2.5, d: 1.3, h: 1.5 },
  { x: -18, z: 8, w: 2.5, d: 1.3, h: 1.5 },
  { x: 10, z: 4, w: 2.2, d: 2.2, h: 1.5 },
  { x: -10, z: -4, w: 2.2, d: 2.2, h: 1.5 },
  stand(22, -14, 1.6, 1.5, 1.3),
  stand(-22, 16, 1.6, 1.5, 1.3),
  stand(4, -4, 1.4, 1.4, 1.2),
  stand(-4, 4, 1.4, 1.4, 1.2),
  stand(26, 20, 2.9, 1.3, 1.1),
  stand(-26, -20, 2.9, 1.3, 1.1),
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

function circleOverlapsWall(
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

function wallBlocksMovementAtFeet(w: WallRect, feetY: number): boolean {
  const top = wallHeight(w);
  if (w.standable && feetY >= top - SURFACE_EPS) return false;
  if (feetY >= top - 0.02) return false;
  return true;
}

export function resolveCircleWalls(
  x: number,
  z: number,
  radius: number,
  walls: WallRect[] = WALLS,
  feetY = 0,
): { x: number; z: number } {
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

/**
 * Armor formula + optional armorPen (0–1).
 * armorPen 1 = full pen to HP (AWP); armor still chips.
 */
export function applyDamage(
  hp: number,
  armor: number,
  damage: number,
  armorPen = 0,
): { hp: number; armor: number } {
  let dmg = damage;
  let a = armor;
  const pen = Math.max(0, Math.min(1, armorPen));
  if (a > 0) {
    const absorbed = Math.min(a, dmg * 0.5);
    a -= absorbed;
    dmg -= absorbed * 0.5 * (1 - pen);
  }
  return { hp: hp - dmg, armor: a };
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
  walls: WallRect[] = WALLS,
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
