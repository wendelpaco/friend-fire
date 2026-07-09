/**
 * Daily local leaderboard — kills/wins/matches per nickname (`ff_leaderboard_v1`).
 * Resets when the calendar day (local) changes.
 */

import type {
  LeaderboardEntry,
  LeaderboardState,
  UpsertPlayerStatsInput,
} from "./types";

export const LEADERBOARD_STORAGE_KEY = "ff_leaderboard_v1";

/** Local calendar day key YYYY-MM-DD. */
export function dayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function emptyState(key: string = dayKey()): LeaderboardState {
  return { dayKey: key, entries: [] };
}

function isValidEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as LeaderboardEntry;
  return (
    typeof v.nickname === "string" &&
    v.nickname.trim().length > 0 &&
    Number.isFinite(Number(v.kills)) &&
    Number.isFinite(Number(v.wins)) &&
    Number.isFinite(Number(v.matches))
  );
}

function isValidState(value: unknown): value is LeaderboardState {
  if (!value || typeof value !== "object") return false;
  const v = value as LeaderboardState;
  return typeof v.dayKey === "string" && Array.isArray(v.entries);
}

function normalizeEntry(e: LeaderboardEntry): LeaderboardEntry {
  return {
    nickname: e.nickname.trim().slice(0, 16) || "Operador",
    kills: Math.max(0, Math.floor(Number(e.kills) || 0)),
    wins: Math.max(0, Math.floor(Number(e.wins) || 0)),
    matches: Math.max(0, Math.floor(Number(e.matches) || 0)),
  };
}

/** Load leaderboard; resets entries when day key differs. */
export function loadLeaderboardState(): LeaderboardState {
  const today = dayKey();
  if (typeof window === "undefined") return emptyState(today);

  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) return emptyState(today);
    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) return emptyState(today);
    if (parsed.dayKey !== today) return emptyState(today);
    return {
      dayKey: parsed.dayKey,
      entries: parsed.entries.filter(isValidEntry).map(normalizeEntry),
    };
  } catch {
    return emptyState(today);
  }
}

export function saveLeaderboardState(state: LeaderboardState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LEADERBOARD_STORAGE_KEY,
      JSON.stringify({
        dayKey: state.dayKey,
        entries: state.entries.map(normalizeEntry),
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

/**
 * Upsert local nickname: +kills, +1 match, +1 win if won.
 * Persists under today's dayKey.
 */
export function upsertPlayerStats(
  input: UpsertPlayerStatsInput,
): LeaderboardState {
  const state = loadLeaderboardState();
  const nick =
    (input.nickname || "Operador").trim().slice(0, 16) || "Operador";
  const kills = Math.max(0, Math.floor(Number(input.kills) || 0));

  const idx = state.entries.findIndex(
    (e) => e.nickname.toLowerCase() === nick.toLowerCase(),
  );

  if (idx >= 0) {
    const cur = state.entries[idx];
    state.entries[idx] = {
      nickname: cur.nickname,
      kills: cur.kills + kills,
      wins: cur.wins + (input.won ? 1 : 0),
      matches: cur.matches + 1,
    };
  } else {
    state.entries.push({
      nickname: nick,
      kills,
      wins: input.won ? 1 : 0,
      matches: 1,
    });
  }

  saveLeaderboardState(state);
  return {
    dayKey: state.dayKey,
    entries: state.entries.map((e) => ({ ...e })),
  };
}

/**
 * Top N by kills descending; ties broken by wins descending, then nickname.
 */
export function getTopByKills(n: number = 5): LeaderboardEntry[] {
  const limit = Math.max(0, Math.floor(Number(n) || 0));
  const { entries } = loadLeaderboardState();
  return [...entries]
    .sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.nickname.localeCompare(b.nickname);
    })
    .slice(0, limit)
    .map((e) => ({ ...e }));
}
