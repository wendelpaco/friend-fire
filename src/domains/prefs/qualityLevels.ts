/**
 * Discrete quality knob levels shared by tier presets and QualityController.
 * Domain-owned so prefs does not depend on infrastructure/perf.
 */

import type { GraphicsQuality } from "./types";

export type ShadowType = "basic" | "pcf" | "pcfsoft";

/** Concrete knobs applied by ThreeRenderer / auto-quality. */
export type RuntimeKnobs = {
  maxPixelRatio: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  shadowType: ShadowType;
  propCastShadow: boolean;
  dustCount: number;
  dustUpdateHz: number;
  /** 0–1 combat FX density budget. */
  fxBudget: number;
  animLodFullDist: number;
  animLodMidDist: number;
  /** 0 = cheapest prop path, 2 = fullest (W1 uses for instancing/LOD). */
  propDetail: number;
};

/** Discrete level indices for each sacrifice axis (0 = cheapest). */
export type KnobLevels = {
  fxBudget: number;
  dust: number;
  animLod: number;
  pixelRatio: number;
  shadows: number;
  propDetail: number;
};

export const PIXEL_RATIO_LEVELS = [1, 1.25, 1.5, 2] as const;

export const SHADOW_LEVELS = [
  {
    shadowsEnabled: false,
    shadowMapSize: 512,
    shadowType: "basic" as const,
    propCastShadow: false,
  },
  {
    shadowsEnabled: true,
    shadowMapSize: 512,
    shadowType: "basic" as const,
    propCastShadow: false,
  },
  {
    shadowsEnabled: true,
    shadowMapSize: 1024,
    shadowType: "pcf" as const,
    propCastShadow: false,
  },
  {
    shadowsEnabled: true,
    shadowMapSize: 2048,
    shadowType: "pcfsoft" as const,
    propCastShadow: true,
  },
] as const;

export const DUST_LEVELS = [
  { dustCount: 0, dustUpdateHz: 0 },
  { dustCount: 100, dustUpdateHz: 20 },
  { dustCount: 280, dustUpdateHz: 60 },
] as const;

export const FX_LEVELS = [0.35, 0.7, 1.0] as const;

export const ANIM_LOD_LEVELS = [
  { animLodFullDist: 8, animLodMidDist: 16 },
  { animLodFullDist: 14, animLodMidDist: 24 },
  { animLodFullDist: 18, animLodMidDist: 28 },
] as const;

export const PROP_DETAIL_LEVELS = [0, 1, 2] as const;

/** Max level index per axis for each user tier ceiling. */
export const TIER_MAX_LEVELS: Record<GraphicsQuality, KnobLevels> = {
  low: {
    fxBudget: 0,
    dust: 0,
    animLod: 0,
    pixelRatio: 0,
    shadows: 0,
    propDetail: 0,
  },
  medium: {
    fxBudget: 2,
    dust: 1,
    animLod: 1,
    pixelRatio: 1,
    shadows: 2,
    propDetail: 1,
  },
  high: {
    fxBudget: 2,
    dust: 2,
    animLod: 2,
    pixelRatio: 3,
    shadows: 3,
    propDetail: 2,
  },
};

function clampLevel(level: number, len: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(len - 1, Math.floor(level)));
}

export function knobsFromLevels(levels: KnobLevels): RuntimeKnobs {
  const pr =
    PIXEL_RATIO_LEVELS[clampLevel(levels.pixelRatio, PIXEL_RATIO_LEVELS.length)]!;
  const sh = SHADOW_LEVELS[clampLevel(levels.shadows, SHADOW_LEVELS.length)]!;
  const dust = DUST_LEVELS[clampLevel(levels.dust, DUST_LEVELS.length)]!;
  const fx = FX_LEVELS[clampLevel(levels.fxBudget, FX_LEVELS.length)]!;
  const anim =
    ANIM_LOD_LEVELS[clampLevel(levels.animLod, ANIM_LOD_LEVELS.length)]!;
  const prop =
    PROP_DETAIL_LEVELS[clampLevel(levels.propDetail, PROP_DETAIL_LEVELS.length)]!;
  return {
    maxPixelRatio: pr,
    shadowsEnabled: sh.shadowsEnabled,
    shadowMapSize: sh.shadowMapSize,
    shadowType: sh.shadowType,
    propCastShadow: sh.propCastShadow,
    dustCount: dust.dustCount,
    dustUpdateHz: dust.dustUpdateHz,
    fxBudget: fx,
    animLodFullDist: anim.animLodFullDist,
    animLodMidDist: anim.animLodMidDist,
    propDetail: prop,
  };
}

/** Preset knobs for a tier (full ceiling, no auto-down). */
export function knobsForTier(tier: GraphicsQuality): RuntimeKnobs {
  return knobsFromLevels(TIER_MAX_LEVELS[tier]);
}

export function targetMsForTier(tier: GraphicsQuality): number {
  return tier === "low" ? 22.2 : 16.7;
}
