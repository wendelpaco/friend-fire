import { describe, expect, it } from "vitest";
import { MATCH_SIZE, type RosterPlayer } from "./types";
import { assignTeams, fillBots } from "./roster";

function human(
  id: string,
  team: RosterPlayer["team"] = "TR",
): RosterPlayer {
  return { id, nickname: id, team, isBot: false };
}

describe("MATCH_SIZE", () => {
  it("is 6", () => {
    expect(MATCH_SIZE).toBe(6);
  });
});

describe("fillBots", () => {
  it("pads humans to matchSize with bots", () => {
    const roster = fillBots([human("h1")], 6);
    expect(roster).toHaveLength(6);
    expect(roster.filter((p) => !p.isBot)).toHaveLength(1);
    expect(roster.filter((p) => p.isBot)).toHaveLength(5);
  });

  it("defaults matchSize to MATCH_SIZE", () => {
    const roster = fillBots([human("h1"), human("h2")]);
    expect(roster).toHaveLength(MATCH_SIZE);
  });

  it("does not add bots when already full", () => {
    const humans = Array.from({ length: 6 }, (_, i) => human(`h${i}`));
    const roster = fillBots(humans, 6);
    expect(roster).toHaveLength(6);
    expect(roster.every((p) => !p.isBot)).toBe(true);
  });

  it("marks bots and names them BOT n", () => {
    const roster = fillBots([], 2);
    expect(roster[0]).toMatchObject({
      id: "bot_1",
      nickname: "BOT 1",
      isBot: true,
    });
    expect(roster[1]).toMatchObject({
      id: "bot_2",
      nickname: "BOT 2",
      isBot: true,
    });
  });

  it("alternates team for successive bots by roster index", () => {
    // empty → indices 0,1,2 → TR, CT, TR
    const roster = fillBots([], 3);
    expect(roster.map((p) => p.team)).toEqual(["TR", "CT", "TR"]);
  });

  it("does not mutate the input array", () => {
    const humans = [human("h1")];
    fillBots(humans, 3);
    expect(humans).toHaveLength(1);
  });
});

describe("assignTeams", () => {
  it("balances TR/CT by alternating index", () => {
    const players = [
      human("a", "CT"),
      human("b", "CT"),
      human("c", "CT"),
      human("d", "CT"),
      human("e", "CT"),
      human("f", "CT"),
    ];
    const assigned = assignTeams(players);
    expect(assigned.map((p) => p.team)).toEqual([
      "TR",
      "CT",
      "TR",
      "CT",
      "TR",
      "CT",
    ]);
    expect(assigned.filter((p) => p.team === "TR")).toHaveLength(3);
    expect(assigned.filter((p) => p.team === "CT")).toHaveLength(3);
  });

  it("preserves id, nickname, isBot", () => {
    const players: RosterPlayer[] = [
      { id: "x", nickname: "X", team: "CT", isBot: false },
      { id: "bot_1", nickname: "BOT 1", team: "TR", isBot: true },
    ];
    const assigned = assignTeams(players);
    expect(assigned[0]).toEqual({
      id: "x",
      nickname: "X",
      team: "TR",
      isBot: false,
    });
    expect(assigned[1]).toEqual({
      id: "bot_1",
      nickname: "BOT 1",
      team: "CT",
      isBot: true,
    });
  });
});
