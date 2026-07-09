"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONTROLS_HELP } from "@/game/constants";
import type { HudSnapshot } from "@/game/types";
import { AdBanner } from "@/presentation/ads/AdBanner";
import { BuyMenu } from "@/presentation/game/BuyMenu";
import type { MatchResult } from "@/domains/stats";
import { EndMatchBreak } from "@/presentation/game/EndMatchBreak";
import { SettingsPanel } from "@/presentation/game/SettingsPanel";
import { CopyInviteLink } from "@/presentation/lobby/CopyInviteLink";
import type { Team } from "@/shared/types/team";

function formatTime(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function phaseLabel(hud: HudSnapshot) {
  if (hud.phase === "warmup") return `AQUECIMENTO ${Math.ceil(hud.timeLeft)}`;
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
}

export function GameHud({
  hud,
  roomCode,
  onResume,
  onDismissHelp,
  onOpenHelp,
  onMatchContinue,
  onBuy,
  onCloseBuy,
}: GameHudProps) {
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => {
    if (!hud.paused) setShowSettings(false);
  }, [hud.paused]);
  const localRow = hud.scoreboard.find((r) => r.isLocal);
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

      {/* Minimap */}
      <div className="absolute left-4 top-4 overflow-hidden rounded-lg border border-amber-500/35 bg-black/60 shadow-xl backdrop-blur-md">
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
              const px = ((p.x + 24) / 48) * 100;
              const pz = ((p.z + 24) / 48) * 100;
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

      {/* Top score bar */}
      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-1">
        <div className="flex items-stretch overflow-hidden rounded-lg border border-white/10 bg-black/65 shadow-2xl backdrop-blur-md">
          <div className="flex min-w-[72px] items-center justify-center gap-2 bg-orange-600/25 px-4 py-2">
            <span className="text-[10px] font-bold tracking-widest text-orange-300">
              TR
            </span>
            <span className="text-2xl font-black tabular-nums">
              {hud.scoreTR}
            </span>
          </div>
          <div className="flex min-w-[120px] flex-col items-center justify-center border-x border-white/10 px-5 py-1.5">
            <span className="text-lg font-bold tabular-nums tracking-wide text-amber-50">
              {phaseLabel(hud)}
            </span>
            {hud.phase === "live" && (
              <span className="text-[9px] tracking-[0.25em] text-white/40">
                ROUND {hud.round}
              </span>
            )}
          </div>
          <div className="flex min-w-[72px] items-center justify-center gap-2 bg-sky-600/25 px-4 py-2">
            <span className="text-2xl font-black tabular-nums">
              {hud.scoreCT}
            </span>
            <span className="text-[10px] font-bold tracking-widest text-sky-300">
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

      {/* Killfeed — max 6; new rows fade/slide in */}
      <div className="absolute right-4 top-4 flex w-80 flex-col items-end gap-1.5">
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

      {/* Chat */}
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
                    c.kind === "radio"
                      ? "font-semibold text-orange-300"
                      : "font-semibold text-white/90"
                  }
                >
                  {c.from}
                  {c.kind === "radio" ? " · rádio" : ""}:
                </span>{" "}
                <span className="text-white/85">{c.text}</span>
              </>
            )}
          </div>
        ))}
      </div>

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

      {/* Weapon bar center */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
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
      {!hud.paused && !hud.showHelp && !hud.showBuyMenu && (
        <div className="absolute bottom-[5.5rem] left-1/2 -translate-x-1/2 text-[10px] tracking-wide text-white/30">
          B loja · C câmera ({hud.cameraMode === "free" ? "livre" : "travada"}) ·
          R recarregar · Tab placar · Esc pausar
        </div>
      )}

      {hud.buyMessage && !hud.showBuyMenu && (
        <div className="absolute left-1/2 top-28 z-20 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-black/75 px-4 py-1.5 text-sm text-amber-100 shadow-lg">
          {hud.buyMessage}
        </div>
      )}

      {/* Death overlay */}
      {!hud.alive && !hud.paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/25">
          <div className="rounded-xl border border-red-500/40 bg-black/75 px-10 py-6 text-center shadow-2xl backdrop-blur-md">
            <div className="text-2xl font-black tracking-[0.2em] text-red-300">
              VOCÊ MORREU
            </div>
            <div className="mt-2 text-sm text-white/55">
              {hud.phase === "warmup"
                ? "Respawn em instantes · ou pressione F"
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
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-white/15 bg-[#0c0e14]/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <span className="text-sm font-bold tracking-widest text-white/80">
                PLACAR
              </span>
              <span className="text-xs text-white/40">
                {hud.scoreTR} TR · {hud.scoreCT} CT
              </span>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-white/40">
                <tr className="border-b border-white/5">
                  <th className="px-5 py-2 font-medium">Jogador</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 text-right font-medium">K</th>
                  <th className="px-3 py-2 text-right font-medium">D</th>
                  <th className="px-5 py-2 text-right font-medium">$</th>
                </tr>
              </thead>
              <tbody>
                {hud.scoreboard.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-white/5 ${
                      row.isLocal ? "bg-amber-500/10" : ""
                    } ${!row.alive ? "opacity-45" : ""}`}
                  >
                    <td className="px-5 py-2 font-medium">
                      {row.name}
                      {row.isLocal && (
                        <span className="ml-2 text-[9px] text-amber-400">
                          VOCÊ
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.kills}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.deaths}
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums text-emerald-400/90">
                      {row.money}
                    </td>
                  </tr>
                ))}
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

      {/* Buy menu */}
      {hud.showBuyMenu && onBuy && onCloseBuy && !hud.paused && !hud.matchOver && (
        <BuyMenu
          money={hud.money}
          armor={hud.armor}
          message={hud.buyMessage}
          onBuy={onBuy}
          onClose={onCloseBuy}
        />
      )}

      {/* Pause menu / settings */}
      {hud.paused && !hud.showHelp && !hud.matchOver && !hud.showBuyMenu && (
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
