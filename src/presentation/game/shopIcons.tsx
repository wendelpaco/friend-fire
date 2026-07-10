/** Simple geometric weapon/gear silhouettes for the buy menu (RUSH-B style grid). */

import type { ReactElement, ReactNode } from "react";

type IconProps = { className?: string; dimmed?: boolean };

function Svg({
  children,
  className,
  dimmed,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 40"
      className={className}
      aria-hidden
      fill="none"
      stroke={dimmed ? "currentColor" : "#e8c070"}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function PistolIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 22h22l6-2v-4l-4-2H28l-2-6h-6l-2 6H14v8z" />
      <path d="M18 22v8h6v-8" />
      <path d="M42 16h10" />
    </Svg>
  );
}

function SmgIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 20h28v6H24l-2 6h-6l-2-6H10z" />
      <path d="M38 22h14" />
      <path d="M18 26v8h5" />
    </Svg>
  );
}

function RifleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 22h32v5H28l-3 7h-6l-2-7H6z" />
      <path d="M38 23h18" />
      <path d="M12 18h14v4H12z" />
      <path d="M20 27v6" />
    </Svg>
  );
}

function SniperIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 22h36v4H30l-2 6h-5l-2-6H4z" />
      <path d="M40 23h20" />
      <circle cx="22" cy="18" r="4" />
      <path d="M18 18h8" />
    </Svg>
  );
}

function ArmorIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M32 6l14 6v10c0 10-8 16-14 18-6-2-14-8-14-18V12L32 6z" />
      <path d="M24 20h16v4H24z" />
    </Svg>
  );
}

function HeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <ellipse cx="32" cy="24" rx="10" ry="12" />
      <path d="M32 8v6" />
      <path d="M28 10h8" />
      <path d="M26 22h12" />
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
  className = "h-10 w-full",
}: {
  itemId: string;
  dimmed?: boolean;
  className?: string;
}) {
  const Comp = ICONS[itemId] ?? RifleIcon;
  return (
    <div
      className={`flex items-center justify-center rounded-lg bg-black/35 py-2 ${
        dimmed ? "text-white/35" : "text-amber-200/90"
      }`}
    >
      <Comp className={className} dimmed={dimmed} />
    </div>
  );
}
