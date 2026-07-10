import { type ReactNode } from "react";
import { Heart, Shield } from "@/presentation/icons";

type HealthBarProps = {
  hp: number;
  maxHp?: number;
  /** Show the numeric label + heart icon above the bar. */
  showLabel?: boolean;
  /** Compact mode — smaller bar, no label. */
  compact?: boolean;
  className?: string;
};

function hpColor(hp: number): string {
  if (hp <= 25) return "var(--ff-hp-critical)";
  if (hp <= 50) return "var(--ff-hp-mid)";
  return "var(--ff-hp-full)";
}

/**
 * FF Tactical HP bar — horizontal filled bar + heart icon + numeric label.
 */
export function HealthBar({
  hp,
  maxHp = 100,
  showLabel = false,
  compact = false,
  className = "",
}: HealthBarProps) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));

  return (
    <div className={className}>
      {showLabel && (
        <div className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-white/40">
          <Heart size={10} />
          vida
        </div>
      )}
      <div className="flex items-baseline gap-2">
        {!compact && (
          <span
            className={`text-3xl font-black tabular-nums ${
              hp <= 25
                ? "motion-safe:animate-ff-blink-warn text-red-400"
                : hp <= 50
                  ? "text-amber-300"
                  : "text-white"
            }`}
          >
            {hp}
          </span>
        )}
        <div
          className={`overflow-hidden rounded-full bg-white/10 ${
            compact ? "h-1 w-full" : "h-1.5 w-16"
          }`}
        >
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${pct}%`,
              backgroundColor: hpColor(hp),
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Armor display — shield icon + value. */
export function ArmorDisplay({
  armor,
  className = "",
}: {
  armor: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-white/10 bg-black/65 px-3 py-2 backdrop-blur-md ${className}`}
    >
      <div className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-white/40">
        <Shield size={10} />
        colete
      </div>
      <span className="text-2xl font-bold tabular-nums text-sky-200/90">
        {armor}
      </span>
    </div>
  );
}
