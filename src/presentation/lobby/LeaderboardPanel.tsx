"use client";

import { useEffect, useState } from "react";

type LeaderboardRow = {
  nickname: string;
  kills: number;
  wins: number;
  matches: number;
};

/**
 * Top 5 daily kills via `@/domains/stats.getTopByKills`.
 * Soft-fails to [] if the domain is missing or throws (spec §2.4).
 */
function loadTop5(): LeaderboardRow[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const stats = require("@/domains/stats") as {
      getTopByKills?: (n?: number) => LeaderboardRow[];
    };
    const rows = stats.getTopByKills?.(5);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Daily local ranking widget for the lobby. Spec §2.4. */
export function LeaderboardPanel() {
  const [entries, setEntries] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    setEntries(loadTop5());
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[10px] font-bold tracking-[0.22em] text-white/55">
          RANKING DO DIA
        </h2>
        <span className="text-[10px] font-semibold text-amber-300/70">
          top kills
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs leading-relaxed text-white/40">
          Jogue uma partida para aparecer no ranking diário.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {entries.map((e, i) => (
            <li
              key={`${e.nickname}-${i}`}
              className="flex items-center justify-between gap-2 text-sm text-white/75"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/5 text-[10px] font-bold tabular-nums text-amber-400/90">
                  {i + 1}
                </span>
                <span className="truncate font-medium text-white/85">
                  {e.nickname}
                </span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-white/45">
                <span className="font-semibold text-amber-200/90">{e.kills}</span>{" "}
                K · {e.wins}W · {e.matches}P
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
