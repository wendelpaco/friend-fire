"use client";

import { SHOP_CATALOG, type ShopCatalogItem } from "@/domains/combat";
import { ShopItemIcon } from "./shopIcons";

interface BuyMenuProps {
  money: number;
  armor: number;
  message: string | null;
  onBuy: (itemId: string) => void;
  onClose: () => void;
}

/**
 * Commercial buy UI (RUSH-B density): one filled grid, solid icons, gold chrome.
 */
export function BuyMenu({
  money,
  armor,
  message,
  onBuy,
  onClose,
}: BuyMenuProps) {
  const items = SHOP_CATALOG;

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/80">
      <div
        className="relative w-[min(920px,94vw)] max-h-[90vh] overflow-y-auto rounded-lg border-[3px] border-amber-500/60 bg-[#0e1018] p-5 shadow-2xl"
        style={{
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.5), 0 25px 80px rgba(0,0,0,0.85)",
        }}
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
            <p className="mt-1 text-xs text-white/45">
              Aquecimento ou fase de compra · colete atual: {armor}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Dinheiro
            </div>
            <div className="text-4xl font-black tabular-nums leading-none text-emerald-400">
              ${money.toLocaleString("pt-BR")}
            </div>
          </div>
        </div>

        {/* Dense item grid — no sparse category columns */}
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
          {items.map((item: ShopCatalogItem) => {
            const afford = money >= item.price;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!afford}
                onClick={() => onBuy(item.id)}
                className={`group flex flex-col overflow-hidden rounded-md border-2 text-left transition ${
                  afford
                    ? "border-white/15 bg-[#151a24] hover:border-amber-400 hover:bg-[#1c2430]"
                    : "cursor-not-allowed border-white/5 bg-[#0a0c10] opacity-45"
                }`}
              >
                <div className="relative flex h-[88px] items-center justify-center bg-gradient-to-b from-[#1e2633] to-[#0c1018]">
                  <ShopItemIcon
                    itemId={item.id}
                    dimmed={!afford}
                    className="h-16 w-[90%]"
                  />
                  {afford && (
                    <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] font-bold text-emerald-300 opacity-0 transition group-hover:opacity-100">
                      COMPRAR
                    </span>
                  )}
                </div>
                <div className="border-t border-white/5 px-2 py-2">
                  <div className="truncate text-[11px] font-black uppercase tracking-wide text-white">
                    {item.name}
                  </div>
                  <div
                    className={`mt-0.5 text-sm font-bold tabular-nums ${
                      afford ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    ${item.price}
                  </div>
                </div>
              </button>
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
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-md border border-white/15 bg-white/5 py-2.5 text-sm font-bold text-white/80 hover:bg-white/10"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
