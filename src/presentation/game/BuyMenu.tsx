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

const ORDER: ShopCatalogItem["category"][] = [
  "pistol",
  "smg",
  "rifle",
  "sniper",
  "gear",
];

const LABELS: Record<ShopCatalogItem["category"], string> = {
  pistol: "Pistolas",
  smg: "SMG",
  rifle: "Rifles",
  sniper: "Sniper",
  gear: "Equipamento",
};

/**
 * RUSH-B inspired buy grid: dense tiles, solid weapon icons, gold frame.
 */
export function BuyMenu({
  money,
  armor,
  message,
  onBuy,
  onClose,
}: BuyMenuProps) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border-2 border-amber-500/50 bg-[#0c0e14]/98 p-4 shadow-[0_0_40px_rgba(0,0,0,0.8)] sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-4 border-b border-white/10 pb-3">
          <div>
            <div className="text-[10px] font-bold tracking-[0.35em] text-amber-400">
              // COMPRAR
            </div>
            <h2 className="text-2xl font-black tracking-wide text-white">
              Loja
            </h2>
            <p className="mt-0.5 text-xs text-white/40">
              Aquecimento ou compra · colete: {armor}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Dinheiro
            </div>
            <div className="text-3xl font-black tabular-nums text-emerald-400">
              ${money.toLocaleString("pt-BR")}
            </div>
          </div>
        </div>

        {ORDER.map((cat) => {
          const items = SHOP_CATALOG.filter((i) => i.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-3">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
                {LABELS[cat]}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {items.map((item) => {
                  const afford = money >= item.price;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!afford}
                      onClick={() => onBuy(item.id)}
                      className={`flex flex-col rounded-lg border-2 p-2 text-left transition ${
                        afford
                          ? "border-white/12 bg-[#141820] hover:border-amber-400/70 hover:bg-amber-500/10"
                          : "cursor-not-allowed border-white/5 bg-black/40 opacity-55"
                      }`}
                    >
                      <ShopItemIcon itemId={item.id} dimmed={!afford} />
                      <div className="mt-1.5 truncate text-[11px] font-black uppercase tracking-wide text-white/90">
                        {item.name}
                      </div>
                      <div
                        className={`mt-0.5 text-sm font-bold tabular-nums ${
                          afford ? "text-emerald-400" : "text-red-400/90"
                        }`}
                      >
                        ${item.price}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {message && (
          <div className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-center text-sm font-semibold text-amber-100">
            {message}
          </div>
        )}

        <p className="mt-2 text-center text-[11px] font-bold tracking-[0.3em] text-white/40">
          B PARA FECHAR
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 py-2.5 text-sm font-bold tracking-wide text-white/85 transition hover:bg-white/10"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
