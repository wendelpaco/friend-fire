"use client";

import { useMemo, useState } from "react";
import {
 KIT_HOTKEY_TIERS,
 SHOP_CATALOG,
 suggestKits,
 type KitTier,
 type ShopCatalogItem,
 type ShopCategory,
} from "@/domains/combat";
import {
 Button,
 CategoryTabs,
 Panel,
 PriceTag,
 WeaponCard,
} from "@/presentation/ui";
import { ShopItemIcon } from "./shopIcons";

type FilterId = ShopCategory | "all";

interface BuyMenuProps {
 money: number;
 armor: number;
 message: string | null;
 onBuy: (itemId: string) => void;
 onClose: () => void;
 /** One-click kit (F1–F3). */
 onBuyKit?: (tier: KitTier) => void;
 /** Rebuy last loadout (R). */
 onRebuy?: () => void;
 /** Whether a previous-round loadout is available. */
 canRebuy?: boolean;
}

const TIER_HOTKEY: Record<KitTier, string> = {
 ECO: "F1",
 FORCE: "F2",
 FULL: "F3",
};

const TIER_ACCENT: Record<KitTier, string> = {
 ECO: "text-sky-300 border-sky-400/40 bg-sky-500/10",
 FORCE: "text-orange-300 border-orange-400/40 bg-orange-500/10",
 FULL: "text-amber-300 border-amber-400/40 bg-amber-500/10",
};

/**
 * Commercial buy UI — kits 1-clique (F1–F3) + rebuy R + granular catalog.
 * Hotkeys are owned solely by GameClient (avoid double F1–F3/R fire).
 */
export function BuyMenu({
 money,
 armor,
 message,
 onBuy,
 onClose,
 onBuyKit,
 onRebuy,
 canRebuy = false,
}: BuyMenuProps) {
 const [category, setCategory] = useState<FilterId>("all");

 const kits = useMemo(() => suggestKits(money), [money]);
 const kitByTier = useMemo(() => {
  const map = new Map(kits.map((k) => [k.tier, k]));
  return map;
 }, [kits]);

 const items = useMemo(() => {
  if (category === "all") return SHOP_CATALOG;
  return SHOP_CATALOG.filter((i) => i.category === category);
 }, [category]);

 return (
  <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/80">
   <Panel
    elevated
    className="relative w-[min(920px,94vw)] max-h-[90vh] overflow-y-auto p-5 shadow-2xl"
   >
    {/* Header */}
    <div className="mb-4 flex items-end justify-between border-b border-white/10 pb-3">
     <div>
      <div className="text-[11px] font-bold tracking-[0.4em] text-amber-400">
       // COMPRAR
      </div>
      <h2 className="text-3xl font-black tracking-tight text-white">
       Loja
      </h2>
      <p className="mt-1 text-xs text-[color:var(--ff-muted)]">
       Aquecimento ou fase de compra · colete atual: {armor}
      </p>
     </div>
     <div className="text-right">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6F6A5B]">
       Dinheiro
      </div>
      <PriceTag amount={money} size="lg" />
     </div>
    </div>

    {/* 1-click kits */}
    {onBuyKit && (
     <div className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
       <div className="text-[10px] font-bold tracking-[0.3em] text-[#6F6A5B]">
        KITS 1-CLIQUE
       </div>
       {onRebuy && (
        <button
         type="button"
         disabled={!canRebuy}
         onClick={() => onRebuy()}
         className={`rounded-md border px-2.5 py-1 text-[10px] font-black tracking-[0.2em] transition ${
          canRebuy
           ? "border-white/25 bg-white/[0.08] text-[#F4EFE3] hover:bg-white/15"
           : "cursor-not-allowed border-white/10 text-[#6F6A5B]"
         }`}
        >
         [R] REBUY
        </button>
       )}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
       {KIT_HOTKEY_TIERS.map((tier) => {
        const kit = kitByTier.get(tier);
        const afford = !!kit && money >= kit.totalPrice;
        return (
         <button
          key={tier}
          type="button"
          disabled={!afford}
          onClick={() => onBuyKit(tier)}
          className={`rounded-xl border px-3 py-3 text-left transition ${
           afford
            ? `${TIER_ACCENT[tier]} hover:brightness-110`
            : "cursor-not-allowed border-white/10 bg-white/[0.03] text-[#6F6A5B]"
          }`}
         >
          <div className="flex items-center justify-between gap-2">
           <span className="text-[12px] font-black tracking-[0.25em]">
            [{TIER_HOTKEY[tier]}] {kit?.label ?? tier}
           </span>
           {kit && <PriceTag amount={kit.totalPrice} size="sm" />}
          </div>
          {kit ? (
           <>
            <div className="mt-2 flex flex-wrap gap-1.5">
             {kit.itemIds.map((id) => (
              <div
               key={id}
               className="flex h-10 w-12 items-center justify-center rounded-md bg-black/30"
              >
               <ShopItemIcon
                itemId={id}
                dimmed={!afford}
                className="h-8 w-[85%]"
               />
              </div>
             ))}
            </div>
            <p className="mt-1.5 text-[11px] text-[#B9B29F]">
             {kit.blurb}
            </p>
           </>
          ) : (
           <p className="mt-2 text-[11px] text-[#6F6A5B]">
            Sem $ para este kit
           </p>
          )}
         </button>
        );
       })}
      </div>
     </div>
    )}

    <CategoryTabs
     value={category}
     onChange={setCategory}
     className="mb-3"
    />

    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
     {items.map((item: ShopCatalogItem) => {
      const afford = money >= item.price;
      return (
       <WeaponCard
        key={item.id}
        name={item.name}
        price={item.price}
        afford={afford}
        disabled={!afford}
        onClick={() => onBuy(item.id)}
        compact
        badge="COMPRAR"
       >
        <ShopItemIcon
         itemId={item.id}
         dimmed={!afford}
         className="h-16 w-[90%]"
        />
       </WeaponCard>
      );
     })}
    </div>

    {message && (
     <div className="mt-3 rounded-md border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-center text-sm font-semibold text-amber-50">
      {message}
     </div>
    )}

    <p className="mt-4 text-center text-[11px] font-bold tracking-[0.35em] text-[#6F6A5B]">
     F1–F3 KITS · R REBUY · B FECHAR
    </p>
    <Button
     variant="ghost"
     onClick={onClose}
     className="mt-2 w-full py-2.5"
    >
     Fechar
    </Button>
   </Panel>
  </div>
 );
}
