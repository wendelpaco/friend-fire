import type { AdImpression } from "@/domains/ads";
import { getLocalJson, setLocalJson } from "@/infrastructure/storage/local";

const IMP_KEY = "ff_ad_impressions";
const EVT_KEY = "ff_analytics_events";
const MAX = 200;

export function pushImpression(imp: AdImpression): void {
  if (typeof window === "undefined") return;
  const list = drainImpressions();
  list.push(imp);
  setLocalJson(IMP_KEY, list.slice(-MAX));
}

export function drainImpressions(): AdImpression[] {
  if (typeof window === "undefined") return [];
  return getLocalJson<AdImpression[]>(IMP_KEY, []);
}

/** Lightweight game analytics events (buy timing, etc.). */
export type AnalyticsEvent = {
  id: string;
  name: string;
  at: number;
  props?: Record<string, string | number | boolean | null>;
};

export function pushEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  const list = drainEvents();
  list.push(event);
  setLocalJson(EVT_KEY, list.slice(-MAX));
}

export function drainEvents(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  return getLocalJson<AnalyticsEvent[]>(EVT_KEY, []);
}

/**
 * Buy-menu open → close/live duration for product meta (<5s target).
 * Emits `buy_timing` with buy_open_ms / buy_close_or_live_ms / duration_ms / round.
 */
export function trackBuyTiming(opts: {
  round: number;
  buyOpenMs: number;
  buyCloseOrLiveMs: number;
}): void {
  const duration = Math.max(0, opts.buyCloseOrLiveMs - opts.buyOpenMs);
  pushEvent({
    id: `buy_${opts.round}_${opts.buyOpenMs}`,
    name: "buy_timing",
    at: opts.buyCloseOrLiveMs,
    props: {
      round: opts.round,
      buy_open_ms: opts.buyOpenMs,
      buy_close_or_live_ms: opts.buyCloseOrLiveMs,
      duration_ms: Math.round(duration),
    },
  });
}

/** Object facade matching plan interface. */
export const AnalyticsQueue = {
  push: pushImpression,
  drain: drainImpressions,
  pushEvent,
  drainEvents,
  trackBuyTiming,
};
