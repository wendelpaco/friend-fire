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
