import type { ReactNode, SVGProps } from "react";

export type BadgeVariant =
  | "default"
  | "amber"
  | "emerald"
  | "red"
  | "sky"
  | "orange"
  | "purple"
  | "ghost";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
  title?: string;
  /** Optional leading icon component (rendered at 10–12px). */
  icon?: (props: SVGProps<SVGSVGElement> & { size?: number }) => ReactNode;
};

const VARIANT: Record<BadgeVariant, string> = {
  default: "border-white/15 bg-white/8 text-white/70",
  amber:
    "border-amber-400/30 bg-amber-400/15 text-amber-300",
  emerald:
    "border-emerald-400/30 bg-emerald-400/15 text-emerald-300",
  red: "border-red-400/30 bg-red-400/15 text-red-300",
  sky: "border-sky-400/30 bg-sky-400/15 text-sky-300",
  orange:
    "border-orange-400/30 bg-orange-400/15 text-orange-300",
  purple:
    "border-purple-400/30 bg-purple-400/15 text-purple-300",
  ghost: "border-white/5 bg-transparent text-white/45",
};

const SIZE: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-1.5 py-0.5 text-[9px]",
  md: "px-2 py-1 text-[10px]",
};

/**
 * FF Tactical badge — MVP, rank, status, weapon tag, team label.
 * Replaces scattered inline <span> micro-components.
 */
export function Badge({
  children,
  variant = "default",
  size = "sm",
  className = "",
  title,
  icon: Icon,
}: BadgeProps) {
  const iconSize = size === "sm" ? 10 : 12;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded border font-bold uppercase tracking-wide ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    >
      {Icon && <Icon size={iconSize} />}
      {children}
    </span>
  );
}
