import { SHOP_CATALOG, type ShopCatalogItem } from "./shop";

/** Full-screen shop showcase duration (Meta-2). */
export const SHOWCASE_MS = 6500;

/** Kit tiers — UI labels ECO / FORÇA / COMPLETO (F1–F3). */
export type KitTier = "ECO" | "FORCE" | "FULL";

export type KitSuggestion = {
  tier: KitTier;
  /** Display label (PT-BR). */
  label: string;
  itemIds: string[];
  totalPrice: number;
  blurb: string;
};

const TIER_LABEL: Record<KitTier, string> = {
  ECO: "ECO",
  FORCE: "FORÇA",
  FULL: "COMPLETO",
};

function item(id: string): ShopCatalogItem | undefined {
  return SHOP_CATALOG.find((i) => i.id === id);
}

function priceOf(ids: string[]): number {
  let total = 0;
  for (const id of ids) {
    const it = item(id);
    if (it) total += it.price;
  }
  return total;
}

function makeKit(
  tier: KitTier,
  itemIds: string[],
  blurb: string,
): KitSuggestion | null {
  if (itemIds.length === 0) return null;
  const totalPrice = priceOf(itemIds);
  if (totalPrice <= 0) return null;
  return {
    tier,
    label: TIER_LABEL[tier],
    itemIds,
    totalPrice,
    blurb,
  };
}

/** Pick cheapest affordable pistol id, prefer deagle → usp → glock. */
function affordablePistol(money: number): string | null {
  for (const id of ["deagle", "usp", "glock"] as const) {
    const it = item(id);
    if (it && money >= it.price) return id;
  }
  return null;
}

function buildEco(money: number): KitSuggestion | null {
  // Thrifty: armor and/or pistol when it fits
  if (money < 2000) {
    const armor = item("armor");
    if (armor && money >= armor.price) {
      return makeKit("ECO", ["armor"], "Colete e joga utilitário");
    }
    const pick = affordablePistol(money);
    if (pick) {
      return makeKit("ECO", [pick], "Pistola e guarda o resto");
    }
    return null;
  }

  const ecoIds: string[] = [];
  const armor = item("armor");
  if (armor && money >= armor.price) ecoIds.push("armor");
  const rest = money - priceOf(ecoIds);
  if (rest >= 700 && item("deagle")) ecoIds.push("deagle");
  else if (rest >= 200 && item("glock")) ecoIds.push("glock");
  if (ecoIds.length === 0) return null;
  if (priceOf(ecoIds) > money) return null;
  return makeKit("ECO", ecoIds, "Economiza para o próximo");
}

function buildForce(money: number): KitSuggestion | null {
  // Mid: MP5 or Galil (+ armor if fits). Need at least SMG money.
  if (money < 1500) return null;
  const forcePrimary =
    money >= 2000 + 650
      ? "galil"
      : money >= 2000
        ? "galil"
        : money >= 1500
          ? "mp5"
          : null;
  if (!forcePrimary) return null;
  const ids = [forcePrimary];
  const withArmor = [...ids, "armor"];
  const finalIds =
    money >= priceOf(withArmor) ? withArmor : ids;
  if (money < priceOf(finalIds)) return null;
  return makeKit(
    "FORCE",
    finalIds,
    forcePrimary === "galil" ? "Rifle barato · pressão" : "SMG · entry rápido",
  );
}

function buildFull(money: number): KitSuggestion | null {
  if (money < 2700) return null;
  let fullIds: string[] = [];
  if (money >= 4750 + 650) {
    fullIds = ["awp", "armor"];
  } else if (money >= 4750) {
    fullIds = ["awp"];
  } else if (money >= 2700 + 650) {
    fullIds = ["ak47", "armor"];
  } else {
    fullIds = ["ak47"];
  }
  if (priceOf(fullIds) > money) return null;
  return makeKit(
    "FULL",
    fullIds,
    fullIds.includes("awp")
      ? "AWP · controle de mapa"
      : "AK + colete · round full",
  );
}

/**
 * Pure kit suggestions from money (1-click ECO / FORÇA / COMPLETO).
 * Always returns up to 3 tiers when the wallet can afford each tier.
 * Item lists are recalculated so every suggestion is affordable.
 */
export function suggestKits(money: number): KitSuggestion[] {
  const out: KitSuggestion[] = [];
  const eco = buildEco(money);
  if (eco) out.push(eco);
  const force = buildForce(money);
  if (force) out.push(force);
  const full = buildFull(money);
  if (full) out.push(full);
  return out;
}

/** Hotkey order: F1 ECO, F2 FORCE, F3 FULL. */
export const KIT_HOTKEY_TIERS: readonly KitTier[] = [
  "ECO",
  "FORCE",
  "FULL",
] as const;

/** Showcase weapon row: top catalog picks the player can browse (not auto-buy). */
export function showcaseWeaponIds(money: number): string[] {
  const preferred = [
    "ak47",
    "awp",
    "galil",
    "mp5",
    "deagle",
    "armor",
    "he",
  ];
  const affordable = preferred.filter((id) => {
    const it = item(id);
    return it != null && money >= it.price;
  });
  if (affordable.length >= 4) return affordable.slice(0, 6);
  // Pad with catalog order even if unaffordable for visual density
  const rest = SHOP_CATALOG.map((i) => i.id).filter(
    (id) => !affordable.includes(id),
  );
  return [...affordable, ...rest].slice(0, 6);
}
