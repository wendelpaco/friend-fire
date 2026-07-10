import type { ReactNode } from "react";
import { PriceTag } from "./PriceTag";

type WeaponCardProps = {
  name: string;
  price: number;
  afford: boolean;
  /** Preview media (icon / emoji). */
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  /** Compact tile for dense buy grid. */
  compact?: boolean;
  badge?: string;
};

const shellClass = (
  afford: boolean,
  interactive: boolean,
  className: string,
) =>
  `group flex flex-col overflow-hidden rounded-lg border-2 text-left transition ${
    afford
      ? "border-white/15 bg-[color:var(--ff-panel-2)] hover:border-amber-400 hover:bg-[#1c2430]"
      : "cursor-not-allowed border-white/5 bg-[color:var(--ff-void)] opacity-45"
  } ${interactive && afford ? "cursor-pointer" : ""} ${className}`;

/** FF Tactical shop tile — used by ShopShowcase + BuyMenu. */
export function WeaponCard({
  name,
  price,
  afford,
  children,
  onClick,
  disabled,
  className = "",
  compact = false,
  badge,
}: WeaponCardProps) {
  const interactive = typeof onClick === "function";
  const body = (
    <>
      <div
        className={`relative flex items-center justify-center bg-gradient-to-b from-[#1e2633] to-[#0c1018] ${
          compact ? "h-[88px]" : "h-[100px]"
        }`}
      >
        {children}
        {badge && afford && (
          <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] font-bold text-emerald-300 opacity-0 transition group-hover:opacity-100">
            {badge}
          </span>
        )}
      </div>
      <div
        className={`border-t border-white/5 ${compact ? "px-2 py-2" : "px-2.5 py-2.5"}`}
      >
        <div
          className={`truncate font-black uppercase tracking-wide text-white ${
            compact ? "text-[11px]" : "text-xs"
          }`}
        >
          {name}
        </div>
        <PriceTag
          amount={price}
          afford={afford}
          size="sm"
          className="mt-0.5 block"
        />
      </div>
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        disabled={disabled || !afford}
        onClick={onClick}
        className={shellClass(afford, true, className)}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={shellClass(afford, false, className)}>{body}</div>
  );
}
