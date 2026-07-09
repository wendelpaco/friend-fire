import type { RoundPhase } from "@/domains/match";
import type { WeaponId } from "./types";
import { WEAPONS } from "./weapons";

export type ShopCategory = "pistol" | "smg" | "rifle" | "sniper" | "gear";

export interface ShopCatalogItem {
  id: string;
  name: string;
  price: number;
  category: ShopCategory;
  /** Weapon granted (slot from WEAPONS) */
  weaponId?: WeaponId;
  /** Armor points to set (max with current) */
  armorAmount?: number;
  /** HE grenades granted (stack) — wave5 §2.4 */
  heAmount?: number;
  emoji: string;
}

export const SHOP_CATALOG: ShopCatalogItem[] = [
  {
    id: "glock",
    name: "GLOCK-18",
    price: 200,
    category: "pistol",
    weaponId: "glock",
    emoji: "🔫",
  },
  {
    id: "usp",
    name: "USP-S",
    price: 500,
    category: "pistol",
    weaponId: "usp",
    emoji: "🔫",
  },
  {
    id: "deagle",
    name: "DESERT EAGLE",
    price: 700,
    category: "pistol",
    weaponId: "deagle",
    emoji: "🔫",
  },
  {
    id: "mp5",
    name: "MP5",
    price: 1500,
    category: "smg",
    weaponId: "mp5",
    emoji: "💥",
  },
  {
    id: "galil",
    name: "GALIL AR",
    price: 2000,
    category: "rifle",
    weaponId: "galil",
    emoji: "🪖",
  },
  {
    id: "ak47",
    name: "AK-47",
    price: 2700,
    category: "rifle",
    weaponId: "ak47",
    emoji: "🪖",
  },
  {
    id: "awp",
    name: "AWP",
    price: 4750,
    category: "sniper",
    weaponId: "awp",
    emoji: "🎯",
  },
  {
    id: "armor",
    name: "COLETE",
    price: 650,
    category: "gear",
    armorAmount: 100,
    emoji: "🛡",
  },
  {
    id: "he",
    name: "GRANADA HE",
    price: 300,
    category: "gear",
    heAmount: 1,
    emoji: "💣",
  },
];

/**
 * Shop is open during warmup (practice) and dedicated buy freezetime.
 * Locked during live combat, round-end banner, and match over.
 */
export function canOpenBuyMenu(phase: RoundPhase): boolean {
  return phase === "warmup" || phase === "buy";
}

export type BuyResult =
  | { ok: true; money: number; message: string }
  | { ok: false; reason: string };

export interface BuyPlayerSlice {
  money: number;
  armor: number;
  weapons: Partial<Record<number, WeaponId>>;
  ammo: Partial<Record<WeaponId, { mag: number; reserve: number }>>;
  weaponSlot: number;
  /** Owned HE grenade count (wave5 §2.4). */
  heCount?: number;
}

/** Pure purchase apply — returns new player money/loadout fields. */
export function tryBuy(
  player: BuyPlayerSlice,
  itemId: string,
): BuyResult & { player?: BuyPlayerSlice } {
  const item = SHOP_CATALOG.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: "Item inválido" };
  if (player.money < item.price) {
    return { ok: false, reason: "Dinheiro insuficiente" };
  }

  const next: BuyPlayerSlice = {
    money: player.money - item.price,
    armor: player.armor,
    weapons: { ...player.weapons },
    ammo: { ...player.ammo },
    weaponSlot: player.weaponSlot,
    heCount: player.heCount ?? 0,
  };

  if (item.armorAmount != null) {
    if (player.armor >= item.armorAmount) {
      return { ok: false, reason: "Colete já equipado" };
    }
    next.armor = item.armorAmount;
    return {
      ok: true,
      money: next.money,
      message: `Comprou ${item.name}`,
      player: next,
    };
  }

  if (item.heAmount != null && item.heAmount > 0) {
    const cur = player.heCount ?? 0;
    if (cur >= 2) {
      return { ok: false, reason: "Máximo de HE" };
    }
    next.heCount = Math.min(2, cur + item.heAmount);
    return {
      ok: true,
      money: next.money,
      message: `Comprou ${item.name}`,
      player: next,
    };
  }

  if (item.weaponId) {
    const def = WEAPONS[item.weaponId];
    next.weapons[def.slot] = item.weaponId;
    next.ammo[item.weaponId] = {
      mag: def.magazine,
      reserve: def.reserve,
    };
    next.weaponSlot = def.slot;
    return {
      ok: true,
      money: next.money,
      message: `Comprou ${item.name}`,
      player: next,
    };
  }

  return { ok: false, reason: "Item inválido" };
}
