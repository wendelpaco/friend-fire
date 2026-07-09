import type { AdImpression } from "@/domains/ads";
import { getLocalJson, setLocalJson } from "@/infrastructure/storage/local";

const KEY = "ff_ad_impressions";
const MAX = 200;

export function pushImpression(imp: AdImpression): void {
  if (typeof window === "undefined") return;
  const list = drainImpressions();
  list.push(imp);
  setLocalJson(KEY, list.slice(-MAX));
}

export function drainImpressions(): AdImpression[] {
  if (typeof window === "undefined") return [];
  return getLocalJson<AdImpression[]>(KEY, []);
}

/** Object facade matching plan interface. */
export const AnalyticsQueue = {
  push: pushImpression,
  drain: drainImpressions,
};
