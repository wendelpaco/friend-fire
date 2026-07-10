import type { RoundPhase } from "@/domains/match";
import type { KitTier } from "./kitSuggest";
import { suggestKits } from "./kitSuggest";
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

/**
 * Buy multiple catalog items in order; skips unaffordable / already-owned gear.
 * Partial success still returns ok when at least one item bought.
 */
export function tryBuySequence(
  player: BuyPlayerSlice,
  itemIds: readonly string[],
): BuyResult & { player?: BuyPlayerSlice; bought: string[] } {
  let cur = player;
  const bought: string[] = [];
  for (const id of itemIds) {
    const r = tryBuy(cur, id);
    if (r.ok && r.player) {
      cur = r.player;
      bought.push(id);
    }
  }
  if (bought.length === 0) {
    return { ok: false, reason: "Nada comprado", bought };
  }
  const names = bought
    .map((id) => SHOP_CATALOG.find((c) => c.id === id)?.name ?? id)
    .join(", ");
  return {
    ok: true,
    money: cur.money,
    message: `Kit: ${names}`,
    player: cur,
    bought,
  };
}

/** One-click kit: resolve affordable items for tier from current money. */
export function tryBuyKit(
  player: BuyPlayerSlice,
  tier: KitTier,
): BuyResult & { player?: BuyPlayerSlice; bought: string[] } {
  const kit = suggestKits(player.money).find((k) => k.tier === tier);
  if (!kit || kit.itemIds.length === 0) {
    return { ok: false, reason: "Kit indisponível", bought: [] };
  }
  if (kit.totalPrice > player.money) {
    return { ok: false, reason: "Dinheiro insuficiente", bought: [] };
  }
  return tryBuySequence(player, kit.itemIds);
}

/**
 * Rebuy last-round loadout item ids (weapons + armor).
 * Skips items already owned / unaffordable.
 */
export function tryRebuy(
  player: BuyPlayerSlice,
  itemIds: readonly string[],
): BuyResult & { player?: BuyPlayerSlice; bought: string[] } {
  if (!itemIds.length) {
    return { ok: false, reason: "Sem loadout anterior", bought: [] };
  }
  const r = tryBuySequence(player, itemIds);
  if (!r.ok) return { ...r, reason: r.ok ? "Erro" : r.reason };
  return {
    ...r,
    message: r.message.replace(/^Kit:/, "Rebuy:"),
  };
}

/** Map weapon id → shop catalog id (same string for current catalog). */
export function shopIdForWeapon(weaponId: string): string | null {
  const found = SHOP_CATALOG.find((i) => i.weaponId === weaponId);
  return found?.id ?? null;
}

/**
 * Snapshot shop item ids worth rebuying next freezetime.
 * Includes primary, upgraded secondary (non team-default), and full armor.
 */
export function snapshotRebuyItemIds(opts: {
  primaryId?: string | null;
  secondaryId?: string | null;
  teamPistolId?: string | null;
  armor: number;
}): string[] {
  const ids: string[] = [];
  if (opts.primaryId) {
    const sid = shopIdForWeapon(opts.primaryId);
    if (sid) ids.push(sid);
  }
  if (opts.secondaryId && opts.secondaryId !== opts.teamPistolId) {
    const sid = shopIdForWeapon(opts.secondaryId);
    if (sid) ids.push(sid);
  }
  if (opts.armor >= 100) ids.push("armor");
  return ids;
}

/** Optional: auto-open buy menu on freezetime (B still toggles). */
export const AUTO_OPEN_BUY_ON_FREEZETIME = true;

