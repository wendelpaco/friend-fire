/**
 * Simplified HE grenade (server): throw toward aim, fuse, radial damage.
 * Spec §2.4: fuse ~1.8s, radius 4, max damage 80 falloff.
 */

export const HE = {
  price: 300,
  fuse: 1.8,
  radius: 4,
  maxDamage: 80,
  /** Max air time distance along aim (world units). */
  throwRange: 18,
  maxCarry: 2,
} as const;

export interface HeProjectile {
  id: string;
  ownerId: string;
  team: string;
  x: number;
  z: number;
  /** Seconds until detonation. */
  fuseLeft: number;
}

/** Linear falloff  max → 0 over radius. */
export function heDamageAtDistance(dist: number): number {
  if (dist >= HE.radius) return 0;
  if (dist <= 0) return HE.maxDamage;
  return HE.maxDamage * (1 - dist / HE.radius);
}

/**
 * Impact point: toward aim, clamped to throwRange; if aim is under player, short toss forward.
 */
export function heImpactPoint(
  px: number,
  pz: number,
  aimX: number,
  aimZ: number,
  rot: number,
): { x: number; z: number } {
  let dx = aimX - px;
  let dz = aimZ - pz;
  let dist = Math.hypot(dx, dz);
  if (dist < 0.5) {
    dx = Math.sin(rot);
    dz = Math.cos(rot);
    dist = 1;
  }
  const travel = Math.min(HE.throwRange, dist);
  const inv = 1 / dist;
  return {
    x: px + dx * inv * travel,
    z: pz + dz * inv * travel,
  };
}

export function createHeProjectile(
  id: string,
  ownerId: string,
  team: string,
  x: number,
  z: number,
): HeProjectile {
  return { id, ownerId, team, x, z, fuseLeft: HE.fuse };
}

export function tickHeProjectile(
  p: HeProjectile,
  dt: number,
): { proj: HeProjectile; exploded: boolean } {
  const fuseLeft = p.fuseLeft - dt;
  if (fuseLeft <= 0) {
    return { proj: { ...p, fuseLeft: 0 }, exploded: true };
  }
  return { proj: { ...p, fuseLeft }, exploded: false };
}
