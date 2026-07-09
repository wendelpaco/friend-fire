import type { Ammo, WeaponDef, WeaponId } from "./types";
import { WEAPONS } from "./weapons";

export function canReload(ammo: Ammo, def: WeaponDef): boolean {
  if (def.isMelee) return false;
  return ammo.reserve > 0 && ammo.mag < def.magazine;
}

/** Returns `reloadingUntil` timestamp, or null if reload cannot start. */
export function beginReload(
  ammo: Ammo,
  weaponId: WeaponId,
  now: number,
): number | null {
  const def = WEAPONS[weaponId];
  if (!canReload(ammo, def)) return null;
  return now + def.reloadTime;
}

export function completeReload(ammo: Ammo, weaponId: WeaponId): Ammo {
  const def = WEAPONS[weaponId];
  const need = def.magazine - ammo.mag;
  const take = Math.min(need, ammo.reserve);
  return { mag: ammo.mag + take, reserve: ammo.reserve - take };
}

/** Alias matching plan interface name. */
export const startReload = beginReload;
/** Alias matching plan interface name. */
export const finishReload = completeReload;
