/** Chat channel scope (session meta death social). */
export type ChatChannel = "squad" | "team" | "all";

export const CHAT_MAX_LEN = 120;
/** Min ms between outbound chat messages (anti-spam). */
export const CHAT_RATE_LIMIT_MS = 800;

export type ChatPartyMember = {
  partyId: string;
  team: string;
};

/**
 * Whether a recipient should receive a message on the given channel.
 * Squad requires non-empty matching partyId on both sides.
 */
export function canReceiveChat(
  channel: ChatChannel,
  sender: ChatPartyMember,
  recipient: ChatPartyMember,
): boolean {
  if (channel === "all") return true;
  if (channel === "team") return sender.team === recipient.team;
  if (channel === "squad") {
    return (
      sender.partyId.length > 0 &&
      recipient.partyId.length > 0 &&
      sender.partyId === recipient.partyId
    );
  }
  return false;
}

/** Trim + hard cap text (max 120). Empty after trim → "". */
export function sanitizeChatText(
  text: unknown,
  maxLen: number = CHAT_MAX_LEN,
): string {
  if (typeof text !== "string") return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.slice(0, Math.max(1, maxLen));
}

export function isChatChannel(value: unknown): value is ChatChannel {
  return value === "squad" || value === "team" || value === "all";
}

/**
 * Resolve party id at join (v1).
 * - Explicit `party` option → shared squad
 * - First human in room (host) → room code
 * - Else solo squad = session id
 */
export function resolvePartyId(opts: {
  partyOption?: string | null;
  roomCode: string;
  sessionId: string;
  humanCountBeforeJoin: number;
}): string {
  const raw =
    typeof opts.partyOption === "string" ? opts.partyOption.trim() : "";
  if (raw.length > 0) return raw.slice(0, 24);
  if (opts.humanCountBeforeJoin <= 0 && opts.roomCode) {
    return opts.roomCode.slice(0, 24);
  }
  return opts.sessionId.slice(0, 24);
}
