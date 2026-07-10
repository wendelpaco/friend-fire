/**
 * Server shop catalog — mirror client SHOP_CATALOG + tryBuy semantics.
 */
import {
  getWeapon,
  type WeaponId,
  type WeaponStats,
  WEAPONS,
} from "./weapons";

export type ShopCategory = "pistol" | "smg" | "rifle" | "sniper" | "gear";

export interface ShopCatalogItem {
  id: string;
  name: string;
  price: number;
  category: ShopCategory;
  weaponId?: WeaponId;
  armorAmount?: number;
  heAmount?: number;
}

export const SHOP_CATALOG: ShopCatalogItem[] = [
  { id: "glock", name: "GLOCK-18", price: 200, category: "pistol", weaponId: "glock" },
  { id: "usp", name: "USP-S", price: 500, category: "pistol", weaponId: "usp" },
  { id: "deagle", name: "DESERT EAGLE", price: 700, category: "pistol", weaponId: "deagle" },
  { id: "mp5", name: "MP5", price: 1500, category: "smg", weaponId: "mp5" },
  { id: "galil", name: "GALIL AR", price: 2000, category: "rifle", weaponId: "galil" },
  { id: "ak47", name: "AK-47", price: 2700, category: "rifle", weaponId: "ak47" },
  { id: "awp", name: "AWP", price: 4750, category: "sniper", weaponId: "awp" },
  { id: "armor", name: "COLETE", price: 650, category: "gear", armorAmount: 100 },
  /** HE grenade — grants +1 heCount (max 2). */
  { id: "he", name: "GRANADA HE", price: 300, category: "gear", heAmount: 1 },
];

export type RoundPhase =
  | "warmup"
  | "buy"
  | "live"
  | "ended"
  | "match_over";

export function canBuyInPhase(phase: string): boolean {
  return phase === "warmup" || phase === "buy";
}

export type BuyResult =
  | { ok: true; money: number; message: string }
  | { ok: false; reason: string };

/** Minimal loadout surface for pure tryBuy (schema-backed fields). */
export interface BuyLoadout {
  money: number;
  armor: number;
  primaryId: string;
  secondaryId: string;
  activeSlot: number;
  mag: number;
  reserve: number;
  heCount: number;
}

export type AmmoMap = Record<string, { mag: number; reserve: number }>;

const HE_MAX = 2;

export function tryBuy(
  player: BuyLoadout,
  itemId: string,
  ammo: AmmoMap,
): BuyResult & { player?: BuyLoadout; ammo?: AmmoMap } {
  const item = SHOP_CATALOG.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: "Item inválido" };
  if (player.money < item.price) {
    return { ok: false, reason: "Dinheiro insuficiente" };
  }

  const next: BuyLoadout = {
    money: player.money - item.price,
    armor: player.armor,
    primaryId: player.primaryId,
    secondaryId: player.secondaryId,
    activeSlot: player.activeSlot,
    mag: player.mag,
    reserve: player.reserve,
    heCount: player.heCount,
  };
  const nextAmmo: AmmoMap = { ...ammo };

  if (item.id === "he") {
    if (player.heCount >= HE_MAX) {
      return { ok: false, reason: "Máximo de HE" };
    }
    next.heCount = player.heCount + 1;
    return {
      ok: true,
      money: next.money,
      message: `Comprou ${item.name}`,
      player: next,
      ammo: nextAmmo,
    };
  }

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
      ammo: nextAmmo,
    };
  }

  if (item.weaponId) {
    const def = WEAPONS[item.weaponId] as WeaponStats;
    // Skip re-purchase when already equipped (rebuy / double-buy safe)
    if (def.slot === 1 && player.primaryId === item.weaponId) {
      return { ok: false, reason: "Arma já equipada" };
    }
    if (def.slot === 2 && player.secondaryId === item.weaponId) {
      return { ok: false, reason: "Arma já equipada" };
    }
    const pack = { mag: def.magazine, reserve: def.reserve };
    nextAmmo[item.weaponId] = pack;
    if (def.slot === 1) {
      next.primaryId = item.weaponId;
    } else if (def.slot === 2) {
      next.secondaryId = item.weaponId;
    }
    next.activeSlot = def.slot;
    next.mag = pack.mag;
    next.reserve = pack.reserve;
    return {
      ok: true,
      money: next.money,
      message: `Comprou ${item.name}`,
      player: next,
      ammo: nextAmmo,
    };
  }

  return { ok: false, reason: "Item inválido" };
}

export type KitTier = "ECO" | "FORCE" | "FULL";

function catalogPrice(id: string): number {
  return SHOP_CATALOG.find((i) => i.id === id)?.price ?? 0;
}

function priceOf(ids: string[]): number {
  return ids.reduce((s, id) => s + catalogPrice(id), 0);
}

