/**
 * Ground weapon drops + pickup (CS eco C2b / E1).
 * Pure helpers — no I/O. Knife never drops.
 */

import type { WeaponId } from "./types";
import { WEAPONS } from "./weapons";

/** World entity for a gun on the floor after death or slot swap. */
export interface WorldWeaponDrop {
  id: string;
  x: number;
  z: number;
  weaponId: WeaponId;
  ammoMag: number;
  ammoReserve: number;
  fromPlayerId: string;
}

/** Living player must be within this radius to pick up (E or walk-over). */
export const WEAPON_DROP_PICKUP_RADIUS = 1.2;

/** Slight XY offsets so primary + secondary don't stack on the same point. */
const SLOT_OFFSET: Record<number, { x: number; z: number }> = {
  1: { x: 0.35, z: 0.1 },
  2: { x: -0.35, z: -0.1 },
};

export function isDroppableWeaponId(id: string | null | undefined): id is WeaponId {
  if (!id || !(id in WEAPONS)) return false;
  const def = WEAPONS[id as WeaponId];
  return !def.isMelee && def.slot !== 4;
}

export function squaredDistXZ(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export type DeathDropSource = {
  playerId: string;
  x: number;
  z: number;
  /** Slot → weapon (client shape). Knife ignored. */
  weapons: Partial<Record<number, WeaponId | string>>;
  ammo: Partial<Record<string, { mag: number; reserve: number }>>;
};

/**
 * Build ground drops for primary (slot 1) and/or secondary (slot 2).
 * Does not mutate source. Caller assigns via `makeId`.
 */
export function createDeathWeaponDrops(
  source: DeathDropSource,
  makeId: () => string,
): WorldWeaponDrop[] {
  const out: WorldWeaponDrop[] = [];
  for (const slot of [1, 2] as const) {
    const wid = source.weapons[slot];
    if (!isDroppableWeaponId(wid)) continue;
    const bag = source.ammo[wid];
    const def = WEAPONS[wid];
    const off = SLOT_OFFSET[slot] ?? { x: 0, z: 0 };
    out.push({
      id: makeId(),
      x: source.x + off.x,
      z: source.z + off.z,
      weaponId: wid,
      ammoMag: Math.max(0, Math.floor(bag?.mag ?? def.magazine)),
      ammoReserve: Math.max(0, Math.floor(bag?.reserve ?? def.reserve)),
      fromPlayerId: source.playerId,
    });
  }
  return out;
}

/**
 * Server loadout shape → death drops (primaryId / secondaryId).
 */
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
  return createDeathWeaponDrops(
    {
      playerId: source.playerId,
      x: source.x,
      z: source.z,
      weapons: {
        1: source.primaryId || undefined,
        2: source.secondaryId || undefined,
      },
      ammo: source.ammo,
    },
    makeId,
  );
}

