import { normalizeRoomCode } from "./codes";

/**
 * Build a shareable invite URL for a private room.
 * Guests use host=0 (or omit host); host seat uses host=1 on the create path.
 */
export function buildInviteUrl(
  code: string,
  options: {
    host?: boolean;
    origin?: string;
    mapId?: string;
    /** Squad party id (default = room code so invitees share host squad). */
    party?: string;
  } = {},
): string {
  const origin =
    options.origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const normalized = normalizeRoomCode(code);
  const qs = new URLSearchParams({
    mode: "room",
    code: normalized,
    host: options.host ? "1" : "0",
  });
  // Guests load the same map at entry (no mid-session map reload).
  if (options.mapId) qs.set("map", options.mapId);
  // Default party = room code so invite link joins host squad (Meta-3).
  const party =
    typeof options.party === "string" && options.party.trim()
      ? options.party.trim().slice(0, 24)
      : normalized;
  if (party) qs.set("party", party);
  return `${origin}/play?${qs.toString()}`;
}

/** Copy invite link to clipboard (SSR-safe no-op when unavailable). */
export async function copyInviteLink(
  code: string,
  options: { host?: boolean; mapId?: string; party?: string } = {},
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
