/**
 * Fog / limited-vision preference (localStorage).
 * Key: ff_fog_enabled — default true.
 */

import { getLocal, setLocal } from "@/infrastructure/storage/local";

export const FOG_ENABLED_KEY = "ff_fog_enabled";

/** Read fog preference; defaults to true when missing/invalid. */
export function getFogEnabled(): boolean {
  const raw = getLocal(FOG_ENABLED_KEY);
  if (raw == null) return true;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return true;
}

/** Persist fog preference. */
export function setFogEnabled(enabled: boolean): void {
  setLocal(FOG_ENABLED_KEY, enabled ? "true" : "false");
}
