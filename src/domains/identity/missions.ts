/**
 * Daily missions — progress + claimed XP in localStorage (`ff_missions_v1`).
 * Resets when the calendar day (local) changes.
 */

import { grantXp } from "./storage";
import type {
  DailyMission,
  MissionCatalogEntry,
  MissionDayState,
  RecordMatchResultInput,
  RecordMatchResultOutput,
} from "./types";

export const MISSIONS_STORAGE_KEY = "ff_missions_v1";

/** Static mission catalog (no progress). */
export const DAILY_MISSION_CATALOG: readonly MissionCatalogEntry[] = [
  {
    id: "play_3",
    label: "Jogue 3 partidas",
    xp: 150,
    target: 3,
  },
  {
    id: "win_3",
    label: "Vença 3 partidas",
    xp: 450,
    target: 3,
  },
  {
    id: "kills_10",
    label: "Faça 10 kills",
    xp: 250,
    target: 10,
  },
] as const;

/** @deprecated Prefer DAILY_MISSION_CATALOG + getMissionsWithProgress(). */
export const DAILY_MISSION_STUBS: DailyMission[] = DAILY_MISSION_CATALOG.map(
  (m) => ({
    ...m,
    progress: 0,
    claimed: false,
  }),
);

/** Local calendar day key YYYY-MM-DD. */
export function getTodayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function emptyState(dayKey: string = getTodayKey()): MissionDayState {
  return { dayKey, progress: {}, claimed: [] };
}

function isValidState(value: unknown): value is MissionDayState {
  if (!value || typeof value !== "object") return false;
  const v = value as MissionDayState;
  return (
    typeof v.dayKey === "string" &&
    v.progress != null &&
    typeof v.progress === "object" &&
    Array.isArray(v.claimed)
  );
}

/** Load mission state; resets progress/claimed when day key differs. */
export function loadMissionState(): MissionDayState {
  const today = getTodayKey();
  if (typeof window === "undefined") return emptyState(today);

  try {
    const raw = localStorage.getItem(MISSIONS_STORAGE_KEY);
    if (!raw) return emptyState(today);
    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) return emptyState(today);
    if (parsed.dayKey !== today) return emptyState(today);
    return {
      dayKey: parsed.dayKey,
      progress: { ...parsed.progress },
      claimed: [...parsed.claimed],
    };
  } catch {
    return emptyState(today);
  }
}

export function saveMissionState(state: MissionDayState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      MISSIONS_STORAGE_KEY,
      JSON.stringify({
        dayKey: state.dayKey,
        progress: state.progress,
        claimed: state.claimed,
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

function progressFor(
  state: MissionDayState,
  entry: MissionCatalogEntry,
): number {
  const raw = state.progress[entry.id] ?? 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(entry.target, Math.floor(n));
}

function isClaimed(state: MissionDayState, id: string): boolean {
  return state.claimed.includes(id);
}

function mergeMissions(state: MissionDayState): DailyMission[] {
  return DAILY_MISSION_CATALOG.map((entry) => ({
    id: entry.id,
    label: entry.label,
    xp: entry.xp,
    target: entry.target,
    progress: progressFor(state, entry),
    claimed: isClaimed(state, entry.id),
  }));
}

/** Catalog merged with today's progress + claimed flags. */
export function getMissionsWithProgress(): DailyMission[] {
  return mergeMissions(loadMissionState());
}

function bump(
  state: MissionDayState,
  id: string,
  delta: number,
  target: number,
): void {
  if (delta <= 0) return;
  const cur = state.progress[id] ?? 0;
  const next = Math.min(target, Math.max(0, Math.floor(cur)) + Math.floor(delta));
  state.progress[id] = next;
}

/**
 * Apply one match outcome: always +1 play, +1 win if won, +kills toward kills_10.
 * Grants XP once when a mission first reaches its target (not already claimed).
 */
export function recordMatchResult(
  input: RecordMatchResultInput,
): RecordMatchResultOutput {
  const state = loadMissionState();
  const kills = Math.max(0, Math.floor(Number(input.kills) || 0));

  const byId = Object.fromEntries(
    DAILY_MISSION_CATALOG.map((m) => [m.id, m]),
  ) as Record<string, MissionCatalogEntry>;

  bump(state, "play_3", 1, byId.play_3.target);
  if (input.won) bump(state, "win_3", 1, byId.win_3.target);
  bump(state, "kills_10", kills, byId.kills_10.target);

  let xpGranted = 0;
  const completedIds: string[] = [];

  for (const entry of DAILY_MISSION_CATALOG) {
    const progress = progressFor(state, entry);
    if (progress >= entry.target && !isClaimed(state, entry.id)) {
      state.claimed.push(entry.id);
      xpGranted += entry.xp;
      completedIds.push(entry.id);
    }
  }

  if (xpGranted > 0) {
    grantXp(xpGranted);
  }

  saveMissionState(state);

  return {
    missions: mergeMissions(state),
    xpGranted,
    completedIds,
  };
}

export function formatMissionProgress(m: DailyMission): string {
  return `${m.progress}/${m.target}`;
}
