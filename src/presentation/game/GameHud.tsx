"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_LIVE_CHAT_CHANNEL,
  parseLiveChatOutbound,
  visibleLiveChatMessages,
} from "@/domains/session/chat";
import {
  bumpRoundsPlayedOnPhase,
  readRoundsPlayed,
  shouldShowControlHints,
  writeRoundsPlayed,
} from "@/domains/session/hudHints";
import { kdRatio, type MatchResult } from "@/domains/stats";
import { CONTROLS_HELP, DEBUG_OVERLAYS } from "@/game/constants";
import type { ChatChannel, HudSnapshot } from "@/game/types";
import { AdBanner } from "@/presentation/ads/AdBanner";
import { BuyMenu } from "@/presentation/game/BuyMenu";
import { EndMatchBreak } from "@/presentation/game/EndMatchBreak";
import { RoundBanner } from "@/presentation/game/RoundBanner";
import { SettingsPanel } from "@/presentation/game/SettingsPanel";
import { CopyInviteLink } from "@/presentation/lobby/CopyInviteLink";
import { DeathSocialPanel } from "@/presentation/session/DeathSocialPanel";
import { ShopShowcase } from "@/presentation/session/ShopShowcase";
import {
  AmmoDisplay,
  ArmorDisplay,
  HealthBar,
  KillFeedItem,
  ObjectiveChip,
  PhaseLabel,
  WeaponSlot,
  type TimerMode,
} from "@/presentation/ui";
import { Coin, Skull, Star } from "@/presentation/icons";
import type { Team } from "@/shared/types/team";

/** Local team result from final scores. */
function matchResultForTeam(
  team: Team,
  scoreTR: number,
  scoreCT: number,
): MatchResult {
  if (scoreTR === scoreCT) return "draw";
  const trWon = scoreTR > scoreCT;
  if (team === "TR") return trWon ? "win" : "loss";
  return trWon ? "loss" : "win";
}

function isBombClockActive(bombState: HudSnapshot["bombState"]): boolean {
  return bombState === "planted" || bombState === "defusing";
}

interface GameHudProps {
  hud: HudSnapshot;
  roomCode?: string;
  onResume: () => void;
  onDismissHelp: () => void;
  onOpenHelp: () => void;
  onMatchContinue?: () => void;
  onBuy?: (itemId: string) => void;
  onBuyKit?: (tier: import("@/domains/combat").KitTier) => void;
  onRebuy?: () => void;
  onCloseBuy?: () => void;
  onDismissShowcase?: (opts: { openBuy: boolean }) => void;
  /** Meta-3 squad/team/all chat send. */
  onSendChat?: (channel: ChatChannel, text: string) => void;
  /** Combat input trap while chat focused. */
  onChatFocusChange?: (focused: boolean) => void;
}

function fpsColorClass(fps: number): string {
  if (fps >= 55) return "text-emerald-300";
  if (fps >= 30) return "text-amber-300";
  return "text-red-400";
}

/** Compact always-on counter — under minimap, same width as radar. */
const MiniFps = memo(function MiniFps({ fps }: { fps: number }) {
  const ready = Number.isFinite(fps) && fps > 0;
  const n = ready ? Math.round(fps) : 0;
  return (
    <div
      className={`w-full rounded-md border border-white/10 bg-black/60 px-2.5 py-1 text-center font-mono text-[13px] font-bold tabular-nums tracking-wide shadow backdrop-blur-sm ${
        ready ? fpsColorClass(n) : "text-white/40"
      }`}
      title="Frames por segundo"
      aria-label={ready ? `${n} frames por segundo` : "Medindo FPS"}
    >
      {ready ? `${n} FPS` : "… FPS"}
    </div>
  );
});

