"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_LIVE_CHAT_CHANNEL,
  parseLiveChatOutbound,
} from "@/domains/session/chat";
import type { ChatChannel, ChatEntry } from "@/game/types";
import { Panel } from "@/presentation/ui/Panel";

const CHANNELS: { id: ChatChannel; label: string }[] = [
  { id: "squad", label: "Squad" },
  { id: "team", label: "Time" },
  { id: "all", label: "Todos" },
];

type SquadChatProps = {
  messages: ChatEntry[];
  /** Default channel when opening (death social = squad). */
  defaultChannel?: ChatChannel;
  onSend: (channel: ChatChannel, text: string) => void;
  /** Notify parent when input focus changes (combat input trap). */
  onFocusChange?: (focused: boolean) => void;
  className?: string;
  /** Compact for death dock. */
  compact?: boolean;
};

function channelLabel(channel: ChatChannel): string {
  if (channel === "squad") return "squad";
  if (channel === "team") return "time";
  return "all";
}

function messageTone(entry: ChatEntry): string {
  if (entry.kind === "system") return "text-amber-300";
  if (entry.channel === "squad") return "text-violet-300";
  if (entry.channel === "team" || entry.kind === "radio") return "text-orange-300";
  return "text-white/90";
}

/**
 * Squad / team / all chat panel (Meta-3).
 * Default tab on death social: squad. Enter focuses input.
 */
export function SquadChat({
  messages,
  defaultChannel = "squad",
  onSend,
  onFocusChange,
  className = "",
  compact = false,
}: SquadChatProps) {
  const [channel, setChannel] = useState<ChatChannel>(
    defaultChannel ?? DEFAULT_LIVE_CHAT_CHANNEL,
  );
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Enter opens chat focus when not typing elsewhere (death social only).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Enter" && e.key !== "Enter") return;
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Critical: clear combat suppress when panel unmounts (respawn / round end)
      onFocusChange?.(false);
    };
  }, [onFocusChange]);

  const submit = useCallback(() => {
    const parsed = parseLiveChatOutbound(draft, channel);
    if (!parsed) return;
    // Channel tabs are sticky; slash commands (/todos etc.) are one-shot only
    // and never change the selected tab (parse uses tab as defaultChannel).
    onSend(parsed.channel, parsed.text);
    setDraft("");
    inputRef.current?.focus();
  }, [channel, draft, onSend]);

  const filtered = messages.filter((m) => {
    if (m.kind === "system") return true;
    // Show messages for active tab + system
    return m.channel === channel;
  });

  return (
    <Panel
      elevated
      className={`pointer-events-auto flex flex-col overflow-hidden ${
        compact ? "w-[min(22rem,92vw)]" : "w-[min(24rem,94vw)]"
      } ${className}`}
    >
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1.5">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setChannel(c.id)}
            className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
              channel === c.id
                ? "bg-amber-500/25 text-amber-100"
                : "text-white/45 hover:bg-white/5 hover:text-white/75"
            }`}
          >
            {c.label}
          </button>
        ))}
        <span className="ml-auto text-[9px] uppercase tracking-wide text-white/30">
          Enter
        </span>
      </div>

      <div
        ref={listRef}
        className={`flex flex-col gap-1 overflow-y-auto px-2.5 py-2 ${
          compact ? "max-h-36 min-h-[5.5rem]" : "max-h-48 min-h-[7rem]"
        }`}
      >
        {filtered.length === 0 ? (
          <div className="text-[11px] text-white/35">
            Nenhuma mensagem · canal {channelLabel(channel)}
          </div>
        ) : (
          filtered.slice(-24).map((m) => (
            <div
              key={m.id}
              className="text-[11px] leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
            >
              {m.kind === "system" ? (
                <span className="font-semibold text-amber-300">▸ {m.text}</span>
              ) : (
                <>
                  <span className={`font-semibold ${messageTone(m)}`}>
                    {m.from}
                    <span className="ml-1 text-[9px] font-medium uppercase tracking-wide text-white/30">
                      {channelLabel(m.channel)}
                    </span>
                    :
                  </span>{" "}
                  <span className="text-white/85">{m.text}</span>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <form
        className="flex gap-1.5 border-t border-white/10 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          maxLength={120}
          placeholder={
            channel === "all"
              ? "Chat todos…"
              : channel === "team"
                ? "Chat time · /todos"
                : `Chat ${channelLabel(channel)}…`
          }
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-[12px] text-white outline-none placeholder:text-white/30 focus:border-amber-400/40"
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onKeyDown={(e) => {
            // Stop game keys while typing
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              inputRef.current?.blur();
            }
          }}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="shrink-0 rounded-lg border border-amber-400/40 bg-amber-500/20 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </Panel>
  );
}
