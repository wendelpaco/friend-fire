/**
 * Cheap network snapshot helpers (W4).
 * Prefer patch-in-place over rebuilding player graphs each Colyseus tick.
 */

import type { Team } from "@/shared/types/team";

/** Soft-correct predicted local position toward server. */
export function softBlendAxis(
  client: number,
  server: number,
  serverWeight = 0.65,
): number {
  const w =
    Number.isFinite(serverWeight) && serverWeight >= 0 && serverWeight <= 1
      ? serverWeight
      : 0.65;
  return client * (1 - w) + server * w;
}

export function softBlendLocalPos(
  clientX: number,
  clientZ: number,
  serverX: number,
  serverZ: number,
  serverWeight = 0.65,
): { x: number; z: number } {
  return {
    x: softBlendAxis(clientX, serverX, serverWeight),
    z: softBlendAxis(clientZ, serverZ, serverWeight),
  };
}

export function normalizeTeam(raw: string): Team {
  return raw === "CT" ? "CT" : "TR";
}

/** Active weapon slot from server (1 / 2 / 4). */
export function normalizeActiveSlot(
  raw: number | undefined,
  hasPrimary: boolean,
  fallback = 2,
): number {
  let slot = typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
  if (slot !== 1 && slot !== 2 && slot !== 4) slot = fallback;
  if (slot === 1 && !hasPrimary) slot = 2;
  return slot;
}

/**
 * Fill `out` with NetworkPlayer-shaped rows without allocating a new array
 * when capacity is enough. Returns `out` (length set to n).
 */
export function refillArray<T>(out: T[], items: readonly T[]): T[] {
  const n = items.length;
  out.length = n;
  for (let i = 0; i < n; i++) {
    out[i] = items[i]!;
  }
  return out;
}

/**
 * Build id → index map into `ids` / reuse Map.
 * Clears `map` first.
 */
export function indexById(
  map: Map<string, number>,
  ids: ReadonlyArray<{ id: string }>,
): Map<string, number> {
  map.clear();
  for (let i = 0; i < ids.length; i++) {
    map.set(ids[i]!.id, i);
  }
  return map;
}
