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
];

export function canOpenBuyMenu(phase: RoundPhase): boolean {
  return phase === "warmup" || phase === "ended";
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
