import type { RosterPlayer, Team } from "./types";
import { MATCH_SIZE } from "./types";

/**
 * Pads a human roster with bots until `matchSize`.
 * New bots alternate TR/CT in push order.
 */
export function fillBots(
  humans: RosterPlayer[],
  matchSize: number = MATCH_SIZE,
): RosterPlayer[] {
  const roster = humans.map((p) => ({ ...p }));
  let botN = 0;
  while (roster.length < matchSize) {
    botN += 1;
    const team: Team = roster.length % 2 === 0 ? "TR" : "CT";
    roster.push({
      id: `bot_${botN}`,
      nickname: `BOT ${botN}`,
      team,
      isBot: true,
    });
  }
  return roster;
}

/**
 * Reassigns teams for a balanced TR/CT split (alternating by index).
 * Preserves player order and non-team fields.
 */
export function assignTeams(players: RosterPlayer[]): RosterPlayer[] {
  return players.map((p, i) => ({
    ...p,
    team: (i % 2 === 0 ? "TR" : "CT") as Team,
  }));
}
