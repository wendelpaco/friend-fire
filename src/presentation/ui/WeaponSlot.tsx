import type { ReactNode } from "react";

type WeaponSlotProps = {
  slot: number | string;
  name: string;
  active: boolean;
  children?: ReactNode;
  className?: string;
};

/**
 * FF Tactical weapon slot pill — single weapon in the HUD weapon bar.
 * Extracted from GameHud inline weapon display.
 */
export function WeaponSlot({
  slot,
  name,
  active,
  children,
  className = "",
}: WeaponSlotProps) {
  return (
    <div
      className={`min-w-[5.5rem] rounded-md border px-2.5 py-1.5 text-center transition-all ${
        active
          ? "border-amber-400/80 bg-amber-500/25 text-amber-50 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
          : "border-white/10 bg-black/55 text-white/50"
      } ${className}`}
    >
      <div className="text-[9px] opacity-60">{slot}</div>
      <div className="text-[10px] font-bold tracking-wide">{name}</div>
      {children}
    </div>
  );
}
