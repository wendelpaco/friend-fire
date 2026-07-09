/**
 * Match end history — last N matches in localStorage (`ff_match_history`).
 */

import type { AppendMatchInput, MatchHistoryEntry, MatchResult } from "./types";

export const MATCH_HISTORY_STORAGE_KEY = "ff_match_history";
export const MATCH_HISTORY_MAX = 20;

const RESULTS: readonly MatchResult[] = ["win", "loss", "draw"];

function readRaw(): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MATCH_HISTORY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeRaw(entries: MatchHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MATCH_HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode */
  }
}

function isResult(value: unknown): value is MatchResult {
  return typeof value === "string" && (RESULTS as readonly string[]).includes(value);
}

function normalizeEntry(value: unknown): MatchHistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.nickname !== "string" || !v.nickname.trim()) return null;
  if (!isResult(v.result)) return null;
  if (typeof v.map !== "string") return null;

  const kills = Math.max(0, Math.floor(Number(v.kills) || 0));
  const deaths = Math.max(0, Math.floor(Number(v.deaths) || 0));
  const at = Number(v.at);
  const moneyRaw = v.money;
  const money =
    moneyRaw === undefined || moneyRaw === null
      ? undefined
      : Math.max(0, Math.floor(Number(moneyRaw) || 0));

  const entry: MatchHistoryEntry = {
    at: Number.isFinite(at) && at > 0 ? at : Date.now(),
    nickname: String(v.nickname).trim().slice(0, 16),
    kills,
    deaths,
    result: v.result,
    map: String(v.map).trim() || "?",
  };
  if (money !== undefined) entry.money = money;
  return entry;
}

function loadAll(): MatchHistoryEntry[] {
  const parsed = readRaw();
  if (!Array.isArray(parsed)) return [];
  const out: MatchHistoryEntry[] = [];
  for (const item of parsed) {
    const e = normalizeEntry(item);
    if (e) out.push(e);
  }
  return out.slice(0, MATCH_HISTORY_MAX);
}

/**
 * Append a finished match. Newest first. Caps at MATCH_HISTORY_MAX (20).
 * Returns the updated list.
 */
export function appendMatch(input: AppendMatchInput): MatchHistoryEntry[] {
  const kills = Math.max(0, Math.floor(Number(input.kills) || 0));
  const deaths = Math.max(0, Math.floor(Number(input.deaths) || 0));
  const entry: MatchHistoryEntry = {
    at: input.at ?? Date.now(),
    nickname: (input.nickname || "Operador").trim().slice(0, 16) || "Operador",
    kills,
    deaths,
    result: input.result,
    map: (input.map || "?").trim() || "?",
  };
  if (input.money !== undefined) {
    entry.money = Math.max(0, Math.floor(Number(input.money) || 0));
  }

  const next = [entry, ...loadAll()].slice(0, MATCH_HISTORY_MAX);
  writeRaw(next);
  return next;
}

/**
 * Recent matches, newest first.
 * @param limit optional cap (default all stored, max 20)
 */
export function getRecentMatches(limit: number = MATCH_HISTORY_MAX): MatchHistoryEntry[] {
  const n = Math.max(0, Math.floor(Number(limit) || 0));
  return loadAll().slice(0, n);
}

/** K/D ratio helper: kills / max(1, deaths). */
export function kdRatio(kills: number, deaths: number): number {
  const k = Math.max(0, Number(kills) || 0);
  const d = Math.max(0, Number(deaths) || 0);
  return k / Math.max(1, d);
}
