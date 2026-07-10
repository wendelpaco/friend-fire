/**
 * Graphics quality tiers (localStorage).
 * Default **medium** — balanced for laptop iGPU / Retina without max fill-rate.
 * User tier is a **ceiling**; auto-quality may lower knobs at runtime.
 */

import { getLocal, setLocal } from "@/infrastructure/storage/local";
import type { GraphicsQuality } from "./types";
import {
  knobsForTier,
  type RuntimeKnobs,
} from "./qualityLevels";

export type { GraphicsQuality };
export type { RuntimeKnobs, KnobLevels, ShadowType } from "./qualityLevels";
export {
  knobsForTier,
  knobsFromLevels,
  targetMsForTier,
  TIER_MAX_LEVELS,
} from "./qualityLevels";

export const GRAPHICS_QUALITY_KEY = "ff_graphics_quality";
export const SHOW_FPS_KEY = "ff_show_fps";
export const AUTO_QUALITY_KEY = "ff_auto_quality";
export const DEFAULT_GRAPHICS_QUALITY: GraphicsQuality = "medium";
export const DEFAULT_AUTO_QUALITY = true;

/** Resolved knobs applied by ThreeRenderer (tier preset). */
export type GraphicsQualityConfig = RuntimeKnobs & {
  quality: GraphicsQuality;
  antialias: boolean;
};

const ANTIALIAS: Record<GraphicsQuality, boolean> = {
  low: false,
  medium: true,
  high: true,
};

export function parseGraphicsQuality(raw: string | null): GraphicsQuality {
  if (raw == null) return DEFAULT_GRAPHICS_QUALITY;
  const v = raw.trim().toLowerCase();
  if (v === "low" || v === "medium" || v === "high") return v;
  // legacy aliases
  if (v === "med" || v === "mid" || v === "normal") return "medium";
  if (v === "max" || v === "ultra") return "high";
  if (v === "min" || v === "potato") return "low";
  return DEFAULT_GRAPHICS_QUALITY;
}

/** Read quality tier; default medium. */
export function getGraphicsQuality(): GraphicsQuality {
  return parseGraphicsQuality(getLocal(GRAPHICS_QUALITY_KEY));
}

/** Persist quality tier. */
export function setGraphicsQuality(q: GraphicsQuality): void {
  if (q !== "low" && q !== "medium" && q !== "high") return;
  setLocal(GRAPHICS_QUALITY_KEY, q);
}

/** Full config for the active (or given) tier preset (ceiling). */
export function resolveQualityConfig(
  quality: GraphicsQuality = getGraphicsQuality(),
): GraphicsQualityConfig {
  const q = parseGraphicsQuality(quality);
  const knobs = knobsForTier(q);
  return {
    quality: q,
    antialias: ANTIALIAS[q],
    ...knobs,
  };
}

/** Map runtime knobs + optional tier label into GraphicsQualityConfig. */
export function configFromRuntimeKnobs(
  knobs: RuntimeKnobs,
  quality: GraphicsQuality = getGraphicsQuality(),
): GraphicsQualityConfig {
  const q = parseGraphicsQuality(quality);
  return {
    quality: q,
    antialias: ANTIALIAS[q],
    ...knobs,
  };
}

/** FPS overlay preference (default false). */
export function getShowFps(): boolean {
  const raw = getLocal(SHOW_FPS_KEY);
  if (raw == null) return false;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return false;
}

export function setShowFps(on: boolean): void {
  setLocal(SHOW_FPS_KEY, on ? "true" : "false");
}

/** Auto-quality preference (default true). */
export function getAutoQuality(): boolean {
  const raw = getLocal(AUTO_QUALITY_KEY);
  if (raw == null) return DEFAULT_AUTO_QUALITY;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return DEFAULT_AUTO_QUALITY;
}

export function setAutoQuality(on: boolean): void {
  setLocal(AUTO_QUALITY_KEY, on ? "true" : "false");
}

export function parseBoolPref(
  raw: string | null,
  defaultValue: boolean,
): boolean {
  if (raw == null) return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return defaultValue;
}
