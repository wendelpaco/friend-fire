/**
 * Graphics quality tiers (localStorage).
 * Default **medium** — balanced for laptop iGPU / Retina without max fill-rate.
 */

import { getLocal, setLocal } from "@/infrastructure/storage/local";
import type { GraphicsQuality } from "./types";

export type { GraphicsQuality };

export const GRAPHICS_QUALITY_KEY = "ff_graphics_quality";
export const SHOW_FPS_KEY = "ff_show_fps";
export const DEFAULT_GRAPHICS_QUALITY: GraphicsQuality = "medium";

/** Resolved knobs applied by ThreeRenderer. */
export type GraphicsQualityConfig = {
  quality: GraphicsQuality;
  /** Cap for `renderer.setPixelRatio`. */
  maxPixelRatio: number;
  antialias: boolean;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  /** three.js shadow map type key. */
  shadowType: "basic" | "pcf" | "pcfsoft";
  /** Small props cast shadows (expensive). */
  propCastShadow: boolean;
  /** Atmospheric dust point count. */
  dustCount: number;
  /** Dust buffer update rate (Hz). */
  dustUpdateHz: number;
};

const TIERS: Record<GraphicsQuality, Omit<GraphicsQualityConfig, "quality">> = {
  low: {
    maxPixelRatio: 1,
    antialias: false,
    shadowsEnabled: false,
    shadowMapSize: 512,
    shadowType: "basic",
    propCastShadow: false,
    dustCount: 0,
    dustUpdateHz: 0,
  },
  medium: {
    maxPixelRatio: 1.25,
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    shadowType: "pcf",
    propCastShadow: false,
    dustCount: 100,
    dustUpdateHz: 20,
  },
  high: {
    maxPixelRatio: 2,
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    shadowType: "pcfsoft",
    propCastShadow: true,
    dustCount: 280,
    dustUpdateHz: 60,
  },
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

/** Full config for the active (or given) tier. */
export function resolveQualityConfig(
  quality: GraphicsQuality = getGraphicsQuality(),
): GraphicsQualityConfig {
  const q = parseGraphicsQuality(quality);
  return { quality: q, ...TIERS[q] };
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
