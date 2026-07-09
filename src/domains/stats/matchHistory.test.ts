import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MATCH_HISTORY_MAX,
  MATCH_HISTORY_STORAGE_KEY,
  appendMatch,
  getRecentMatches,
  kdRatio,
} from "./matchHistory";

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

describe("appendMatch / getRecentMatches", () => {
  it("returns empty when nothing stored", () => {
    expect(getRecentMatches()).toEqual([]);
  });

  it("appends newest first under ff_match_history", () => {
    appendMatch({
      nickname: "Alpha",
      kills: 3,
      deaths: 1,
      result: "win",
      map: "Dust",
      money: 2500,
      at: 1000,
    });
    appendMatch({
      nickname: "Alpha",
      kills: 1,
      deaths: 2,
      result: "loss",
      map: "Yard",
      at: 2000,
    });

    expect(store[MATCH_HISTORY_STORAGE_KEY]).toBeTruthy();
    const recent = getRecentMatches();
    expect(recent).toHaveLength(2);
    expect(recent[0].map).toBe("Yard");
    expect(recent[0].at).toBe(2000);
    expect(recent[1].map).toBe("Dust");
    expect(recent[1].money).toBe(2500);
  });

  it("caps at 20 matches", () => {
    for (let i = 0; i < 25; i++) {
      appendMatch({
        nickname: "P",
        kills: i,
        deaths: 0,
        result: "draw",
        map: "Dust",
        at: i + 1,
      });
    }
    const all = getRecentMatches();
    expect(all).toHaveLength(MATCH_HISTORY_MAX);
    expect(all[0].kills).toBe(24);
    expect(all[19].kills).toBe(5);
  });

  it("respects limit on getRecentMatches", () => {
    appendMatch({
      nickname: "A",
      kills: 1,
      deaths: 0,
      result: "win",
      map: "M",
      at: 1,
    });
    appendMatch({
      nickname: "A",
      kills: 2,
      deaths: 0,
      result: "win",
      map: "M",
      at: 2,
    });
    expect(getRecentMatches(1)).toHaveLength(1);
    expect(getRecentMatches(1)[0].kills).toBe(2);
  });

  it("clamps negative kills/deaths", () => {
    const list = appendMatch({
      nickname: "X",
      kills: -3,
      deaths: -1,
      result: "loss",
      map: "Favela",
    });
    expect(list[0].kills).toBe(0);
    expect(list[0].deaths).toBe(0);
  });

  it("recovers from corrupt JSON", () => {
    store[MATCH_HISTORY_STORAGE_KEY] = "{not-json";
    expect(getRecentMatches()).toEqual([]);
    appendMatch({
      nickname: "Ok",
      kills: 1,
      deaths: 0,
      result: "win",
      map: "Dust",
    });
    expect(getRecentMatches()).toHaveLength(1);
  });
});

describe("kdRatio", () => {
  it("divides by max(1, deaths)", () => {
    expect(kdRatio(5, 0)).toBe(5);
    expect(kdRatio(6, 2)).toBe(3);
    expect(kdRatio(0, 4)).toBe(0);
  });
});
