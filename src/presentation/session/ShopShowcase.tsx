"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
 SHOWCASE_MS,
 SHOP_CATALOG,
 showcaseWeaponIds,
 suggestKits,
} from "@/domains/combat";
import { Button, Panel, PriceTag, TimerBar, WeaponCard } from "@/presentation/ui";
import { ShopItemIcon } from "@/presentation/game/shopIcons";

export type ShopShowcaseProps = {
 money: number;
 round: number;
 /** Called on skip (Space/Esc/B) or timer end. `openBuy` true when B. */
 onDismiss: (opts: { openBuy: boolean }) => void;
 /** Override duration for tests. */
 durationMs?: number;
};

/**
 * Full-screen buy-phase loadout moment (Meta-2).
 * Auto-dismiss after SHOWCASE_MS; Space / Esc / B skip early.
 */
export function ShopShowcase({
 money,
 round,
 onDismiss,
 durationMs = SHOWCASE_MS,
}: ShopShowcaseProps) {
 const [startedAt] = useState(() => performance.now());
 const [now, setNow] = useState(() => performance.now());
 const dismissedRef = useRef(false);

 const dismiss = useCallback(
  (opts: { openBuy: boolean }) => {
   if (dismissedRef.current) return;
   dismissedRef.current = true;
   onDismiss(opts);
  },
  [onDismiss],
 );

 const kits = useMemo(() => suggestKits(money), [money]);
 const weaponIds = useMemo(() => showcaseWeaponIds(money), [money]);
 const weapons = useMemo(
  () =>
   weaponIds
    .map((id) => SHOP_CATALOG.find((c) => c.id === id))
    .filter((x): x is NonNullable<typeof x> => x != null),
  [weaponIds],
 );

 const elapsed = now - startedAt;
 const progress = Math.max(0, 1 - elapsed / durationMs);

 useEffect(() => {
  let raf = 0;
  const tick = () => {
   const t = performance.now();
   setNow(t);
   if (t - startedAt >= durationMs) {
    dismiss({ openBuy: false });
    return;
   }
   raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
 }, [startedAt, durationMs, dismiss]);

 // Keyboard skip (Space / Esc / B) is consumed in GameClient so the same
 // key edge does not open-then-close BuyMenu. UI buttons still call dismiss.

 return (
  <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-[color:var(--ff-void)]/92 backdrop-blur-md">
   <div className="flex w-full max-w-4xl flex-col gap-5 px-5 py-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
     <div>
      <div className="text-[11px] font-bold tracking-[0.4em] text-amber-400">
       {"// LOADOUT"}
      </div>
      <h2 className="text-3xl font-black tracking-tight text-[#F4EFE3] sm:text-4xl">
       LOJA · ROUND {round > 0 ? round : "—"}
      </h2>
      <p className="mt-1 text-sm text-[color:var(--ff-muted)]">
       Escolha o ritmo · kits sugeridos (não compram sozinhos)
      </p>
     </div>
     <div className="text-right">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6F6A5B]">
       Dinheiro
      </div>
      <PriceTag amount={money} size="lg" />
     </div>
    </div>

    <TimerBar progress={progress} label="Continuar automático" />

    {kits.length > 0 && (
     <div className="grid gap-2 sm:grid-cols-3">
      {kits.map((kit) => (
       <Panel
        key={kit.tier}
        elevated
        className="px-3 py-3"
       >
        <div className="flex items-center justify-between gap-2">
         <span
          className={`text-[11px] font-black tracking-[0.2em] ${
           kit.tier === "FULL"
            ? "text-amber-300"
            : kit.tier === "FORCE"
             ? "text-orange-300"
             : "text-sky-300"
          }`}
         >
          {kit.label}
         </span>
         <PriceTag amount={kit.totalPrice} size="sm" />
        </div>
        <div className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-[#F4EFE3]">
         {kit.itemIds
          .map(
           (id) =>
            SHOP_CATALOG.find((c) => c.id === id)?.name ?? id,
          )
          .join(" · ")}
        </div>
        <p className="mt-1 text-[11px] text-[color:var(--ff-muted)]">
         {kit.blurb}
        </p>
       </Panel>
      ))}
     </div>
    )}

    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
     {weapons.map((w) => (
      <WeaponCard
       key={w.id}
       name={w.name}
       price={w.price}
       afford={money >= w.price}
       compact
      >
       <ShopItemIcon
        itemId={w.id}
        dimmed={money < w.price}
        className="h-14 w-[90%]"
       />
      </WeaponCard>
     ))}
    </div>

    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
     <Button
      variant="primary"
      className="min-w-[10rem] tracking-[0.15em]"
      onClick={() => dismiss({ openBuy: true })}
     >
      [B] Comprar
     </Button>
     <Button
      variant="ghost"
      className="min-w-[10rem] tracking-[0.15em]"
      onClick={() => dismiss({ openBuy: false })}
     >
      [Espaço] Continuar
     </Button>
    </div>

    <p className="text-center text-[10px] font-bold tracking-[0.35em] text-[#6F6A5B]">
     ESC PULA · UMA VEZ POR FASE DE COMPRA
    </p>
   </div>
  </div>
 );
}