/** Full diagnostics — Settings → Overlay avançado (under minimap). */
const PerfOverlay = memo(function PerfOverlay({
  perf,
}: {
  perf: NonNullable<HudSnapshot["perf"]>;
}) {
  return (
    <div className="pointer-events-auto w-full rounded-md border border-white/15 bg-black/75 px-2 py-1.5 font-mono text-[11px] tabular-nums text-emerald-300/95 shadow-lg backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-[13px] font-bold ${fpsColorClass(perf.fps)}`}>
          {perf.fps} FPS
        </span>
        <span className="text-[10px] text-amber-200/80">
          {perf.autoEnabled
            ? perf.adaptReason === "degrade"
              ? "AUTO ↓"
              : perf.adaptReason === "upgrade"
                ? "AUTO ↑"
                : "AUTO"
            : "MANUAL"}
        </span>
      </div>
      <div className="text-white/55">
        p50 {perf.p50Ms.toFixed(1)} · p95 {perf.p95Ms.toFixed(1)} ms
      </div>
      <div className="text-white/40">
        cpu {perf.cpuMsP95.toFixed(1)} · gpu {perf.renderMsP95.toFixed(1)}
      </div>
      <div className="text-white/50">
        {perf.drawCalls} draws · {perf.triangles} tris
      </div>
      <div className="truncate text-white/35">
        {perf.userTierMax} · dpr≤{perf.knobs.maxPixelRatio}
        {perf.knobs.shadowsEnabled
          ? ` · sh${perf.knobs.shadowMapSize}`
          : " · no-shadow"}
        · fx{perf.knobs.fxBudget}
      </div>
      <button
        type="button"
        className="mt-1 w-full rounded border border-white/15 bg-white/5 py-0.5 text-[9px] font-semibold tracking-wide text-white/70 transition hover:bg-white/10 hover:text-white"
        onClick={() => {
          if (typeof window === "undefined") return;
          window.dispatchEvent(new CustomEvent("ff-export-perf"));
        }}
      >
        JSON
      </button>
    </div>
  );
});

