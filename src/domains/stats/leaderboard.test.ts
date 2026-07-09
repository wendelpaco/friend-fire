import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEADERBOARD_STORAGE_KEY,
  dayKey,
  getTopByKills,
  loadLeaderboardState,
  saveLeaderboardState,
  upsertPlayerStats,
} from "./leaderboard";

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

describe("dayKey", () => {
  it("returns YYYY-MM-DD for a fixed local date", () => {
    const d = new Date(2026, 6, 9); // Jul 9 2026 local
    expect(dayKey(d)).toBe("2026-07-09");
  });
});

describe("loadLeaderboardState / saveLeaderboardState", () => {
  it("returns empty state when nothing stored", () => {
    const s = loadLeaderboardState();
    expect(s.dayKey).toBe(dayKey());
    expect(s.entries).toEqual([]);
  });

  it("round-trips under ff_leaderboard_v1", () => {
    const today = dayKey();
    saveLeaderboardState({
      dayKey: today,
      entries: [{ nickname: "Alpha", kills: 10, wins: 2, matches: 3 }],
    });
    expect(store[LEADERBOARD_STORAGE_KEY]).toBeTruthy();
    const loaded = loadLeaderboardState();
    expect(loaded.dayKey).toBe(today);
    expect(loaded.entries).toEqual([
      { nickname: "Alpha", kills: 10, wins: 2, matches: 3 },
    ]);
  });

  it("resets when stored dayKey is not today", () => {
    store[LEADERBOARD_STORAGE_KEY] = JSON.stringify({
      dayKey: "2000-01-01",
      entries: [{ nickname: "Old", kills: 99, wins: 9, matches: 9 }],
    });
    const s = loadLeaderboardState();
    expect(s.dayKey).toBe(dayKey());
    expect(s.entries).toEqual([]);
  });

  it("recovers from corrupt JSON", () => {
    store[LEADERBOARD_STORAGE_KEY] = "{not-json";
    const s = loadLeaderboardState();
    expect(s.dayKey).toBe(dayKey());
    expect(s.entries).toEqual([]);
  });
});

describe("upsertPlayerStats", () => {
  it("creates a new entry with +kills +1 match and win when won", () => {
    const s = upsertPlayerStats({ nickname: "Bravo", kills: 5, won: true });
    expect(s.entries).toEqual([
      { nickname: "Bravo", kills: 5, wins: 1, matches: 1 },
    ]);
  });

  it("does not increment wins on loss", () => {
    upsertPlayerStats({ nickname: "Bravo", kills: 2, won: false });
    const s = loadLeaderboardState();
    expect(s.entries[0]).toEqual({
      nickname: "Bravo",
      kills: 2,
      wins: 0,
      matches: 1,
    });
  });

  it("accumulates kills/matches/wins for same nickname", () => {
    upsertPlayerStats({ nickname: "Alpha", kills: 3, won: true });
    upsertPlayerStats({ nickname: "Alpha", kills: 4, won: false });
    upsertPlayerStats({ nickname: "alpha", kills: 1, won: true }); // case-insensitive
    const e = loadLeaderboardState().entries.find(
      (x) => x.nickname.toLowerCase() === "alpha",
    );
    expect(e?.kills).toBe(8);
    expect(e?.wins).toBe(2);
    expect(e?.matches).toBe(3);
  });

  it("clamps negative kills", () => {
    upsertPlayerStats({ nickname: "X", kills: -10, won: false });
    expect(loadLeaderboardState().entries[0].kills).toBe(0);
  });
});

describe("getTopByKills", () => {
  it("sorts by kills desc then wins desc", () => {
    saveLeaderboardState({
      dayKey: dayKey(),
      entries: [
        { nickname: "Low", kills: 1, wins: 5, matches: 5 },
        { nickname: "High", kills: 10, wins: 1, matches: 2 },
        { nickname: "MidA", kills: 5, wins: 1, matches: 3 },
        { nickname: "MidB", kills: 5, wins: 3, matches: 3 },
      ],
    });
    const top = getTopByKills(3);
    expect(top.map((e) => e.nickname)).toEqual(["High", "MidB", "MidA"]);
  });

  it("limits to n", () => {
    for (let i = 0; i < 6; i++) {
      upsertPlayerStats({ nickname: `P${i}`, kills: i, won: false });
    }
    expect(getTopByKills(5)).toHaveLength(5);
    expect(getTopByKills(0)).toEqual([]);
  });
});
