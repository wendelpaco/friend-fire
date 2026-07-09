/**
 * Last multiplayer room memory (reconnect / rejoin).
 * Keys: ff_last_room_code, ff_last_room_map
 */

export const LAST_ROOM_CODE_KEY = "ff_last_room_code";
export const LAST_ROOM_MAP_KEY = "ff_last_room_map";

export type LastRoom = {
  code: string;
  mapId: string;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

/** Persist last successfully entered room for rejoin UX. */
export function saveLastRoom({ code, mapId }: LastRoom): void {
  if (!canUseStorage()) return;
  const c = code.trim();
  if (!c) return;
  try {
    localStorage.setItem(LAST_ROOM_CODE_KEY, c);
    localStorage.setItem(LAST_ROOM_MAP_KEY, (mapId ?? "").trim());
  } catch {
    /* quota / private mode */
  }
}

/** Read last room; null when no code is stored. */
export function getLastRoom(): LastRoom | null {
  if (!canUseStorage()) return null;
  try {
    const code = localStorage.getItem(LAST_ROOM_CODE_KEY)?.trim() ?? "";
    if (!code) return null;
    const mapId = localStorage.getItem(LAST_ROOM_MAP_KEY)?.trim() ?? "";
    return { code, mapId };
  } catch {
    return null;
  }
}

/** Clear last-room keys (e.g. rejoin failed). */
export function clearLastRoom(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(LAST_ROOM_CODE_KEY);
    localStorage.removeItem(LAST_ROOM_MAP_KEY);
  } catch {
    /* ignore */
  }
}
