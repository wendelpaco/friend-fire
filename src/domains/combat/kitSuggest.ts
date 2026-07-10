import { SHOP_CATALOG, type ShopCatalogItem } from "./shop";

/** Full-screen shop showcase duration (Meta-2). */
export const SHOWCASE_MS = 6500;

export type KitTier = "ECO" | "FORCE" | "FULL";

export type KitSuggestion = {
  tier: KitTier;
  label: string;
  itemIds: string[];
  totalPrice: number;
  blurb: string;
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

/**
 * Pure kit suggestions from money only (Meta-2 showcase).
 *
 * - ECO: armor or pistol when $ < 2000
 * - FORCE: SMG / Galil mid-buy
 * - FULL: AK / AWP when affordable
 */
export function suggestKits(money: number): KitSuggestion[] {
  const out: KitSuggestion[] = [];

  // ECO — light spend
  if (money < 2000) {
    const armor = item("armor");
    if (armor && money >= armor.price) {
      out.push({
        tier: "ECO",
        label: "ECO",
        itemIds: ["armor"],
        totalPrice: armor.price,
        blurb: "Colete e joga utilitário",
      });
    } else {
      // Cheapest affordable pistol, prefer deagle if can, else glock
      const pistolIds = ["deagle", "usp", "glock"] as const;
      let pick: string | null = null;
      for (const id of pistolIds) {
        const it = item(id);
        if (it && money >= it.price) {
          pick = id;
          break;
        }
      }
      if (pick) {
        out.push({
          tier: "ECO",
          label: "ECO",
          itemIds: [pick],
          totalPrice: priceOf([pick]),
          blurb: "Pistola e guarda o resto",
        });
      } else if (money >= 200) {
        out.push({
          tier: "ECO",
          label: "ECO",
          itemIds: ["glock"],
          totalPrice: priceOf(["glock"]),
          blurb: "Pistola básica",
        });
      }
    }
  } else {
    // Still show a thrifty ECO line when rich enough for gear+pistol
    const ecoIds: string[] = [];
    if (money >= 650) ecoIds.push("armor");
    if (money >= 650 + 700) ecoIds.push("deagle");
    else if (money >= 650 + 200 || money >= 200) {
      if (!ecoIds.includes("armor") || money - 650 >= 200) {
        if (money >= 200 && !ecoIds.includes("deagle")) ecoIds.push("glock");
      }
    }
    if (ecoIds.length > 0 && priceOf(ecoIds) <= money) {
      out.push({
        tier: "ECO",
        label: "ECO",
        itemIds: ecoIds,
        totalPrice: priceOf(ecoIds),
        blurb: "Economiza para o próximo",
      });
    }
  }

  // FORCE — mid: MP5 or Galil (+ armor if fits)
  const forcePrimary =
    money >= 2000 + 650
      ? "galil"
      : money >= 1500
        ? "mp5"
        : money >= 2000
          ? "galil"
          : null;
  if (forcePrimary) {
    const ids = [forcePrimary];
    const withArmor = [...ids, "armor"];
    const useArmor =
      money >= priceOf(withArmor) && priceOf(withArmor) <= money;
    const finalIds = useArmor ? withArmor : ids;
    if (money >= priceOf(finalIds)) {
      out.push({
        tier: "FORCE",
        label: "FORCE",
        itemIds: finalIds,
        totalPrice: priceOf(finalIds),
        blurb:
          forcePrimary === "galil"
            ? "Rifle barato · pressão"
            : "SMG · entry rápido",
      });
    }
  }

  // FULL — AK and/or AWP when can afford
  if (money >= 2700) {
    const fullIds: string[] = [];
    if (money >= 4750) {
      fullIds.push("awp");
    } else {
      fullIds.push("ak47");
    }
    if (money >= priceOf([...fullIds, "armor"])) {
      fullIds.push("armor");
    }
    // Prefer AK+armor over bare AWP when both fit and money is mid-full
    if (money >= 2700 + 650 && money < 4750) {
      fullIds.length = 0;
      fullIds.push("ak47", "armor");
    } else if (money >= 4750 + 650) {
      // keep awp + armor already
    } else if (money >= 4750 && money < 4750 + 650) {
      fullIds.length = 0;
      fullIds.push("awp");
    }

    out.push({
      tier: "FULL",
      label: "FULL",
      itemIds: fullIds,
      totalPrice: priceOf(fullIds),
      blurb: fullIds.includes("awp")
        ? "AWP · controle de mapa"
        : "AK + colete · round full",
    });
  }

  return out;
}

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
