/**
 * Ground weapon drops + pickup (server mirror of domains/combat/drops).
 */

import { getWeapon, type WeaponId, WEAPONS } from "./weapons";

export type WorldWeaponDrop = {
  id: string;
  x: number;
  z: number;
  weaponId: WeaponId;
  ammoMag: number;
  ammoReserve: number;
  fromPlayerId: string;
};

export const WEAPON_DROP_PICKUP_RADIUS = 1.2;

const SLOT_OFFSET: Record<number, { x: number; z: number }> = {
  1: { x: 0.35, z: 0.1 },
  2: { x: -0.35, z: -0.1 },
};

export function isDroppableWeaponId(id: string | null | undefined): id is WeaponId {
  if (!id) return false;
  const w = getWeapon(id);
  return !!w && !w.isMelee && w.slot !== 4;
}

export function createDeathWeaponDropsFromIds(
  source: {
    playerId: string;
    x: number;
    z: number;
    primaryId: string;
    secondaryId: string;
    ammo: Partial<Record<string, { mag: number; reserve: number }>>;
  },
  makeId: () => string,
): WorldWeaponDrop[] {
  const out: WorldWeaponDrop[] = [];
  const pairs: Array<{ slot: 1 | 2; id: string }> = [
    { slot: 1, id: source.primaryId },
    { slot: 2, id: source.secondaryId },
  ];
  for (const { slot, id } of pairs) {
    if (!isDroppableWeaponId(id)) continue;
    const def = WEAPONS[id];
    const bag = source.ammo[id];
    const off = SLOT_OFFSET[slot] ?? { x: 0, z: 0 };
    out.push({
      id: makeId(),
      x: source.x + off.x,
      z: source.z + off.z,
      weaponId: id,
      ammoMag: Math.max(0, Math.floor(bag?.mag ?? def.magazine)),
      ammoReserve: Math.max(0, Math.floor(bag?.reserve ?? def.reserve)),
      fromPlayerId: source.playerId,
    });
  }
  return out;
}

export function findNearestWeaponDrop(
  drops: readonly WorldWeaponDrop[],
  x: number,
  z: number,
  radius: number = WEAPON_DROP_PICKUP_RADIUS,
): WorldWeaponDrop | null {
  if (!drops.length) return null;
  const r2 = radius * radius;
  let best: WorldWeaponDrop | null = null;
  let bestD = Infinity;
  for (const d of drops) {
    const dx = x - d.x;
    const dz = z - d.z;
    const dist = dx * dx + dz * dz;
    if (dist <= r2 && dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

export function applyWeaponPickupServer(
  player: {
    id: string;
    x: number;
    z: number;
    primaryId: string;
    secondaryId: string;
    activeSlot: number;
  },
  ammo: Record<string, { mag: number; reserve: number }>,
  drop: WorldWeaponDrop,
): {
  primaryId: string;
  secondaryId: string;
  activeSlot: number;
  mag: number;
  reserve: number;
  ammo: Record<string, { mag: number; reserve: number }>;
  removeDropId: string;
  swapDrop: Omit<WorldWeaponDrop, "id"> | null;
} | null {
  if (!isDroppableWeaponId(drop.weaponId)) return null;
  const def = WEAPONS[drop.weaponId];
  const slot = def.slot;
  if (slot !== 1 && slot !== 2) return null;

  const oldId = slot === 1 ? player.primaryId : player.secondaryId;
  let swapDrop: Omit<WorldWeaponDrop, "id"> | null = null;
  if (isDroppableWeaponId(oldId)) {
    const oldBag = ammo[oldId];
    const oldDef = WEAPONS[oldId];
    swapDrop = {
      x: player.x,
      z: player.z,
      weaponId: oldId,
      ammoMag: Math.max(0, Math.floor(oldBag?.mag ?? oldDef.magazine)),
      ammoReserve: Math.max(0, Math.floor(oldBag?.reserve ?? 0)),
      fromPlayerId: player.id,
    };
  }

  const nextAmmo = { ...ammo };
  if (oldId && oldId !== drop.weaponId && isDroppableWeaponId(oldId)) {
    delete nextAmmo[oldId];
  }
  nextAmmo[drop.weaponId] = {
    mag: Math.max(0, Math.floor(drop.ammoMag)),
    reserve: Math.max(0, Math.floor(drop.ammoReserve)),
  };

  let primaryId = player.primaryId;
  let secondaryId = player.secondaryId;
  if (slot === 1) primaryId = drop.weaponId;
  else secondaryId = drop.weaponId;

  const pack = nextAmmo[drop.weaponId]!;
  return {
    primaryId,
    secondaryId,
    activeSlot: slot,
    mag: pack.mag,
    reserve: pack.reserve,
    ammo: nextAmmo,
    removeDropId: drop.id,
    swapDrop,
  };
}