/** Amber state chip for C4 carrier — not a red banner. */
function GameHudImpl({
  hud,
  roomCode,
  onResume,
  onDismissHelp,
  onOpenHelp,
  onMatchContinue,
  onBuy,
  onBuyKit,
  onRebuy,
  onCloseBuy,
  onDismissShowcase,
  onSendChat,
  onChatFocusChange,
}: GameHudProps) {
  const [showSettings, setShowSettings] = useState(false);
  // Lazy-init from localStorage to avoid first-paint flash of control hints.
  const [roundsPlayed, setRoundsPlayed] = useState(() =>
    readRoundsPlayed(typeof window !== "undefined" ? localStorage : null),
  );
  const prevPhaseRef = useRef<string | null>(null);
  const [liveChatOpen, setLiveChatOpen] = useState(false);
  const [liveChatDraft, setLiveChatDraft] = useState("");
  const [chatNow, setChatNow] = useState(0);
  const liveChatInputRef = useRef<HTMLInputElement>(null);
  /** PhaseLabel "C4 PLANTADA" flash ≤2s after plant. */
  const [plantFlash, setPlantFlash] = useState(false);
  const prevBombStateRef = useRef(hud.bombState);

  useEffect(() => {
    if (!hud.paused) setShowSettings(false);
  }, [hud.paused]);

  useEffect(() => {
    const prev = prevBombStateRef.current;
    prevBombStateRef.current = hud.bombState;
    const nowDown = isBombClockActive(hud.bombState);
    const wasDown = isBombClockActive(prev);
    if (nowDown && !wasDown) {
      setPlantFlash(true);
      const id = window.setTimeout(() => setPlantFlash(false), 2000);
      return () => window.clearTimeout(id);
    }
    if (!nowDown) setPlantFlash(false);
  }, [hud.bombState]);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    const next = bumpRoundsPlayedOnPhase(roundsPlayed, prev, hud.phase);
    prevPhaseRef.current = hud.phase;
    if (next !== roundsPlayed) {
      setRoundsPlayed(next);
      writeRoundsPlayed(
        next,
        typeof window !== "undefined" ? localStorage : null,
      );
    }
  }, [hud.phase, roundsPlayed]);

  // Collapsed live chat: re-filter fade window ~2 Hz while messages exist.
  useEffect(() => {
    if (hud.spectating || hud.chat.length === 0) return;
    setChatNow(performance.now());
    const id = window.setInterval(() => setChatNow(performance.now()), 500);
    return () => window.clearInterval(id);
  }, [hud.chat, hud.spectating]);

  // Enter expands live chat (not while death dock / help / buy own focus).
  useEffect(() => {
    if (hud.spectating || hud.paused || hud.showHelp || hud.showBuyMenu) return;
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
      setLiveChatOpen(true);
      requestAnimationFrame(() => liveChatInputRef.current?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hud.spectating, hud.paused, hud.showHelp, hud.showBuyMenu]);

  const submitLiveChat = useCallback(() => {
    const parsed = parseLiveChatOutbound(
      liveChatDraft,
      DEFAULT_LIVE_CHAT_CHANNEL,
    );
    if (!parsed) return;
    onSendChat?.(parsed.channel, parsed.text);
    setLiveChatDraft("");
    setLiveChatOpen(false);
    onChatFocusChange?.(false);
    liveChatInputRef.current?.blur();
  }, [liveChatDraft, onSendChat, onChatFocusChange]);

  const showHints = shouldShowControlHints({
    roundsPlayed,
    scoreboardHeld: hud.showScoreboard,
    helpOpen: hud.showHelp,
  });

  const liveChatVisible = useMemo(
    () =>
      visibleLiveChatMessages(hud.chat, chatNow || performance.now()),
    [hud.chat, chatNow],
  );

  /** Badge reflects one-shot slash override while composing (default TIME). */
  const liveChatChannelBadge = useMemo(() => {
    const m = liveChatDraft
      .trim()
      .match(/^\/(todos|all|time|team|squad)(?:\s|$)/i);
    if (!m) return "TIME";
    const cmd = m[1]!.toLowerCase();
    if (cmd === "todos" || cmd === "all") return "TODOS";
    if (cmd === "squad") return "SQUAD";
    return "TIME";
  }, [liveChatDraft]);

  // Only equipped weapons (empty slots never mount).
  const equippedWeapons = useMemo(
    () => hud.weapons.filter((w) => w.name && String(w.name).trim().length > 0),
    [hud.weapons],
  );

  const bombClock = isBombClockActive(hud.bombState);
  const timerMode: TimerMode = bombClock
    ? "bomb"
    : hud.phase === "live" && hud.timeLeft > 0 && hud.timeLeft < 10
      ? "low"
      : "normal";
  const clockTimeLeft = bombClock ? hud.bombTimer : hud.timeLeft;

  const localRow = hud.scoreboard.find((r) => r.isLocal);
  const maxKills = hud.scoreboard.reduce(
    (m, r) => Math.max(m, r.kills),
    0,
  );
  const matchStats =
    localRow != null
      ? {
          kills: localRow.kills,
          deaths: localRow.deaths,
          money: localRow.money,
          mapName: hud.mapName,
          result: matchResultForTeam(
            localRow.team,
            hud.scoreTR,
            hud.scoreCT,
          ),
        }
      : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none font-sans text-white">
      {/* Damage vignette */}
      {hud.damageFlash > 0 && (
        <div
          className="pointer-events-none absolute inset-0 motion-safe:animate-ff-flash-red"
        />
      )}

      {/* Crosshair */}
      {hud.alive && !hud.paused && !hud.showHelp && (
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          {hud.hitMarker ? (
            <div className="relative h-5 w-5">
              <span className="absolute left-1/2 top-0 h-2 w-0.5 -translate-x-1/2 bg-white shadow" />
              <span className="absolute bottom-0 left-1/2 h-2 w-0.5 -translate-x-1/2 bg-white shadow" />
              <span className="absolute left-0 top-1/2 h-0.5 w-2 -translate-y-1/2 bg-white shadow" />
              <span className="absolute right-0 top-1/2 h-0.5 w-2 -translate-y-1/2 bg-white shadow" />
            </div>
          ) : (
            <div className="h-1 w-1 rounded-full bg-white/90 shadow-[0_0_4px_rgba(0,0,0,0.8)]" />
          )}
        </div>
      )}

      {/* Minimap + FPS stacked (left column) */}
      <div className="absolute left-4 top-4 z-30 flex w-32 flex-col gap-1.5">
        <div className="overflow-hidden rounded-lg border border-amber-500/35 bg-black/60 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 px-2 py-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/55">
              {hud.mapName}
            </span>
            <span className="text-[9px] text-white/35">radar</span>
          </div>
          <div className="relative h-32 w-32 bg-[#1a1510]/60">
            {/* grid */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
                backgroundSize: "25% 25%",
              }}
            />
            {hud.minimap
              .filter((p) => p.alive)
              .map((p) => {
                const halfW = (hud.mapWidth || 72) / 2;
                const halfD = (hud.mapDepth || 72) / 2;
                const px = ((p.x + halfW) / (halfW * 2)) * 100;
                const pz = ((p.z + halfD) / (halfD * 2)) * 100;
                return (
                  <span
                    key={p.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${px}%`,
                      top: `${pz}%`,
                      width: p.isLocal ? 7 : 5,
                      height: p.isLocal ? 7 : 5,
                      backgroundColor: p.isLocal
                        ? "#fff"
                        : p.team === "TR"
                          ? "#e07a3a"
                          : "#4a9ad4",
                      boxShadow: p.isLocal
                        ? "0 0 8px #fff"
                        : "0 0 3px rgba(0,0,0,0.6)",
                    }}
                  />
                );
              })}
            {/* Planted C4 site pulse on radar */}
            {bombClock && (
              <span
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-ff-bomb-pulse"
                style={{
                  left: `${
                    ((hud.bombX + (hud.mapWidth || 72) / 2) /
                      (hud.mapWidth || 72)) *
                    100
                  }%`,
                  top: `${
                    ((hud.bombZ + (hud.mapDepth || 72) / 2) /
                      (hud.mapDepth || 72)) *
                    100
                  }%`,
                  width: 10,
                  height: 10,
                  backgroundColor: "#ef4444",
                  boxShadow: "0 0 10px #ef4444",
                }}
                title="C4"
              />
            )}
          </div>
        </div>
        {/* Advanced perf: dev-only tree (DEBUG_OVERLAYS). Mini FPS stays product. */}
        {DEBUG_OVERLAYS && hud.perf ? (
          <PerfOverlay perf={hud.perf} />
        ) : (
          <MiniFps fps={hud.fps ?? 0} />
        )}
      </div>

      {/* Top score bar — timer one tier above TR/CT scores; bomb plant transforms central clock. */}
      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-1">
        <div
          className={`flex items-stretch overflow-hidden border bg-[#0a0e16]/90 shadow-2xl backdrop-blur-md ${
            bombClock
              ? `ff-bomb-timer-frame border-red-500/55 ${
                  hud.bombTimer <= 10
                    ? "motion-safe:animate-ff-bomb-pulse-fast"
                    : "motion-safe:animate-ff-bomb-pulse"
                }`
              : "rounded-lg border-white/15"
          }`}
        >
          <div className="flex min-w-[72px] items-center justify-center gap-1.5 bg-orange-700/35 px-3 py-2.5">
            <span className="text-[10px] font-bold tracking-widest text-orange-200">
              TR
            </span>
            <span className="text-2xl font-black tabular-nums text-white/90">
              {hud.scoreTR}
            </span>
          </div>
          <div
            className={`flex min-w-[160px] flex-col items-center justify-center border-x px-6 py-1.5 ${
              bombClock
                ? "border-red-500/25 bg-red-950/55"
                : "border-white/10 bg-[#0d121c]"
            }`}
          >
            <PhaseLabel
              phase={hud.phase}
              timeLeft={clockTimeLeft}
              round={hud.round}
              timerMode={timerMode}
              plantFlash={plantFlash}
              defusing={hud.bombState === "defusing"}
            />
            {hud.canBuy && !hud.showBuyMenu && !bombClock && (
              <span className="mt-0.5 text-[9px] font-bold tracking-wide text-amber-300">
                B · LOJA ABERTA
              </span>
            )}
          </div>
          <div className="flex min-w-[72px] items-center justify-center gap-1.5 bg-sky-700/35 px-3 py-2.5">
            <span className="text-2xl font-black tabular-nums text-white/90">
              {hud.scoreCT}
            </span>
            <span className="text-[10px] font-bold tracking-widest text-sky-200">
              CT
            </span>
          </div>
        </div>
        {roomCode && (
          <div className="flex items-center gap-1.5">
            <div className="rounded-md border border-amber-400/35 bg-black/70 px-3 py-1 font-mono text-[11px] font-bold tracking-[0.28em] text-amber-200/95 shadow backdrop-blur-md">
              SALA {roomCode}
            </div>
            <CopyInviteLink code={roomCode} host={false} variant="compact" />
          </div>
        )}
      </div>

      {/* Killfeed — top-right, clear of radar/FPS */}
      <div className="absolute right-4 top-4 z-30 flex w-80 flex-col items-end gap-1.5">
        {hud.killFeed.slice(0, 6).map((k) => (
          <KillFeedItem
            key={k.id}
            killer={k.killer}
            victim={k.victim}
            weapon={k.weapon}
            localKiller={k.localKiller}
          />
        ))}
      </div>

      {/* Live chat dock: collapsed (last 2, fade ~6s); Enter expands TIME input */}
      {!hud.spectating && (
        <div className="absolute bottom-36 left-4 flex w-[22rem] flex-col gap-1">
          {liveChatVisible.map((c) => (
            <div
              key={c.id}
              className="motion-safe:animate-ff-chat-fade text-[11px] leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
            >
              {c.kind === "system" ? (
                <span className="font-semibold text-amber-300">▸ {c.text}</span>
              ) : (
                <>
                  <span
                    className={
                      c.channel === "squad" || c.kind === "squad"
                        ? "font-semibold text-violet-300"
                        : c.kind === "radio" || c.channel === "team"
                          ? "font-semibold text-orange-300"
                          : "font-semibold text-white/90"
                    }
                  >
                    {c.from}
                    {c.channel === "squad"
                      ? " · squad"
                      : c.kind === "radio" || c.channel === "team"
                        ? " · time"
                        : " · todos"}
                    :
                  </span>{" "}
                  <span className="text-white/85">{c.text}</span>
                </>
              )}
            </div>
          ))}
          {liveChatOpen && (
            <form
              className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-white/15 bg-black/75 px-2 py-1.5 shadow-lg backdrop-blur-md"
              onSubmit={(e) => {
                e.preventDefault();
                submitLiveChat();
              }}
            >
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  liveChatChannelBadge === "TODOS"
                    ? "bg-sky-500/20 text-sky-200"
                    : liveChatChannelBadge === "SQUAD"
                      ? "bg-violet-500/20 text-violet-200"
                      : "bg-orange-500/20 text-orange-200"
                }`}
              >
                {liveChatChannelBadge}
              </span>
              <input
                ref={liveChatInputRef}
                type="text"
                value={liveChatDraft}
                maxLength={120}
                placeholder="Mensagem · /todos p/ todos"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/35"
                onChange={(e) => setLiveChatDraft(e.target.value)}
                onFocus={() => onChatFocusChange?.(true)}
                onBlur={() => {
                  onChatFocusChange?.(false);
                  setLiveChatOpen(false);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setLiveChatOpen(false);
                    onChatFocusChange?.(false);
                    liveChatInputRef.current?.blur();
                  }
                }}
              />
            </form>
          )}
        </div>
      )}

      {/* Bottom left vitals */}
      <div className="absolute bottom-5 left-4 flex items-end gap-3">
        <HealthBar hp={hud.hp} showLabel />
        <ArmorDisplay armor={hud.armor} />
      </div>

      {/* Weapon bar + ObjectiveChip (C4) — state = chip, event = banner ≤3s */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        {/* Carrier state: amber chip only (never red persistent banner) */}
        {hud.carryingBomb && hud.alive && !hud.paused && (
          <ObjectiveChip kind="c4_carry" />
        )}
        {/* Action prompt: compact chip with verb + key */}
        {hud.bombPrompt &&
          hud.alive &&
          !hud.paused &&
          hud.plantProgress <= 0 &&
          hud.defuseProgress <= 0 && (
            hud.bombPrompt?.includes("plant") || hud.bombPrompt?.includes("PLANT") ? (
              <ObjectiveChip kind="c4_plant" />
            ) : (
              <ObjectiveChip kind="c4_defuse" />
            )
          )}
        {hud.reloading && (
          <div className="w-40 rounded-full border border-amber-400/40 bg-black/70 p-1 backdrop-blur">
            <div
              className="h-1.5 rounded-full bg-amber-400 transition-all"
              style={{ width: `${hud.reloadProgress * 100}%` }}
            />
            <div className="mt-0.5 text-center text-[9px] font-semibold tracking-widest text-amber-200">
              RECARREGANDO
            </div>
          </div>
        )}
        <div className="flex items-end gap-1">
          {equippedWeapons.map((w) => (
            <WeaponSlot
              key={w.slot}
              slot={w.slot}
              name={w.name}
              active={w.active}
              objective={w.slot === 5 || w.name === "C4"}
            />
          ))}
        </div>
      </div>

      {/* Bottom right economy + ammo */}
      <div className="absolute bottom-5 right-4 flex flex-col items-end gap-2">
        <div className="rounded-lg border border-emerald-500/30 bg-black/65 px-3 py-1.5 backdrop-blur-md">
          <span className="flex items-center gap-1 text-lg font-black tabular-nums text-emerald-400">
            <Coin size={16} />
            ${hud.money.toLocaleString("pt-BR")}
          </span>
          {hud.phase === "buy" && hud.nextLossBonus > 0 && (
            <div
              className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/40"
              title="Bônus de derrota se perder o próximo round"
            >
              loss ${hud.nextLossBonus.toLocaleString("pt-BR")}
            </div>
          )}
        </div>
        <AmmoDisplay
          mag={hud.mag}
          reserve={hud.reserve}
          lowAmmo={hud.lowAmmo}
        />
      </div>

      {/* Control strip: first 2 rounds, or while holding TAB / help open */}
      {showHints &&
        !hud.paused &&
        !hud.showBuyMenu &&
        !hud.showShopShowcase && (
        <div className="absolute bottom-[5.5rem] left-1/2 -translate-x-1/2 text-[10px] tracking-wide text-white/30">
          B loja · C câmera ({hud.cameraMode === "free" ? "livre" : "travada"}) ·
          R recarregar · Tab placar · Esc pausar
        </div>
      )}

      {hud.buyMessage && !hud.showBuyMenu && !hud.showShopShowcase && (
        <div className="absolute left-1/2 top-28 z-20 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-black/75 px-4 py-1.5 text-sm text-amber-100 shadow-lg">
          {hud.buyMessage}
        </div>
      )}

      {/* Round win banner (§2.2) — 2.5s controlled by GameClient */}
      {hud.roundBanner && !hud.paused && <RoundBanner text={hud.roundBanner} />}

      {/* Death social + squad chat when dead in live (Meta-3) */}
      {hud.spectating && !hud.paused && (
        <DeathSocialPanel
          spectateTargetName={hud.spectateTargetName ?? ""}
          cameraMode={hud.cameraMode}
          messages={hud.chat}
          onSendChat={(channel, text) => onSendChat?.(channel, text)}
          onChatFocusChange={onChatFocusChange}
        />
      )}

      {/* Death overlay (warmup / non-live — live uses spectator) */}
      {!hud.alive && !hud.paused && !hud.spectating && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/25">
          <div className="rounded-xl border border-red-500/40 bg-black/75 px-10 py-6 text-center shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-center gap-2 text-2xl font-black tracking-[0.2em] text-red-300">
              <Skull size={24} />
              VOCÊ MORREU
            </div>
            <div className="mt-2 text-sm text-white/55">
              {hud.phase === "warmup" || hud.phase === "buy"
                ? "Respawn automático… (F no aquecimento/compra)"
                : hud.phase === "match_over"
                  ? "Partida encerrada · aguarde o resultado"
                  : "Aguarde o próximo round"}
            </div>
          </div>
        </div>
      )}

      {/* Scoreboard */}
      {hud.showScoreboard && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/15 bg-[#0c0e14]/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-5 py-3">
              <span className="text-sm font-bold tracking-widest text-white/85">
                PLACAR
              </span>
              <span className="rounded-md bg-white/5 px-2.5 py-0.5 font-mono text-xs tabular-nums text-white/50">
                <span className="text-orange-400/90">{hud.scoreTR}</span>
                <span className="mx-1.5 text-white/25">–</span>
                <span className="text-sky-400/90">{hud.scoreCT}</span>
              </span>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-white/35">
                <tr className="border-b border-white/8">
                  <th className="px-5 py-2.5 font-medium">Jogador</th>
                  <th className="px-2 py-2.5 font-medium">Time</th>
                  <th className="px-2 py-2.5 text-right font-medium">K</th>
                  <th className="px-2 py-2.5 text-right font-medium">D</th>
                  <th className="px-2 py-2.5 text-right font-medium">K/D</th>
                  <th className="px-2 py-2.5 text-right font-medium">$</th>
                  <th className="px-4 py-2.5 text-right font-medium">ms</th>
                </tr>
              </thead>
              <tbody>
                {hud.scoreboard.map((row) => {
                  const isMvp = maxKills > 0 && row.kills === maxKills;
                  const kd = kdRatio(row.kills, row.deaths);
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-white/[0.04] ${
                        isMvp
                          ? "bg-amber-400/[0.09]"
                          : row.isLocal
                            ? "bg-white/[0.04]"
                            : ""
                      } ${!row.alive ? "opacity-45" : ""}`}
                    >
                      <td className="px-5 py-2 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {isMvp && (
                            <span
                              className="inline-flex items-center gap-0.5 rounded bg-amber-400/20 px-1 py-px text-[9px] font-black tracking-wide text-amber-300"
                              title="MVP"
                            >
                              <Star size={10} />
                              MVP
                            </span>
                          )}
                          <span className={isMvp ? "text-amber-50" : undefined}>
                            {row.name}
                          </span>
                          {row.isLocal && (
                            <span className="text-[9px] font-semibold text-white/40">
                              VOCÊ
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={
                            row.team === "TR"
                              ? "text-orange-400"
                              : "text-sky-400"
                          }
                        >
                          {row.team}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {row.kills}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-white/70">
                        {row.deaths}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-white/55">
                        {kd.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-emerald-400/90">
                        {row.money}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-white/30">
                        —
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Help overlay */}
      {hud.showHelp && (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#10131a] p-6 shadow-2xl">
            <h2 className="text-lg font-black tracking-wide">Controles</h2>
            <p className="mt-1 text-sm text-white/50">
              Domine o básico e entre no clutch.
            </p>
            <ul className="mt-4 space-y-2">
              {CONTROLS_HELP.map((c) => (
                <li
                  key={c.keys}
                  className="flex items-center justify-between rounded-lg border border-white/8 bg-white/5 px-3 py-2"
                >
                  <kbd className="rounded bg-black/50 px-2 py-0.5 font-mono text-xs text-amber-300">
                    {c.keys}
                  </kbd>
                  <span className="text-sm text-white/75">{c.action}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onDismissHelp}
              className="mt-5 w-full rounded-lg bg-amber-500 py-2.5 text-sm font-bold tracking-wide text-black transition hover:bg-amber-400"
            >
              Entendi — jogar
            </button>
          </div>
        </div>
      )}

      {/* Meta-2 shop showcase — once per buy phase, above BuyMenu */}
      {hud.showShopShowcase &&
        onDismissShowcase &&
        !hud.paused &&
        !hud.matchOver && (
          <ShopShowcase
            money={hud.money}
            round={hud.round}
            onDismiss={onDismissShowcase}
          />
        )}

      {/* Buy menu */}
      {hud.showBuyMenu &&
        !hud.showShopShowcase &&
        onBuy &&
        onCloseBuy &&
        !hud.paused &&
        !hud.matchOver && (
        <BuyMenu
          money={hud.money}
          armor={hud.armor}
          message={hud.buyMessage}
          onBuy={onBuy}
          onBuyKit={onBuyKit}
          onRebuy={onRebuy}
          canRebuy={hud.canRebuy}
          onClose={onCloseBuy}
        />
      )}

      {/* Pause menu / settings */}
      {hud.paused &&
        !hud.showHelp &&
        !hud.matchOver &&
        !hud.showBuyMenu &&
        !hud.showShopShowcase && (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/75 backdrop-blur-md">
          {showSettings ? (
            <SettingsPanel onBack={() => setShowSettings(false)} />
          ) : (
            <div className="w-full max-w-sm rounded-2xl border border-white/12 bg-[#0e1118] p-6 shadow-2xl">
              <div className="mb-1 text-center text-[10px] font-semibold tracking-[0.3em] text-white/40">
                PAUSADO
              </div>
              <h2 className="mb-5 text-center text-2xl font-black">Friend Fire</h2>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onResume}
                  className="rounded-lg bg-amber-500 py-3 text-sm font-bold tracking-wide text-black transition hover:bg-amber-400"
                >
                  Continuar
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="rounded-lg border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  Configurações
                </button>
                <button
                  type="button"
                  onClick={onOpenHelp}
                  className="rounded-lg border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  Ver controles
                </button>
                <Link
                  href="/"
                  className="rounded-lg border border-white/10 bg-white/5 py-3 text-center text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  Sair para o menu
                </Link>
              </div>

              <div className="mt-5">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  Patrocinado
                </div>
                <AdBanner placement="pause_banner" compact rotateMs={6000} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* End-match ad break */}
      {(hud.matchOver || hud.phase === "match_over") && onMatchContinue && (
        <EndMatchBreak
          scoreTR={hud.scoreTR}
          scoreCT={hud.scoreCT}
          onContinue={onMatchContinue}
          stats={matchStats}
        />
      )}
    </div>
  );
}

/** Memoized — parent still re-renders on new hud ref; cheap when props stable. */
export const GameHud = memo(GameHudImpl);
