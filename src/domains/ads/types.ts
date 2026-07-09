export type AdPlacement =
  | "lobby_banner"
  | "map_billboard"
  | "map_poster"
  | "end_match_break"
  | "rewarded_xp"
  | "pause_banner";

export interface AdCreative {
  id: string;
  brand: string;
  headline: string;
  subline?: string;
  bg: string;
  bg2?: string;
  accent: string;
  text: string;
  cta?: string;
  url?: string;
  placements: AdPlacement[];
}

export interface AdImpression {
  id: string;
  placement: AdPlacement;
  creativeId: string;
  sessionId: string;
  at: number;
}
