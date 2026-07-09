/**
 * Keep in sync with src/domains/session/codes.ts
 * Unambiguous A-Z0-9 without O/0/I/1.
 */
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
