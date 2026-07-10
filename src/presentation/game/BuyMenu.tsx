"use client";

import { useMemo, useState } from "react";
import {
  SHOP_CATALOG,
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
}

/**
 * Commercial buy UI — FF Tactical WeaponCard / CategoryTabs (Meta-2).
 * Behavior unchanged: onBuy → tryBuy via GameClient.
 */
export function BuyMenu({
  money,
  armor,
  message,
  onBuy,
  onClose,
}: BuyMenuProps) {
  const [category, setCategory] = useState<FilterId>("all");

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
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Dinheiro
            </div>
            <PriceTag amount={money} size="lg" />
          </div>
        </div>

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

        <p className="mt-4 text-center text-[11px] font-bold tracking-[0.35em] text-white/35">
          B PARA FECHAR
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
