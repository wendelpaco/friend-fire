import type { ReactNode } from "react";

type WeaponSlotProps = {
  /** Fixed muscle-memory number (1 primary · 2 secondary · 3 util · 4 faca · 5 C4). */
  slot: number | string;
  name: string;
  active: boolean;
  /**
   * Empty slots must not mount. Prefer omitting the component; this is a
   * safety valve if callers pass empty names.
   */
  empty?: boolean;
  /** Objective item (C4) — amber emphasis while carried. */
  objective?: boolean;
  children?: ReactNode;
  className?: string;
};

/**
 * FF Tactical weapon slot pill — single weapon in the HUD weapon bar.
 * Empty = null (hidden). Slot number stays fixed for equipped items only.
 */
export function WeaponSlot({
  slot,
  name,
  active,
  empty = false,
  objective = false,
  children,
  className = "",
}: WeaponSlotProps) {
  if (empty || !name || !String(name).trim()) return null;

  const activeCls = active
    ? "border-amber-400/80 bg-amber-500/25 text-amber-50 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
    : objective
      ? "border-amber-400/55 bg-amber-500/15 text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.12)]"
      : "border-white/10 bg-black/55 text-white/50";

  return (
    <div
      className={`min-w-[5.5rem] rounded-md border px-2.5 py-1.5 text-center transition-all ${activeCls} ${className}`}
    >
      <div className="text-[9px] opacity-60">{slot}</div>
      <div className="text-[10px] font-bold tracking-wide">{name}</div>
      {children}
    </div>
  );
}