/** Nearest drop within radius, or null. */
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
    const dist = squaredDistXZ(x, z, d.x, d.z);
    if (dist <= r2 && dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

export type PickupLoadout = {
  weapons: Partial<Record<number, WeaponId>>;
  ammo: Partial<Record<WeaponId, { mag: number; reserve: number }>>;
  weaponSlot: number;
};

export type ApplyWeaponPickupResult = {
  player: PickupLoadout;
  removeDropId: string;
  /** Old gun put on ground when the slot was occupied (caller assigns id). */
  swapDrop: Omit<WorldWeaponDrop, "id"> | null;
};

/**
 * Pick up `drop` into its weapon slot. Replaces existing slot gun;
 * previous droppable gun becomes `swapDrop` at player feet.
 * Returns null if drop is invalid / non-droppable.
 */
export function applyWeaponPickup(
  player: PickupLoadout,
  drop: WorldWeaponDrop,
  playerPos: { x: number; z: number; id?: string },
): ApplyWeaponPickupResult | null {
  if (!isDroppableWeaponId(drop.weaponId)) return null;
  const def = WEAPONS[drop.weaponId];
  const slot = def.slot;
  if (slot !== 1 && slot !== 2) return null;

  const oldId = player.weapons[slot];
  let swapDrop: Omit<WorldWeaponDrop, "id"> | null = null;

  if (oldId && isDroppableWeaponId(oldId)) {
    const oldBag = player.ammo[oldId];
    const oldDef = WEAPONS[oldId];
    swapDrop = {
      x: playerPos.x,
      z: playerPos.z,
      weaponId: oldId,
      ammoMag: Math.max(0, Math.floor(oldBag?.mag ?? 0)),
      ammoReserve: Math.max(0, Math.floor(oldBag?.reserve ?? 0)),
      fromPlayerId: playerPos.id ?? drop.fromPlayerId,
    };
    // Preserve full default only if bag missing and we still want something on ground
    if (!oldBag) {
      swapDrop.ammoMag = oldDef.magazine;
      swapDrop.ammoReserve = 0;
    }
  }

  const nextWeapons: Partial<Record<number, WeaponId>> = {
    ...player.weapons,
    [slot]: drop.weaponId,
    4: "knife",
  };
  const nextAmmo: Partial<Record<WeaponId, { mag: number; reserve: number }>> =
    {
      ...player.ammo,
    };
  if (oldId && oldId !== drop.weaponId && isDroppableWeaponId(oldId)) {
    delete nextAmmo[oldId];
  }
  nextAmmo[drop.weaponId] = {
    mag: Math.max(0, Math.floor(drop.ammoMag)),
    reserve: Math.max(0, Math.floor(drop.ammoReserve)),
  };

  return {
    player: {
      weapons: nextWeapons,
      ammo: nextAmmo,
      weaponSlot: slot,
    },
    removeDropId: drop.id,
    swapDrop,
  };
}

/**
 * Server-shaped pickup: primaryId / secondaryId + ammo map.
 * Returns null if nothing to apply.
 */
export function applyWeaponPickupServer(
  player: {
    id: string;
    x: number;
    z: number;
    primaryId: string;
    secondaryId: string;
    activeSlot: number;
    mag: number;
    reserve: number;
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
  const weapons: Partial<Record<number, WeaponId>> = { 4: "knife" };
  if (isDroppableWeaponId(player.primaryId)) {
    weapons[1] = player.primaryId;
  }
  if (isDroppableWeaponId(player.secondaryId)) {
    weapons[2] = player.secondaryId;
  }
  // Ammo map may only hold string keys; cast for shared helper.
  const ammoSlice: Partial<
    Record<WeaponId, { mag: number; reserve: number }>
  > = {};
  for (const [k, v] of Object.entries(ammo)) {
    if (isDroppableWeaponId(k) && v) ammoSlice[k] = { ...v };
  }

  const result = applyWeaponPickup(
    {
      weapons,
      ammo: ammoSlice,
      weaponSlot: player.activeSlot,
    },
    drop,
    { x: player.x, z: player.z, id: player.id },
  );
  if (!result) return null;

  const primary = result.player.weapons[1] ?? "";
  const secondary = result.player.weapons[2] ?? "";
  const nextAmmo: Record<string, { mag: number; reserve: number }> = {};
  for (const [k, v] of Object.entries(result.player.ammo)) {
    if (v) nextAmmo[k] = { mag: v.mag, reserve: v.reserve };
  }
  const activeWid =
    result.player.weaponSlot === 1
      ? primary
      : result.player.weaponSlot === 2
        ? secondary
        : "";
  const activeBag = activeWid ? nextAmmo[activeWid] : undefined;

  return {
    primaryId: typeof primary === "string" ? primary : "",
    secondaryId: typeof secondary === "string" ? secondary : "",
    activeSlot: result.player.weaponSlot,
    mag: activeBag?.mag ?? 0,
    reserve: activeBag?.reserve ?? 0,
    ammo: nextAmmo,
    removeDropId: result.removeDropId,
    swapDrop: result.swapDrop,
  };
}
