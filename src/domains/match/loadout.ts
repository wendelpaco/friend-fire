/**
 * CS-style default loadout after death: knife + team pistol, no armor/HE.
 */

import type { Team } from "@/shared/types/team";
import type { WeaponId } from "@/domains/combat";
import { WEAPONS } from "@/domains/combat";

export type LoadoutSlice = {
  weapons: Partial<Record<number, WeaponId>>;
  ammo: Partial<Record<WeaponId, { mag: number; reserve: number }>>;
  weaponSlot: number;
  armor: number;
  heCount: number;
};

/** TR = Glock, CT = USP (CS defaults). */
export function teamPistol(team: Team): WeaponId {
  return team === "TR" ? "glock" : "usp";
}

/** Fresh buy-phase loadout after dying last round. */
export function defaultPostDeathLoadout(team: Team): LoadoutSlice {
  const pistol = teamPistol(team);
  const def = WEAPONS[pistol];
  const knife = WEAPONS.knife;
  return {
    weapons: {
      [def.slot]: pistol,
      [knife.slot]: "knife",
    },
    ammo: {
      [pistol]: { mag: def.magazine, reserve: def.reserve },
    },
    weaponSlot: def.slot,
    armor: 0,
    heCount: 0,
  };
}

/** Apply strip in place-friendly form. */
export function applyDefaultLoadout<T extends LoadoutSlice & { team: Team }>(
  p: T,
): T {
  const d = defaultPostDeathLoadout(p.team);
  return {
    ...p,
    weapons: d.weapons,
    ammo: d.ammo,
    weaponSlot: d.weaponSlot,
    armor: d.armor,
    heCount: d.heCount,
  };
}
