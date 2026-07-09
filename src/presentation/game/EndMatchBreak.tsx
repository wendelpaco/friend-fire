"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  grantRewardedXp,
  pickRotatingAd,
  recordImpression,
  StubRewardedAdPort,
} from "@/domains/ads";
import {
  formatMissionProgress,
  getMissionsWithProgress,
  getOrCreateSessionId,
  getXp,
  setXp,
  type DailyMission,
} from "@/domains/identity";
import { pushImpression } from "@/infrastructure/analytics/queue";
import { DEFAULT_MATCH } from "@/domains/match";
import type { MatchResult } from "@/domains/stats";
import { MatchStatsCard } from "@/presentation/game/MatchStatsCard";

const COUNTDOWN_S: number = DEFAULT_MATCH.endMatchPause;
const REWARD_XP = 50;

export interface MatchEndStats {
  kills: number;
  deaths: number;
  money: number;
  result: MatchResult;
  mapName: string;
}

export interface EndMatchBreakProps {
  scoreTR: number;
  scoreCT: number;
  onContinue: () => void;
  onRewardedComplete?: (newXp: number) => void;
  /** Local player end-of-match stats card (above missions/ad). */
  stats?: MatchEndStats | null;
}

export function EndMatchBreak({
  scoreTR,
  scoreCT,
  onContinue,
  onRewardedComplete,
  stats,
}: EndMatchBreakProps) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_S);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardDone, setRewardDone] = useState(false);
  const [xpTotal, setXpTotal] = useState(0);
  const [missions, setMissions] = useState<DailyMission[]>([]);
  const impressed = useRef(false);
  const continued = useRef(false);
  /** Sync in-flight flag (blocks continue + double claim before re-render). */
  const rewardInFlight = useRef(false);
  /** Sync claimed flag so double-click cannot grant XP twice. */
  const rewardClaimed = useRef(false);
  const ad = pickRotatingAd("end_match_break", 0);

  const continueOnce = useCallback(() => {
    if (continued.current || rewardInFlight.current) return;
    continued.current = true;
    onContinue();
  }, [onContinue]);

  useEffect(() => {
    setXpTotal(getXp());
    setMissions(getMissionsWithProgress());
  }, []);

  useEffect(() => {
    if (impressed.current) return;
    impressed.current = true;
    const sessionId = getOrCreateSessionId();
    const imp = recordImpression({
      placement: "end_match_break",
      creativeId: ad.id,
      sessionId,
    });
    pushImpression(imp);
  }, [ad.id]);

  // Pause countdown auto-continue while rewarded ad is in flight.
  useEffect(() => {
    if (rewardBusy) return;
    if (secondsLeft <= 0) {
      continueOnce();
      return;
    }
    const t = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [secondsLeft, continueOnce, rewardBusy]);

  const claimReward = useCallback(async () => {
    if (rewardInFlight.current || rewardClaimed.current) return;
    rewardInFlight.current = true;
    setRewardBusy(true);
    try {
      const port = new StubRewardedAdPort();
      const result = await port.show("rewarded_xp");
      if (result === "completed") {
        rewardClaimed.current = true;
        const next = grantRewardedXp(getXp(), REWARD_XP);
        setXp(next);
        setXpTotal(next);
        setRewardDone(true);
        onRewardedComplete?.(next);
      }
    } finally {
      rewardInFlight.current = false;
      setRewardBusy(false);
    }
  }, [onRewardedComplete]);

  const winner =
    scoreTR > scoreCT ? "TR" : scoreCT > scoreTR ? "CT" : "EMPATE";

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[#0c0e14] shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4 text-center">
          <p className="text-[10px] font-semibold tracking-[0.3em] text-white/40">
            PARTIDA ENCERRADA
          </p>
          <h2 className="mt-1 text-xl font-black tracking-wide">
            {winner === "EMPATE" ? "Empate" : `${winner} venceu`}
          </h2>
          <div className="mt-3 flex items-center justify-center gap-4 text-2xl font-black tabular-nums">
            <span className="text-orange-300">{scoreTR}</span>
            <span className="text-sm font-semibold text-white/30">×</span>
            <span className="text-sky-300">{scoreCT}</span>
          </div>
        </div>

        {stats && (
          <MatchStatsCard
            kills={stats.kills}
            deaths={stats.deaths}
            money={stats.money}
            result={stats.result}
            mapName={stats.mapName}
          />
        )}

        {missions.length > 0 && (
          <div className="border-b border-white/10 px-4 py-3">
            <p className="mb-2 text-center text-[9px] font-bold tracking-[0.22em] text-white/40">
              MISSÕES DO DIA
            </p>
            <ul className="space-y-1">
              {missions.map((m) => {
                const done = m.progress >= m.target;
                return (
                  <li
                    key={m.id}
                    className={`flex items-center justify-between gap-2 text-[11px] ${
                      done ? "text-emerald-300/90" : "text-white/55"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      <span aria-hidden>{done ? "✓" : "○"}</span>
                      <span className="truncate">{m.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-white/40">
                      {formatMissionProgress(m)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Sponsored creative */}
        <a
          href={ad.url || "#"}
          target={ad.url ? "_blank" : undefined}
          rel={ad.url ? "noopener noreferrer" : undefined}
          onClick={(e) => {
            if (!ad.url) e.preventDefault();
          }}
          className="relative mx-4 mt-4 block overflow-hidden rounded-xl border border-white/10"
          style={{
            background: `linear-gradient(135deg, ${ad.bg}, ${ad.bg2 ?? ad.bg})`,
          }}
          aria-label={`Anúncio: ${ad.brand}`}
        >
          <div
            className="absolute left-0 top-0 h-full w-1"
            style={{ background: ad.accent }}
          />
          <div className="px-4 py-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span
                className="text-[10px] font-bold tracking-[0.2em]"
                style={{ color: ad.accent }}
              >
                {ad.brand}
              </span>
              <span className="rounded bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-white/55">
                AD
              </span>
            </div>
            <div className="text-base font-bold" style={{ color: ad.text }}>
              {ad.headline}
            </div>
            {ad.subline && (
              <div className="mt-0.5 text-xs text-white/60">{ad.subline}</div>
            )}
            {ad.cta && (
              <div
                className="mt-2 inline-flex w-fit rounded px-2 py-0.5 text-[10px] font-bold tracking-wide"
                style={{ background: ad.accent, color: ad.bg }}
              >
                {ad.cta}
              </div>
            )}
          </div>
        </a>

        <div className="flex flex-col gap-2 p-4">
          <button
            type="button"
            onClick={claimReward}
            disabled={rewardBusy || rewardDone}
            className="rounded-lg border border-amber-400/40 bg-amber-500/15 py-2.5 text-sm font-bold tracking-wide text-amber-200 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {rewardDone
              ? `+${REWARD_XP} XP creditado · total ${xpTotal}`
              : rewardBusy
                ? "Carregando anúncio…"
                : `Ganhar +${REWARD_XP} XP assistindo`}
          </button>
          <button
            type="button"
            onClick={continueOnce}
            disabled={rewardBusy}
            className="rounded-lg bg-amber-500 py-3 text-sm font-bold tracking-wide text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continuar
            <span className="ml-2 tabular-nums text-black/55">
              ({Math.max(0, secondsLeft)}s)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
