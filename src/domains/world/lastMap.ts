import { MAP_IDS, type MapId } from "./maps/registry";

/** localStorage key for the last map the player picked (lobby / create / solo). */
export const LAST_MAP_STORAGE_KEY = "ff_last_map";

/** @deprecated Prefer MAP_IDS from registry — kept for docs/callers. */
export const KNOWN_MAP_IDS = MAP_IDS;
export type KnownMapId = MapId;

export const DEFAULT_MAP_ID: MapId = "dust";

function readStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_MAP_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_MAP_STORAGE_KEY, value);
  } catch {
    /* quota / private mode */
  }
}

export function isKnownMapId(id: string): id is MapId {
  return (MAP_IDS as readonly string[]).includes(id);
}

/** Read last selected map; falls back to dust when missing/invalid. */
export function getLastMapId(fallback: string = DEFAULT_MAP_ID): string {
  const raw = readStorage();
  if (!raw) return fallback;
  const id = raw.trim().toLowerCase();
  if (isKnownMapId(id)) return id;
  return fallback;
}

/** Persist map selection (call from map pickers on change). */
export function setLastMapId(mapId: string): void {
  const id = mapId.trim().toLowerCase();
  if (!id) return;
  writeStorage(id);
}
