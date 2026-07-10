import { describe, expect, it } from "vitest";
import {
  CONTROL_HINTS_MAX_ROUNDS,
  bumpRoundsPlayedOnPhase,
  readRoundsPlayed,
  shouldShowControlHints,
  writeRoundsPlayed,
} from "./hudHints";

describe("shouldShowControlHints", () => {
  it("shows for first 2 rounds played", () => {
    expect(
      shouldShowControlHints({
        roundsPlayed: 0,
        scoreboardHeld: false,
        helpOpen: false,
      }),
    ).toBe(true);
    expect(
      shouldShowControlHints({
        roundsPlayed: 1,
        scoreboardHeld: false,
        helpOpen: false,
      }),
    ).toBe(true);
    expect(
      shouldShowControlHints({
        roundsPlayed: CONTROL_HINTS_MAX_ROUNDS,
        scoreboardHeld: false,
        helpOpen: false,
      }),
    ).toBe(false);
  });

  it("reappears while holding TAB (scoreboard) or help open", () => {
    expect(
      shouldShowControlHints({
        roundsPlayed: 99,
        scoreboardHeld: true,
        helpOpen: false,
      }),
    ).toBe(true);
    expect(
      shouldShowControlHints({
        roundsPlayed: 99,
        scoreboardHeld: false,
        helpOpen: true,
      }),
    ).toBe(true);
  });
});

describe("bumpRoundsPlayedOnPhase", () => {
  it("increments only on live → ended", () => {
    expect(bumpRoundsPlayedOnPhase(0, "live", "ended")).toBe(1);
    expect(bumpRoundsPlayedOnPhase(1, "buy", "live")).toBe(1);
    expect(bumpRoundsPlayedOnPhase(1, "live", "live")).toBe(1);
    expect(bumpRoundsPlayedOnPhase(2, null, "ended")).toBe(2);
  });
});

describe("roundsPlayed storage", () => {
  it("reads / writes integer counts", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    expect(readRoundsPlayed(storage)).toBe(0);
    writeRoundsPlayed(2, storage);
    expect(readRoundsPlayed(storage)).toBe(2);
  });
});
