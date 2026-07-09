"use client";

import { kdRatio, type MatchResult } from "@/domains/stats";

export interface MatchStatsCardProps {
  kills: number;
  deaths: number;
  money: number;
  result: MatchResult;
  mapName: string;
}

const RESULT_LABEL: Record<MatchResult, string> = {
  win: "VITÓRIA",
  loss: "DERROTA",
  draw: "EMPATE",
};

const RESULT_CLASS: Record<MatchResult, string> = {
  win: "text-emerald-300",
  loss: "text-red-300",
  draw: "text-amber-200",
};

/** Compact local-player stats strip for match_over / EndMatchBreak. */
export function MatchStatsCard({
  kills,
  deaths,
  money,
  result,
  mapName,
}: MatchStatsCardProps) {
  const kd = kdRatio(kills, deaths);

  return (
    <div className="border-b border-white/10 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold tracking-[0.22em] text-white/40">
          SEUS STATS
        </p>
        <span
          className={`text-[11px] font-black tracking-wide ${RESULT_CLASS[result]}`}
        >
          {RESULT_LABEL[result]}
        </span>
      </div>
      <p className="mb-2 truncate text-center text-[11px] text-white/50">
        {mapName}
      </p>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <StatCell label="Kills" value={String(kills)} />
        <StatCell label="Deaths" value={String(deaths)} />
        <StatCell label="K/D" value={kd.toFixed(2)} />
        <StatCell label="$" value={String(money)} accent />
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/5 px-1.5 py-2">
      <div
        className={`text-sm font-black tabular-nums ${
          accent ? "text-amber-300" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/35">
        {label}
      </div>
    </div>
  );
}
