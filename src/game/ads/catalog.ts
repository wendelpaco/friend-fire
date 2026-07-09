/**
 * Ad / sponsorship catalog.
 * Swap creatives here (or load from API later) without touching game logic.
 * Each slot in the map references an AdCreative by id.
 */

export type AdPlacement = "billboard" | "wall" | "menu_banner" | "pause_banner";

export interface AdCreative {
  id: string;
  brand: string;
  headline: string;
  subline?: string;
  /** CSS / canvas colors */
  bg: string;
  bg2?: string;
  accent: string;
  text: string;
  cta?: string;
  /** optional external URL when clicked (menu ads) */
  url?: string;
  placement: AdPlacement[];
}

/** Placeholder sponsors — replace with real partners / ad network creatives */
export const AD_CATALOG: AdCreative[] = [
  {
    id: "himetrica",
    brand: "HIMETRICA",
    headline: "Analytics that ship",
    subline: "MRR · churn · growth",
    bg: "#0f172a",
    bg2: "#1e3a5f",
    accent: "#38bdf8",
    text: "#f8fafc",
    cta: "himetrica.com",
    url: "https://himetrica.com",
    placement: ["billboard", "menu_banner", "pause_banner"],
  },
  {
    id: "energy-rush",
    brand: "RUSH ENERGY",
    headline: "JOGUE NO MÁXIMO",
    subline: "Zero açúcar · +foco",
    bg: "#1a0505",
    bg2: "#7f1d1d",
    accent: "#fbbf24",
    text: "#fff7ed",
    cta: "BEBA RUSH",
    placement: ["billboard", "wall"],
  },
  {
    id: "army-recruit",
    brand: "JOIN THE FORCE",
    headline: "AI TOOK YOUR JOB?",
    subline: "JOIN THE ARMY",
    bg: "#14532d",
    bg2: "#166534",
    accent: "#fde047",
    text: "#ecfdf5",
    cta: "ENLIST NOW",
    placement: ["billboard", "wall"],
  },
  {
    id: "amigo-bet",
    brand: "AMIGO BET",
    headline: "Aposte no clutch",
    subline: "Odds ao vivo · cashout",
    bg: "#1e1b4b",
    bg2: "#312e81",
    accent: "#a78bfa",
    text: "#f5f3ff",
    cta: "Jogue com responsabilidade",
    placement: ["billboard", "menu_banner"],
  },
  {
    id: "ff-sponsor",
    brand: "FRIEND FIRE",
    headline: "SEU BRAND AQUI",
    subline: "Outdoors in-game · alto engajamento",
    bg: "#18181b",
    bg2: "#27272a",
    accent: "#f59e0b",
    text: "#fafafa",
    cta: "anuncie@friendfire.gg",
    url: "mailto:anuncie@friendfire.gg",
    placement: ["billboard", "menu_banner", "pause_banner", "wall"],
  },
  {
    id: "tech-boot",
    brand: "CODEAR.ME",
    headline: "Ship faster",
    subline: "Cursos · mentoria · comunidade",
    bg: "#042f2e",
    bg2: "#115e59",
    accent: "#2dd4bf",
    text: "#f0fdfa",
    cta: "Comece grátis",
    placement: ["wall", "billboard"],
  },
];

export function getAd(id: string): AdCreative {
  return AD_CATALOG.find((a) => a.id === id) ?? AD_CATALOG[AD_CATALOG.length - 1]!;
}

export function adsForPlacement(placement: AdPlacement): AdCreative[] {
  return AD_CATALOG.filter((a) => a.placement.includes(placement));
}

/** Rotate menu banner every N ms */
export function pickRotatingAd(
  placement: AdPlacement,
  index: number,
): AdCreative {
  const list = adsForPlacement(placement);
  if (list.length === 0) return AD_CATALOG[0]!;
  return list[index % list.length]!;
}
