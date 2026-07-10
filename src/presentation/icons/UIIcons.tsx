import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size = 24, props: IconProps) {
  const { size: _s, ...rest } = props;
  return { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...rest };
}

/** Settings gear. */
export function Settings(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}

/** Close / X. */
export function Close(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

/** Arrow right. */
export function ArrowRight(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13,6 19,12 13,18" />
    </svg>
  );
}

/** Check mark. */
export function Check(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <polyline points="5,12 10,17 20,7" />
    </svg>
  );
}

/** Refresh / sync. */
export function Refresh(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V5a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v6a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

/** Chevron down. */
export function ChevronDown(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/** Plus. */
export function Plus(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/** Play triangle. */
export function Play(props: IconProps) {
  return (
    <svg {...base(24, props)}>
      <polygon points="6,3 20,12 6,21" />
    </svg>
  );
}
