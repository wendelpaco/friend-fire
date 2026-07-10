/**
 * Filled weapon icons for buy menu — solid shapes read like RUSH-B shop tiles
 * (not thin outline strokes).
 */

import type { ReactElement, ReactNode } from "react";

type IconProps = { className?: string; dimmed?: boolean };

const GOLD = "#e8b84a";
const GOLD_DIM = "#6a5a40";
const METAL = "#c8c0b0";
const METAL_DIM = "#5a5548";
const DARK = "#1a1814";

function Svg({
  children,
  className,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 80 56"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

function fill(dimmed?: boolean, light = false) {
  if (dimmed) return light ? METAL_DIM : GOLD_DIM;
  return light ? METAL : GOLD;
}

/** Compact side-view pistol with body + grip + barrel. */
function PistolIcon({ className, dimmed }: IconProps) {
  const f = fill(dimmed);
  const m = fill(dimmed, true);
  return (
    <Svg className={className}>
      {/* shadow base */}
      <ellipse cx="40" cy="48" rx="22" ry="4" fill={DARK} opacity={0.45} />
      {/* slide / body */}
      <rect x="18" y="18" width="36" height="12" rx="2" fill={m} />
      <rect x="20" y="16" width="28" height="6" rx="1" fill={f} />
      {/* barrel */}
      <rect x="52" y="20" width="14" height="6" rx="1" fill={m} />
      {/* grip */}
      <path d="M28 30h12l2 14H30L28 30z" fill={f} />
      {/* trigger guard */}
      <path
        d="M34 30v6h8v-2"
        fill="none"
        stroke={m}
        strokeWidth="2"
      />
    </Svg>
  );
}

function SmgIcon({ className, dimmed }: IconProps) {
  const f = fill(dimmed);
  const m = fill(dimmed, true);
  return (
    <Svg className={className}>
      <ellipse cx="40" cy="48" rx="24" ry="4" fill={DARK} opacity={0.45} />
      <rect x="14" y="20" width="40" height="11" rx="2" fill={m} />
      <rect x="52" y="22" width="16" height="5" rx="1" fill={m} />
      <rect x="22" y="31" width="10" height="12" rx="1" fill={f} />
      <rect x="30" y="16" width="18" height="5" rx="1" fill={f} />
      <rect x="36" y="31" width="6" height="10" rx="1" fill={DARK} />
    </Svg>
  );
}

function RifleIcon({ className, dimmed }: IconProps) {
  const f = fill(dimmed);
  const m = fill(dimmed, true);
  return (
    <Svg className={className}>
      <ellipse cx="40" cy="48" rx="28" ry="4" fill={DARK} opacity={0.45} />
      {/* stock */}
      <path d="M8 22h14v12H10L8 22z" fill={f} />
      {/* receiver */}
      <rect x="20" y="20" width="32" height="12" rx="2" fill={m} />
      {/* handguard */}
      <rect x="38" y="18" width="18" height="10" rx="1" fill={f} />
      {/* barrel */}
      <rect x="54" y="21" width="20" height="5" rx="1" fill={m} />
      {/* mag */}
      <rect x="32" y="32" width="8" height="12" rx="1" fill={DARK} />
      {/* optic */}
      <rect x="28" y="14" width="12" height="6" rx="1" fill={f} />
    </Svg>
  );
}

function SniperIcon({ className, dimmed }: IconProps) {
  const f = fill(dimmed);
  const m = fill(dimmed, true);
  return (
    <Svg className={className}>
      <ellipse cx="40" cy="48" rx="30" ry="4" fill={DARK} opacity={0.45} />
      <path d="M6 24h16v10H8L6 24z" fill={f} />
      <rect x="18" y="22" width="36" height="10" rx="2" fill={m} />
      <rect x="52" y="24" width="22" height="4" rx="1" fill={m} />
      {/* scope */}
      <rect x="30" y="12" width="18" height="10" rx="3" fill={f} />
      <circle cx="39" cy="17" r="3" fill={DARK} />
      <rect x="34" y="32" width="7" height="10" rx="1" fill={DARK} />
    </Svg>
  );
}

function ArmorIcon({ className, dimmed }: IconProps) {
  const f = fill(dimmed);
  const m = fill(dimmed, true);
  return (
    <Svg className={className}>
      <ellipse cx="40" cy="48" rx="18" ry="4" fill={DARK} opacity={0.45} />
      <path
        d="M40 8l18 8v12c0 12-10 20-18 22-8-2-18-10-18-22V16L40 8z"
        fill={f}
      />
      <path
        d="M40 14l12 5v8c0 8-6 13-12 15-6-2-12-7-12-15v-8l12-5z"
        fill={m}
        opacity={0.85}
      />
      <rect x="32" y="26" width="16" height="6" rx="1" fill={DARK} />
    </Svg>
  );
}

function HeIcon({ className, dimmed }: IconProps) {
  const f = fill(dimmed);
  const m = fill(dimmed, true);
  return (
    <Svg className={className}>
      <ellipse cx="40" cy="48" rx="14" ry="4" fill={DARK} opacity={0.45} />
      <ellipse cx="40" cy="30" rx="14" ry="16" fill={f} />
      <ellipse cx="40" cy="26" rx="10" ry="10" fill={m} opacity={0.5} />
      <rect x="36" y="10" width="8" height="8" rx="1" fill={m} />
      <rect x="34" y="8" width="12" height="4" rx="1" fill={f} />
    </Svg>
  );
}

const ICONS: Record<string, (p: IconProps) => ReactElement> = {
  glock: PistolIcon,
  usp: PistolIcon,
  deagle: PistolIcon,
  mp5: SmgIcon,
  galil: RifleIcon,
  ak47: RifleIcon,
  awp: SniperIcon,
  armor: ArmorIcon,
  he: HeIcon,
};

/** Shop tile icon by catalog item id. */
export function ShopItemIcon({
  itemId,
  dimmed,
  className = "h-14 w-full",
}: {
  itemId: string;
  dimmed?: boolean;
  className?: string;
}) {
  const Comp = ICONS[itemId] ?? RifleIcon;
  return (
    <div
      className={`flex items-center justify-center rounded-md bg-gradient-to-b from-white/[0.07] to-black/40 py-3 ${
        dimmed ? "opacity-50" : ""
      }`}
    >
      <Comp className={className} dimmed={dimmed} />
    </div>
  );
}
