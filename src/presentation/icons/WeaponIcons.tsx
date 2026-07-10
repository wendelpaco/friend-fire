import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size = 24, props: IconProps) {
  const { size: _s, ...rest } = props;
  return { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...rest };
}

/** Rifle — AK-47 silhouette. */
export function Ak47(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <path d="M3 8h3l2 4v3l-1 1h-2l-2-4z" />
      <path d="M6 8h10l3 2v2l-3 2H6" />
      <rect x="16" y="9" width="4" height="3" rx="0.5" />
      <path d="M14 12v4" />
      <path d="M16 15v2" />
    </svg>
  );
}

/** Rifle — M4A1 silhouette. */
export function M4A1(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <path d="M4 8h2l2 3v3l-1.5 1.5H4l-1-4z" />
      <path d="M6 8h9l4 2.5v1l-4 2.5H6" />
      <rect x="15" y="9.5" width="5" height="2" rx="0.5" />
      <path d="M13 12v4" />
      <path d="M15 13v3l2 1" />
    </svg>
  );
}

/** Pistol — Desert Eagle silhouette. */
export function Deagle(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <path d="M5 10h2l3 1v5l-1 1H5l-1-1v-5z" />
      <path d="M7 10l2-3h3l1 1v2" />
      <rect x="10" y="11" width="7" height="3" rx="0.5" />
      <path d="M10 12v4" />
    </svg>
  );
}

/** Sniper — AWP silhouette. */
export function Awp(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <path d="M3 8h3l2 3v4l-2 2H3l-1-5z" />
      <path d="M6 8h12l4 2.5v1l-4 2.5H6" />
      <rect x="18" y="9.5" width="3" height="2" rx="0.5" />
      <circle cx="9" cy="12" r="1.5" />
      <path d="M12 15v3l1 1" />
    </svg>
  );
}

/** Pistol — USP silhouette. */
export function Usp(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <path d="M6 10h2l2 1v4l-1 1H6l-1-1v-4z" />
      <path d="M8 10l1.5-3h2.5l1 1v2" />
      <rect x="10" y="11" width="6" height="2.5" rx="0.5" />
      <path d="M10 11.5v4" />
    </svg>
  );
}

/** Knife silhouette. */
export function Knife(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <path d="M12 3L8 10l2 4v5l2-1V14l2-4z" />
      <path d="M8 10h8" />
    </svg>
  );
}

/** HE Grenade silhouette. */
export function HeGrenade(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <ellipse cx="12" cy="14" rx="5" ry="6" />
      <rect x="10" y="6" width="4" height="4" rx="1" />
      <path d="M11 6V4l2-2v4" />
      <line x1="16" y1="14" x2="19" y2="12" />
      <line x1="8" y1="14" x2="5" y2="12" />
    </svg>
  );
}

/** Kevlar + helmet silhouette. */
export function Kevlar(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <path d="M8 5h8l1 3v6l-3 5h-4l-3-5V8z" />
      <path d="M6 8h12" />
      <path d="M10 5V3h4v2" />
    </svg>
  );
}

/** Flashbang silhouette. */
export function Flashbang(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <ellipse cx="12" cy="14" rx="4" ry="5" />
      <rect x="10" y="7" width="4" height="3" rx="1" />
      <path d="M11 7V5l2-2v4" />
    </svg>
  );
}

/** Smoke grenade silhouette. */
export function SmokeGrenade(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <ellipse cx="12" cy="14" rx="5" ry="5" />
      <rect x="10" y="7" width="4" height="3" rx="1" />
      <path d="M11 7V5l2-2v4" />
      <path d="M8 13q2-2 4-2t4 2" />
    </svg>
  );
}
