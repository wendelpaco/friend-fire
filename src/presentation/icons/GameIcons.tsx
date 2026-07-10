import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size = 24, props: IconProps) {
  const { size: _s, ...rest } = props;
  return { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...rest };
}

/** Crosshair / aim reticle. */
export function Crosshair(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Skull — death / eliminated. */
export function Skull(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <circle cx="12" cy="11" r="5" />
      <path d="M9 9.5a0.5 0.5 0 1 0 0 1a0.5 0.5 0 0 0 0-1M15 9.5a0.5 0.5 0 1 0 0 1a0.5 0.5 0 0 0 0-1" fill="currentColor" stroke="none" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <path d="M8 15l-2 5h12l-2-5" />
    </svg>
  );
}

/** C4 bomb. */
export function Bomb(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <rect x="7" y="8" width="10" height="12" rx="2" />
      <rect x="9" y="4" width="6" height="4" rx="1" />
      <circle cx="15" cy="14" r="2" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
  );
}

/** Defuse kit. */
export function Defuse(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <path d="M15 4l-6 6v4l2 2h4l2-2V10z" />
      <path d="M17 2l-4 4M7 2l4 4" strokeWidth={1.5} />
    </svg>
  );
}

/** Shield — armor / kevlar. */
export function Shield(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <path d="M12 2s-5 3-8 6v6c0 3 3 7 8 8 5-1 8-5 8-8V8c-3-3-8-6-8-6z" />
      <path d="M8 12l2 3 5-5" />
    </svg>
  );
}

/** Heart — HP / health. */
export function Heart(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <path d="M12 20S4 14 4 9c0-2.5 2-4.5 4.5-4.5 1.5 0 2.8.7 3.5 1.8.7-1 2-1.8 3.5-1.8C18 4.5 20 6.5 20 9c0 5-8 11-8 11z" />
    </svg>
  );
}

/** Ammo / bullet. */
export function Ammo(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <rect x="6" y="8" width="5" height="12" rx="1" />
      <rect x="13" y="8" width="5" height="12" rx="1" />
      <path d="M8 5l1-2h6l1 2" />
    </svg>
  );
}

/** Coin — money / economy. */
export function Coin(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <text x="12" y="13" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor" stroke="none">$</text>
    </svg>
  );
}

/** Star — MVP / favorite. */
export function Star(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3 1.2-6.8-5-4.9 6.9-1z" />
    </svg>
  );
}
