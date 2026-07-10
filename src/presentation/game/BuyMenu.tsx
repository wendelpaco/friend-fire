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

export function BuyMenu({
  money,
  armor,
  message,
  onBuy,
  onClose,
}: BuyMenuProps) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-amber-500/35 bg-[#0a0c12]/96 p-5 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.3em] text-amber-400/90">
              // COMPRAR
            </div>
            <h2 className="text-xl font-black tracking-wide">Loja</h2>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-white/40">
              dinheiro
            </div>
            <div className="text-2xl font-black tabular-nums text-emerald-400">
              ${money.toLocaleString("pt-BR")}
            </div>
          </div>
        </div>
        <p className="mb-4 text-xs text-white/45">
          Aquecimento ou fase de compra · colete: {armor}
        </p>

        {ORDER.map((cat) => {
          const items = SHOP_CATALOG.filter((i) => i.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                {LABELS[cat]}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {items.map((item) => {
                  const afford = money >= item.price;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!afford}
                      onClick={() => onBuy(item.id)}
                      className={`rounded-xl border px-2.5 py-2.5 text-left transition ${
                        afford
                          ? "border-white/15 bg-white/[0.06] hover:border-amber-400/55 hover:bg-amber-500/10"
                          : "cursor-not-allowed border-white/5 bg-black/35 opacity-45"
                      }`}
                    >
                      <ShopItemIcon itemId={item.id} dimmed={!afford} />
                      <div className="mt-1.5 text-[11px] font-bold tracking-wide">
                        {item.name}
                      </div>
                      <div
                        className={`mt-0.5 text-xs font-semibold tabular-nums ${
                          afford ? "text-emerald-400" : "text-red-400/80"
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
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-100">
            {message}
          </div>
        )}

        <p className="mb-2 text-center text-[10px] font-semibold tracking-[0.25em] text-white/35">
          B PARA FECHAR
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold tracking-wide text-white/80 transition hover:bg-white/10"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
