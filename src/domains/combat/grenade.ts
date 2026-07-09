/**
 * HE grenade pure domain physics (wave5 §2.4).
 * Arc throw + radial explosion falloff. No I/O, no engine refs.
 */

export const HE_RADIUS = 4;
export const HE_MAX_DAMAGE = 80;
/** Fuse time in seconds — explode after this if still airborne. */
export const HE_FUSE = 1.8;
/** Gravity (m/s²) for throw arc. */
export const HE_GRAVITY = 18;
/** Throw speed at power = 1. */
export const HE_BASE_SPEED = 14;
/** Default upward loft fraction of speed when `dir.y` is omitted. */
export const HE_DEFAULT_LOFT = 0.45;
/** Default throw origin height (hand). */
export const HE_DEFAULT_ORIGIN_Y = 1.2;

export type GrenadeVec3 = { x: number; y: number; z: number };

export interface ThrowOrigin {
  x: number;
  /** Height; defaults to {@link HE_DEFAULT_ORIGIN_Y}. */
  y?: number;
  z: number;
}

export interface ThrowDir {
  x: number;
  /** Optional pitch; when omitted, default loft is applied. */
  y?: number;
  z: number;
}

export interface GrenadeVelocity {
  vx: number;
  vy: number;
  vz: number;
}

export interface TrajectorySample {
  t: number;
  x: number;
  y: number;
  z: number;
}

export interface ThrowResult {
  origin: GrenadeVec3;
  velocity: GrenadeVelocity;
  /** Sampled ballistic path until fuse or ground. */
  samples: TrajectorySample[];
  /** Fuse used for sampling (seconds). */
  fuse: number;
  /** True if last sample hit ground before fuse. */
  grounded: boolean;
}

export interface GrenadePlayer {
  id: string;
  x: number;
  z: number;
  /** If false, skipped (no damage). Default true. */
  alive?: boolean;
}

export interface GrenadeHit {
  id: string;
  damage: number;
  distance: number;
}

export interface ExplodeOptions {
  radius?: number;
  maxDamage?: number;
}

export interface ThrowOptions {
  /** Number of trajectory samples (including t=0). Default 19. */
  sampleCount?: number;
  fuse?: number;
  gravity?: number;
  groundY?: number;
  baseSpeed?: number;
}

/**
 * Linear falloff: max at 0, 0 at radius (and beyond).
 */
export function heDamageAt(
  distance: number,
  radius: number = HE_RADIUS,
  maxDamage: number = HE_MAX_DAMAGE,
): number {
  if (!(radius > 0) || !(maxDamage > 0)) return 0;
  if (!(distance >= 0) || !Number.isFinite(distance)) return 0;
  if (distance >= radius) return 0;
  return maxDamage * (1 - distance / radius);
}

function initialVelocity(
  dir: ThrowDir,
  speed: number,
): GrenadeVelocity {
  const dx = Number.isFinite(dir.x) ? dir.x : 0;
  const dz = Number.isFinite(dir.z) ? dir.z : 0;
  const hasPitch = dir.y != null && Number.isFinite(dir.y);

  if (hasPitch) {
    const dy = dir.y as number;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-8) {
      return { vx: 0, vy: HE_DEFAULT_LOFT * speed, vz: speed };
    }
    return {
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      vz: (dz / len) * speed,
    };
  }

  const horiz = Math.hypot(dx, dz);
  const nx = horiz < 1e-8 ? 0 : dx / horiz;
  const nz = horiz < 1e-8 ? 1 : dz / horiz;
  return {
    vx: nx * speed,
    vy: HE_DEFAULT_LOFT * speed,
    vz: nz * speed,
  };
}

/**
 * Initial velocity + ballistic samples for an HE throw.
 * `power` scales base speed (clamped to [0.15, 2]).
 */
export function throwGrenade(
  origin: ThrowOrigin,
  dir: ThrowDir,
  power: number,
  opts?: ThrowOptions,
): ThrowResult {
  const fuse = opts?.fuse ?? HE_FUSE;
  const gravity = opts?.gravity ?? HE_GRAVITY;
  const groundY = opts?.groundY ?? 0;
  const baseSpeed = opts?.baseSpeed ?? HE_BASE_SPEED;
  const sampleCount = Math.max(2, Math.floor(opts?.sampleCount ?? 19));

  const ox = origin.x;
  const oy = origin.y ?? HE_DEFAULT_ORIGIN_Y;
  const oz = origin.z;

  const p = Number.isFinite(power) ? Math.max(0.15, Math.min(2, power)) : 1;
  const speed = baseSpeed * p;
  const velocity = initialVelocity(dir, speed);

  const samples: TrajectorySample[] = [];
  let grounded = false;
  const dt = fuse / (sampleCount - 1);

  for (let i = 0; i < sampleCount; i++) {
    const t = i * dt;
    const x = ox + velocity.vx * t;
    const z = oz + velocity.vz * t;
    let y = oy + velocity.vy * t - 0.5 * gravity * t * t;

    if (y <= groundY) {
      samples.push({ t, x, y: groundY, z });
      grounded = true;
      break;
    }
    samples.push({ t, x, y, z });
  }

  return {
    origin: { x: ox, y: oy, z: oz },
    velocity,
    samples,
    fuse,
    grounded,
  };
}

/**
 * Radial HE damage at (x,z). Linear falloff, radius 4, max 80.
 * Dead players (`alive === false`) are skipped.
 */
export function explodeAt(
  x: number,
  z: number,
  players: readonly GrenadePlayer[],
  opts?: ExplodeOptions,
): GrenadeHit[] {
  const radius = opts?.radius ?? HE_RADIUS;
  const maxDamage = opts?.maxDamage ?? HE_MAX_DAMAGE;
  const hits: GrenadeHit[] = [];

  for (const p of players) {
    if (p.alive === false) continue;
    const distance = Math.hypot(p.x - x, p.z - z);
    const damage = heDamageAt(distance, radius, maxDamage);
    if (damage > 0) {
      hits.push({ id: p.id, damage, distance });
    }
  }

  return hits;
}
