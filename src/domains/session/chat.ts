/** Chat channel scope (session meta death social). */
export type ChatChannel = "squad" | "team" | "all";

export const CHAT_MAX_LEN = 120;
/** Min ms between outbound chat messages (anti-spam). */
export const CHAT_RATE_LIMIT_MS = 800;

/** Live combat: Enter opens TIME/team by default (not Todos). */
export const DEFAULT_LIVE_CHAT_CHANNEL: ChatChannel = "team";

/** Collapsed live dock: keep last N messages. */
export const LIVE_CHAT_COLLAPSED_COUNT = 2;
/** Collapsed live dock: fade messages after this many ms. */
export const LIVE_CHAT_FADE_MS = 6000;

export type ParsedChatOutbound = {
  channel: ChatChannel;
  text: string;
};

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
 * Parse live outbound chat draft.
 * - Default channel is TIME/team (not Todos).
 * - `/todos <msg>` forces all for this message only.
 * - `/time` / `/team` / `/squad` force channel for this message.
 * Returns null when empty / command without body.
 */
export function parseLiveChatOutbound(
  raw: unknown,
  defaultChannel: ChatChannel = DEFAULT_LIVE_CHAT_CHANNEL,
): ParsedChatOutbound | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  const slash = trimmed.match(/^\/(todos|all|time|team|squad)(?:\s+(.*))?$/i);
  if (slash) {
    const cmd = slash[1]!.toLowerCase();
    const body = (slash[2] ?? "").trim();
    if (!body) return null;
    const text = sanitizeChatText(body);
    if (!text) return null;
    let channel: ChatChannel = defaultChannel;
    if (cmd === "todos" || cmd === "all") channel = "all";
    else if (cmd === "time" || cmd === "team") channel = "team";
    else if (cmd === "squad") channel = "squad";
    return { channel, text };
  }

  const text = sanitizeChatText(trimmed);
  if (!text) return null;
  return { channel: defaultChannel, text };
}

/**
 * Messages visible in the collapsed live dock (last N, still within fade window).
 * `now` should use the same clock as ChatEntry.at (performance.now in client).
 */
export function visibleLiveChatMessages<T extends { at: number }>(
  messages: readonly T[],
  now: number,
  opts?: { count?: number; fadeMs?: number },
): T[] {
  const count = opts?.count ?? LIVE_CHAT_COLLAPSED_COUNT;
  const fadeMs = opts?.fadeMs ?? LIVE_CHAT_FADE_MS;
  return messages
    .filter((m) => now - m.at <= fadeMs)
    .slice(-Math.max(1, count));
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
