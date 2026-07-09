/** Server weapon stats — keep damage/cooldown/ammo aligned with client WEAPONS. */

export type WeaponId =
  | "knife"
  | "glock"
  | "deagle"
  | "usp"
  | "ak47"
  | "galil"
  | "mp5"
  | "awp";

export interface WeaponStats {
  id: WeaponId;
  slot: 1 | 2 | 4;
  damage: number;
  /** Milliseconds between shots (client fireRate). */
  fireRateMs: number;
  magazine: number;
  reserve: number;
  range: number;
  isMelee?: boolean;
  price?: number;
}

export const WEAPONS: Record<WeaponId, WeaponStats> = {
  knife: {
    id: "knife",
    slot: 4,
    damage: 55,
    fireRateMs: 450,
    magazine: 1,
    reserve: 0,
    range: 1.4,
    isMelee: true,
  },
  glock: {
    id: "glock",
    slot: 2,
    damage: 28,
    fireRateMs: 170,
    magazine: 20,
    reserve: 120,
    range: 45,
    price: 200,
  },
  usp: {
    id: "usp",
    slot: 2,
    damage: 33,
    fireRateMs: 200,
    magazine: 12,
    reserve: 100,
    range: 48,
    price: 500,
  },
  deagle: {
    id: "deagle",
    slot: 2,
    damage: 63,
    fireRateMs: 420,
    magazine: 7,
    reserve: 35,
    range: 50,
    price: 700,
  },
  mp5: {
    id: "mp5",
    slot: 1,
    damage: 26,
    fireRateMs: 85,
    magazine: 30,
    reserve: 120,
    range: 40,
    price: 1500,
  },
  galil: {
    id: "galil",
    slot: 1,
    damage: 32,
    fireRateMs: 95,
    magazine: 35,
    reserve: 90,
    range: 52,
    price: 2000,
  },
  ak47: {
    id: "ak47",
    slot: 1,
    damage: 36,
    fireRateMs: 100,
    magazine: 30,
    reserve: 90,
    range: 55,
    price: 2700,
  },
  awp: {
    id: "awp",
    slot: 1,
    damage: 110,
    fireRateMs: 1400,
    magazine: 10,
    reserve: 30,
    range: 80,
    price: 4750,
  },
};

export const START_MONEY = 800;

export function isWeaponId(id: string): id is WeaponId {
  return Object.prototype.hasOwnProperty.call(WEAPONS, id);
}

export function getWeapon(id: string): WeaponStats | undefined {
  if (!isWeaponId(id)) return undefined;
  return WEAPONS[id];
}

export function cooldownSec(w: WeaponStats): number {
  return w.fireRateMs / 1000;
}

/** Team pistol for join loadout. */
export function starterSecondary(team: string): WeaponId {
  return team === "CT" ? "usp" : "glock";
}

/** Bot primary by team (full kit). */
export function botPrimary(team: string): WeaponId {
  return team === "CT" ? "mp5" : "ak47";
}

export function fullAmmo(w: WeaponStats): { mag: number; reserve: number } {
  return { mag: w.magazine, reserve: w.reserve };
}
