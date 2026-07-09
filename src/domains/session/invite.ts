import { normalizeRoomCode } from "./codes";

/**
 * Build a shareable invite URL for a private room.
 * Guests use host=0 (or omit host); host seat uses host=1 on the create path.
 */
export function buildInviteUrl(
  code: string,
  options: { host?: boolean; origin?: string } = {},
): string {
  const origin =
    options.origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const qs = new URLSearchParams({
    mode: "room",
    code: normalizeRoomCode(code),
    host: options.host ? "1" : "0",
  });
  return `${origin}/play?${qs.toString()}`;
}

/** Copy invite link to clipboard (SSR-safe no-op when unavailable). */
export async function copyInviteLink(
  code: string,
  options: { host?: boolean } = {},
): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(buildInviteUrl(code, options));
    return true;
  } catch {
    return false;
  }
}
