/**
 * Soft rank tiers from total XP (`ff_xp`). Spec §2.7 — pure, local-only.
 */

export interface RankTier {
  id: string;
  name: string;
  minXp: number;
  /** XP needed to reach the next tier; null at max tier (Lenda). */
  nextXp: number | null;
}

/** Ascending by minXp. Thresholds: 0 / 500 / 1500 / 4000 / 10000. */
export const RANK_TIERS: readonly RankTier[] = [
  { id: "recruta", name: "Recruta", minXp: 0, nextXp: 500 },
  { id: "prata", name: "Prata", minXp: 500, nextXp: 1500 },
  { id: "ouro", name: "Ouro", minXp: 1500, nextXp: 4000 },
  { id: "as", name: "Ás", minXp: 4000, nextXp: 10000 },
  { id: "lenda", name: "Lenda", minXp: 10000, nextXp: null },
] as const;

function normalizeXp(xp: number): number {
  if (!Number.isFinite(xp) || xp < 0) return 0;
  return Math.floor(xp);
}

/** Map total XP to the highest tier whose minXp ≤ xp. */
export function xpToTier(xp: number): RankTier {
  const n = normalizeXp(xp);
  let tier = RANK_TIERS[0]!;
  for (const t of RANK_TIERS) {
    if (n >= t.minXp) tier = t;
    else break;
  }
  return { ...tier };
}

/**
 * Progress within the current tier, in [0, 1].
 * Max tier (Lenda) is always 1.
 */
export function progressInTier(xp: number): number {
  const n = normalizeXp(xp);
  const tier = xpToTier(n);
  if (tier.nextXp == null) return 1;
  const span = tier.nextXp - tier.minXp;
  if (span <= 0) return 1;
  const p = (n - tier.minXp) / span;
  return Math.max(0, Math.min(1, p));
}
