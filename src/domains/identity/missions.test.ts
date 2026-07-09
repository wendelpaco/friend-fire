import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAILY_MISSION_CATALOG,
  getMissionsWithProgress,
  getTodayKey,
  loadMissionState,
  MISSIONS_STORAGE_KEY,
  recordMatchResult,
  saveMissionState,
} from "./missions";
import { getXp } from "./storage";

const store: Record<string, string> = {};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  });
  vi.stubGlobal("window", globalThis);
});

describe("getTodayKey", () => {
  it("returns YYYY-MM-DD for a fixed local date", () => {
    const d = new Date(2026, 6, 9); // Jul 9 2026 local
    expect(getTodayKey(d)).toBe("2026-07-09");
  });
});

describe("loadMissionState / saveMissionState", () => {
  it("returns empty state when nothing stored", () => {
    const s = loadMissionState();
    expect(s.dayKey).toBe(getTodayKey());
    expect(s.progress).toEqual({});
    expect(s.claimed).toEqual([]);
  });

  it("round-trips progress and claimed under ff_missions_v1", () => {
    const dayKey = getTodayKey();
    saveMissionState({
      dayKey,
      progress: { play_3: 2, kills_10: 7 },
      claimed: ["play_3"],
    });
    expect(store[MISSIONS_STORAGE_KEY]).toBeTruthy();
    const loaded = loadMissionState();
    expect(loaded.dayKey).toBe(dayKey);
    expect(loaded.progress.play_3).toBe(2);
    expect(loaded.progress.kills_10).toBe(7);
    expect(loaded.claimed).toEqual(["play_3"]);
  });

  it("resets when stored dayKey is not today", () => {
    store[MISSIONS_STORAGE_KEY] = JSON.stringify({
      dayKey: "2000-01-01",
      progress: { play_3: 3 },
      claimed: ["play_3"],
    });
    const s = loadMissionState();
    expect(s.dayKey).toBe(getTodayKey());
    expect(s.progress).toEqual({});
    expect(s.claimed).toEqual([]);
  });

  it("recovers from corrupt JSON", () => {
    store[MISSIONS_STORAGE_KEY] = "{not-json";
    const s = loadMissionState();
    expect(s.dayKey).toBe(getTodayKey());
    expect(s.progress).toEqual({});
  });
});

describe("getMissionsWithProgress", () => {
  it("merges catalog with zeros when empty", () => {
    const missions = getMissionsWithProgress();
    expect(missions.map((m) => m.id)).toEqual(
      DAILY_MISSION_CATALOG.map((m) => m.id),
    );
    expect(missions.every((m) => m.progress === 0 && m.claimed === false)).toBe(
      true,
    );
    const kills = missions.find((m) => m.id === "kills_10");
    expect(kills?.label).toBe("Faça 10 kills");
    expect(kills?.target).toBe(10);
    expect(kills?.xp).toBe(250);
  });

  it("reflects saved progress", () => {
    saveMissionState({
      dayKey: getTodayKey(),
      progress: { win_3: 2 },
      claimed: [],
    });
    const win = getMissionsWithProgress().find((m) => m.id === "win_3");
    expect(win?.progress).toBe(2);
    expect(win?.claimed).toBe(false);
  });
});

describe("recordMatchResult", () => {
  it("always increments play_3 by 1", () => {
    const r = recordMatchResult({ won: false, kills: 0 });
    const play = r.missions.find((m) => m.id === "play_3");
    expect(play?.progress).toBe(1);
    expect(r.xpGranted).toBe(0);
    expect(r.completedIds).toEqual([]);
  });

  it("increments win_3 only when won", () => {
    recordMatchResult({ won: false, kills: 0 });
    let win = getMissionsWithProgress().find((m) => m.id === "win_3");
    expect(win?.progress).toBe(0);

    recordMatchResult({ won: true, kills: 0 });
    win = getMissionsWithProgress().find((m) => m.id === "win_3");
    expect(win?.progress).toBe(1);
  });

  it("adds kills toward kills_10 and caps at target", () => {
    recordMatchResult({ won: false, kills: 6 });
    recordMatchResult({ won: false, kills: 8 });
    const kills = getMissionsWithProgress().find((m) => m.id === "kills_10");
    expect(kills?.progress).toBe(10);
  });

  it("grants XP once when mission completes and marks claimed", () => {
    // play_3 target 3 → complete on third match
    recordMatchResult({ won: false, kills: 0 });
    recordMatchResult({ won: false, kills: 0 });
    const third = recordMatchResult({ won: false, kills: 0 });
    expect(third.completedIds).toContain("play_3");
    expect(third.xpGranted).toBe(150);
    expect(third.missions.find((m) => m.id === "play_3")?.claimed).toBe(true);
    expect(getXp()).toBe(150);

    // further matches do not re-grant
    const fourth = recordMatchResult({ won: false, kills: 0 });
    expect(fourth.completedIds).not.toContain("play_3");
    expect(fourth.xpGranted).toBe(0);
    expect(getXp()).toBe(150);
  });

  it("can complete multiple missions in one match", () => {
    // Preload near-complete state
    saveMissionState({
      dayKey: getTodayKey(),
      progress: { play_3: 2, win_3: 2, kills_10: 9 },
      claimed: [],
    });
    const r = recordMatchResult({ won: true, kills: 2 });
    expect(r.completedIds.sort()).toEqual(
      ["kills_10", "play_3", "win_3"].sort(),
    );
    expect(r.xpGranted).toBe(150 + 450 + 250);
    expect(getXp()).toBe(850);
  });

  it("caps play_3 progress at target", () => {
    for (let i = 0; i < 5; i++) {
      recordMatchResult({ won: false, kills: 0 });
    }
    const play = getMissionsWithProgress().find((m) => m.id === "play_3");
    expect(play?.progress).toBe(3);
  });

  it("ignores negative kills", () => {
    recordMatchResult({ won: false, kills: -5 });
    const kills = getMissionsWithProgress().find((m) => m.id === "kills_10");
    expect(kills?.progress).toBe(0);
  });
});