/** Mirror client suggestKits — keep affordable tiers only. */
export function suggestKits(
  money: number,
): { tier: KitTier; itemIds: string[]; totalPrice: number }[] {
  const out: { tier: KitTier; itemIds: string[]; totalPrice: number }[] = [];

  // ECO
  if (money < 2000) {
    if (money >= 650) {
      out.push({ tier: "ECO", itemIds: ["armor"], totalPrice: 650 });
    } else {
      for (const id of ["deagle", "usp", "glock"] as const) {
        const p = catalogPrice(id);
        if (p > 0 && money >= p) {
          out.push({ tier: "ECO", itemIds: [id], totalPrice: p });
          break;
        }
      }
    }
  } else {
    const ecoIds: string[] = [];
    if (money >= 650) ecoIds.push("armor");
    const rest = money - priceOf(ecoIds);
    if (rest >= 700) ecoIds.push("deagle");
    else if (rest >= 200) ecoIds.push("glock");
    if (ecoIds.length > 0 && priceOf(ecoIds) <= money) {
      out.push({ tier: "ECO", itemIds: ecoIds, totalPrice: priceOf(ecoIds) });
    }
  }

  // FORCE
  if (money >= 1500) {
    const primary = money >= 2000 ? "galil" : "mp5";
    const ids =
      money >= priceOf([primary, "armor"]) ? [primary, "armor"] : [primary];
    if (money >= priceOf(ids)) {
      out.push({ tier: "FORCE", itemIds: ids, totalPrice: priceOf(ids) });
    }
  }

  // FULL
  if (money >= 2700) {
    let fullIds: string[];
    if (money >= 4750 + 650) fullIds = ["awp", "armor"];
    else if (money >= 4750) fullIds = ["awp"];
    else if (money >= 2700 + 650) fullIds = ["ak47", "armor"];
    else fullIds = ["ak47"];
    if (priceOf(fullIds) <= money) {
      out.push({ tier: "FULL", itemIds: fullIds, totalPrice: priceOf(fullIds) });
    }
  }

  return out;
}

/** Buy items in sequence; skips failures (already owned / broke). */
export function tryBuySequence(
  player: BuyLoadout,
  ammo: AmmoMap,
  itemIds: readonly string[],
): BuyResult & { player?: BuyLoadout; ammo?: AmmoMap; bought: string[] } {
  let curP = player;
  let curAmmo = ammo;
  const bought: string[] = [];
  for (const id of itemIds) {
    const r = tryBuy(curP, id, curAmmo);
    if (r.ok && r.player) {
      curP = r.player;
      if (r.ammo) curAmmo = r.ammo;
      bought.push(id);
    }
  }
  if (bought.length === 0) {
    return { ok: false, reason: "Nada comprado", bought };
  }
  return {
    ok: true,
    money: curP.money,
    message: `Kit: ${bought.join(", ")}`,
    player: curP,
    ammo: curAmmo,
    bought,
  };
}

export function tryBuyKit(
  player: BuyLoadout,
  ammo: AmmoMap,
  tier: KitTier,
): BuyResult & { player?: BuyLoadout; ammo?: AmmoMap; bought: string[] } {
  const kit = suggestKits(player.money).find((k) => k.tier === tier);
  if (!kit) return { ok: false, reason: "Kit indisponível", bought: [] };
  if (kit.totalPrice > player.money) {
    return { ok: false, reason: "Dinheiro insuficiente", bought: [] };
  }
  return tryBuySequence(player, ammo, kit.itemIds);
}

export function tryRebuy(
  player: BuyLoadout,
  ammo: AmmoMap,
  itemIds: readonly string[],
): BuyResult & { player?: BuyLoadout; ammo?: AmmoMap; bought: string[] } {
  if (!itemIds.length) {
    return { ok: false, reason: "Sem loadout anterior", bought: [] };
  }
  const r = tryBuySequence(player, ammo, itemIds);
  if (!r.ok) return r;
  return { ...r, message: `Rebuy: ${r.bought?.join(", ") ?? ""}` };
}

export function shopIdForWeapon(weaponId: string): string | null {
  const found = SHOP_CATALOG.find((i) => i.weaponId === weaponId);
  return found?.id ?? null;
}

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

export function weaponIdForSlot(
  primaryId: string,
  secondaryId: string,
  slot: number,
): string {
  if (slot === 1) return primaryId;
  if (slot === 2) return secondaryId;
  if (slot === 4) return "knife";
  return "";
}

export function ownsSlot(
  primaryId: string,
  secondaryId: string,
  slot: number,
): boolean {
  if (slot === 4) return true;
  if (slot === 1) return Boolean(primaryId);
  if (slot === 2) return Boolean(secondaryId);
  return false;
}

export function activeWeaponStats(
  primaryId: string,
  secondaryId: string,
  activeSlot: number,
): WeaponStats | undefined {
  const id = weaponIdForSlot(primaryId, secondaryId, activeSlot);
  return id ? getWeapon(id) : undefined;
}
