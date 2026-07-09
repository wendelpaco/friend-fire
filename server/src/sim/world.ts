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
