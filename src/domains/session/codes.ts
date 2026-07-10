/** Unambiguous A-Z0-9 without O/0/I/1. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(rng: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(rng() * ALPHABET.length)]!;
  }
  return s;
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidRoomCode(code: string): boolean {
  const c = normalizeRoomCode(code);
  return c.length === 6 && [...c].every((ch) => ALPHABET.includes(ch));
}

/**
 * Lobby deep link: `?sala=CODE` (preferred) or legacy `?code=CODE`.
 * Returns normalized valid code, or null.
 */
export function parseSalaQuery(search: string): string | null {
  const q = search.startsWith("?") ? search.slice(1) : search;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(q);
  } catch {
    return null;
  }
  const raw = params.get("sala") ?? params.get("code");
  if (!raw) return null;
  const code = normalizeRoomCode(raw);
  return isValidRoomCode(code) ? code : null;
}

/**
 * Extract a valid room code from free text or invite URL (clipboard paste).
 * Accepts bare codes, `?sala=` / `?code=` query, or `/play?...&code=`.
 */
export function extractRoomCodeFromText(text: string): string | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const bare = normalizeRoomCode(trimmed);
  if (isValidRoomCode(bare)) return bare;

  // URL or path with query
  try {
    const url = trimmed.includes("://")
      ? new URL(trimmed)
      : new URL(trimmed, "http://local.invalid");
    const fromQuery = parseSalaQuery(url.search);
    if (fromQuery) return fromQuery;
  } catch {
    /* fall through */
  }

  // Loose scan: first 6-char alphabet run in the string
  const upper = trimmed.toUpperCase();
  const match = upper.match(/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}/);
  if (match && isValidRoomCode(match[0]!)) return match[0]!;
  return null;
}
