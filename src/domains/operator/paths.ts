/**
 * Path B session routing helpers.
 * Hub play CTAs → `/operator?next=<encoded play URL>`
 */

/** Default destination after operator confirm when `next` is missing/invalid. */
export const DEFAULT_PLAY_NEXT = "/play?mode=local&map=dust";

/**
 * Build operator select URL that preserves the eventual play/room target.
 * @example operatorSelectHref("/play?mode=local&map=dust")
 *   → "/operator?next=%2Fplay%3Fmode%3Dlocal%26map%3Ddust"
 */
export function operatorSelectHref(nextPlayUrl: string): string {
  const next = sanitizeNextPath(nextPlayUrl) || DEFAULT_PLAY_NEXT;
  return `/operator?next=${encodeURIComponent(next)}`;
}

/**
 * Resolve `?next=` query: relative app paths only (no open redirect).
 * Allows `/play?...`, `/`, etc. Rejects protocol-relative and absolute URLs.
 */
export function sanitizeNextPath(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  let path = raw;
  try {
    // May already be decoded by Next searchParams; try decode once if encoded.
    if (path.includes("%")) {
      path = decodeURIComponent(path);
    }
  } catch {
    return null;
  }
  path = path.trim();
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  if (path.includes("://")) return null;
  return path;
}

/** Resolve next for OperatorSelect confirm; falls back to default play. */
export function resolveOperatorNext(raw: string | null | undefined): string {
  return sanitizeNextPath(raw) ?? DEFAULT_PLAY_NEXT;
}
