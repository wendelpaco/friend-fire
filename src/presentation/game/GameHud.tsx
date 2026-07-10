"use client";

import Link from "next/link";
import { memo, useEffect, useState } from "react";
import { CONTROLS_HELP } from "@/game/constants";
import type { ChatChannel, HudSnapshot } from "@/game/types";
import { AdBanner } from "@/presentation/ads/AdBanner";
import { BuyMenu } from "@/presentation/game/BuyMenu";
import { kdRatio, type MatchResult } from "@/domains/stats";
import { EndMatchBreak } from "@/presentation/game/EndMatchBreak";
import { RoundBanner } from "@/presentation/game/RoundBanner";
import { SettingsPanel } from "@/presentation/game/SettingsPanel";
import { CopyInviteLink } from "@/presentation/lobby/CopyInviteLink";
import { DeathSocialPanel } from "@/presentation/session/DeathSocialPanel";
import { ShopShowcase } from "@/presentation/session/ShopShowcase";
import type { Team } from "@/shared/types/team";

function formatTime(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function formatBombTimer(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function phaseLabel(hud: HudSnapshot) {
  if (hud.phase === "warmup") return `AQUECIMENTO ${Math.ceil(hud.timeLeft)}`;
  if (hud.phase === "buy") return `COMPRA ${Math.ceil(hud.timeLeft)}`;
  if (hud.phase === "ended") return "FIM DO ROUND";
  if (hud.phase === "match_over") return "FIM DA PARTIDA";
  return formatTime(hud.timeLeft);
}

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

interface GameHudProps {
  hud: HudSnapshot;
  roomCode?: string;
  onResume: () => void;
  onDismissHelp: () => void;
  onOpenHelp: () => void;
  onMatchContinue?: () => void;
  onBuy?: (itemId: string) => void;
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

function GameHudImpl({
  hud,
  roomCode,
  onResume,
  onDismissHelp,
  onOpenHelp,
  onMatchContinue,
  onBuy,
  onCloseBuy,
  onDismissShowcase,
  onSendChat,
  onChatFocusChange,
}: GameHudProps) {
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => {
    if (!hud.paused) setShowSettings(false);
  }, [hud.paused]);
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
          className="absolute inset-0 bg-red-600 transition-opacity"
          style={{ opacity: hud.damageFlash * 0.28 }}
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
          </div>
        </div>
        {hud.perf ? (
          <PerfOverlay perf={hud.perf} />
        ) : (
          <MiniFps fps={hud.fps ?? 0} />
        )}
      </div>

      {/* Top score bar */}
      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-1">
        <div className="flex items-stretch overflow-hidden rounded-lg border border-white/15 bg-[#0a0e16]/90 shadow-2xl backdrop-blur-md">
          <div className="flex min-w-[78px] items-center justify-center gap-2 bg-orange-700/35 px-4 py-2.5">
            <span className="text-[10px] font-bold tracking-widest text-orange-200">
              TR
            </span>
            <span className="text-3xl font-black tabular-nums text-white">
              {hud.scoreTR}
            </span>
          </div>
          <div className="flex min-w-[150px] flex-col items-center justify-center border-x border-white/10 bg-[#0d121c] px-7 py-2">
            <span className="text-2xl font-black tabular-nums tracking-wide text-white">
              {phaseLabel(hud)}
            </span>
            {(hud.phase === "live" ||
              hud.phase === "buy" ||
              hud.phase === "warmup") && (
              <span className="text-[9px] font-semibold tracking-[0.28em] text-white/40">
                {hud.phase === "buy"
                  ? "COMPRA"
                  : hud.phase === "warmup"
                    ? "WARMUP"
                    : "ROUND"}{" "}
                {hud.round > 0 ? hud.round : "—"}
              </span>
            )}
            {hud.canBuy && !hud.showBuyMenu && (
              <span className="mt-0.5 text-[9px] font-bold tracking-wide text-amber-300">
                B · LOJA ABERTA
              </span>
            )}
          </div>
          <div className="flex min-w-[78px] items-center justify-center gap-2 bg-sky-700/35 px-4 py-2.5">
            <span className="text-3xl font-black tabular-nums text-white">
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

        {/* Bomb timer when planted / defusing */}
        {(hud.bombState === "planted" || hud.bombState === "defusing") && (
          <div
            className={`mt-1 flex items-center gap-2 rounded-lg border px-3 py-1.5 shadow-xl backdrop-blur-md ${
              hud.bombTimer <= 10
                ? "border-red-500/55 bg-red-950/70"
                : "border-orange-400/45 bg-black/70"
            }`}
          >
            <span className="text-[9px] font-bold tracking-[0.2em] text-orange-300/90">
              C4
            </span>
            <span
              className={`font-mono text-lg font-black tabular-nums ${
                hud.bombTimer <= 10 ? "text-red-300" : "text-orange-100"
              }`}
            >
              {formatBombTimer(hud.bombTimer)}
            </span>
            {hud.bombState === "defusing" && (
              <span className="text-[9px] font-semibold tracking-wider text-sky-300">
                DESARMANDO
              </span>
            )}
          </div>
        )}
      </div>

      {/* Killfeed — top-right, clear of radar/FPS */}
      <div className="absolute right-4 top-4 z-30 flex w-80 flex-col items-end gap-1.5">
        {hud.killFeed.slice(0, 6).map((k) => (
          <div
            key={k.id}
            className="animate-kill-feed-in flex items-center gap-2 rounded-md border border-white/12 bg-black/70 px-2.5 py-1.5 text-[11px] shadow-lg shadow-black/40 backdrop-blur-md"
          >
            <span className="max-w-[7rem] truncate font-semibold text-orange-300">
              {k.killer}
            </span>
            <span
              className="shrink-0 rounded border border-amber-400/25 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-amber-200/80"
              title={k.weapon}
            >
              {k.weapon}
            </span>
            <span className="max-w-[7rem] truncate font-semibold text-sky-300">
              {k.victim}
            </span>
          </div>
        ))}
      </div>

      {/* Chat feed (hidden when death social owns the dock) */}
      {!hud.spectating && (
        <div className="absolute bottom-36 left-4 flex w-[22rem] flex-col gap-0.5">
          {hud.chat.slice(-5).map((c) => (
            <div
              key={c.id}
              className="text-[11px] leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
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
                        ? " · rádio"
                        : ""}
                    :
                  </span>{" "}
                  <span className="text-white/85">{c.text}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom left vitals */}
      <div className="absolute bottom-5 left-4 flex items-end gap-3">
        <div className="rounded-lg border border-white/10 bg-black/65 px-3 py-2 backdrop-blur-md">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/40">
            vida
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-black tabular-nums ${
                hud.hp <= 25
                  ? "text-red-400"
                  : hud.hp <= 50
                    ? "text-amber-300"
                    : "text-white"
              }`}
            >
              {hud.hp}
            </span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${
                  hud.hp <= 25 ? "bg-red-500" : "bg-emerald-400"
                }`}
                style={{ width: `${hud.hp}%` }}
              />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/65 px-3 py-2 backdrop-blur-md">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/40">
            colete
          </div>
          <span className="text-2xl font-bold tabular-nums text-sky-200/90">
            {hud.armor}
          </span>
        </div>
      </div>

      {/* Weapon bar center + plant/defuse progress + bomb prompt */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        {hud.bombPrompt && hud.alive && !hud.paused && (
          <div className="rounded-md border border-white/20 bg-black/75 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-100 shadow-lg backdrop-blur-md">
            {hud.bombPrompt}
          </div>
        )}
        {(hud.plantProgress > 0 || hud.bombState === "planting") && (
          <div className="w-48 rounded-full border border-orange-400/50 bg-black/75 p-1 backdrop-blur">
            <div
              className="h-1.5 rounded-full bg-orange-400 transition-all"
              style={{
                width: `${Math.max(0, Math.min(1, hud.plantProgress)) * 100}%`,
              }}
            />
            <div className="mt-0.5 text-center text-[9px] font-semibold tracking-widest text-orange-200">
              PLANTANDO
            </div>
          </div>
        )}
        {(hud.defuseProgress > 0 || hud.bombState === "defusing") && (
          <div className="w-48 rounded-full border border-sky-400/50 bg-black/75 p-1 backdrop-blur">
            <div
              className="h-1.5 rounded-full bg-sky-400 transition-all"
              style={{
                width: `${Math.max(0, Math.min(1, hud.defuseProgress)) * 100}%`,
              }}
            />
            <div className="mt-0.5 text-center text-[9px] font-semibold tracking-widest text-sky-200">
              DESARMANDO
            </div>
          </div>
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
          {hud.weapons.map((w) => (
            <div
              key={w.slot}
              className={`min-w-[5.5rem] rounded-md border px-2.5 py-1.5 text-center transition-all ${
                w.active
                  ? "border-amber-400/80 bg-amber-500/25 text-amber-50 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                  : "border-white/10 bg-black/55 text-white/50"
              }`}
            >
              <div className="text-[9px] opacity-60">{w.slot}</div>
              <div className="text-[10px] font-bold tracking-wide">{w.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom right economy + ammo */}
      <div className="absolute bottom-5 right-4 flex flex-col items-end gap-2">
        <div className="rounded-lg border border-emerald-500/30 bg-black/65 px-3 py-1.5 backdrop-blur-md">
          <span className="text-lg font-black tabular-nums text-emerald-400">
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
        <div
          className={`rounded-lg border bg-black/65 px-3 py-2 backdrop-blur-md ${
            hud.lowAmmo ? "border-red-500/50" : "border-white/10"
          }`}
        >
          <div className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
            munição
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-3xl font-black tabular-nums ${
                hud.lowAmmo ? "text-red-400" : "text-white"
              }`}
            >
              {hud.mag}
            </span>
            <span className="text-white/35">/</span>
            <span className="text-lg tabular-nums text-white/65">
              {hud.reserve}
            </span>
          </div>
        </div>
      </div>

      {/* Subtle control strip */}
      {!hud.paused &&
        !hud.showHelp &&
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
            <div className="text-2xl font-black tracking-[0.2em] text-red-300">
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
                              className="rounded bg-amber-400/20 px-1 py-px text-[9px] font-black tracking-wide text-amber-300"
                              title="MVP"
                            >
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
