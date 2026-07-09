import type { Team } from "@/shared/types/team";

export type { Team };

/** Default private-match roster size (3v3). */
export const MATCH_SIZE = 6;

export interface RosterPlayer {
  id: string;
  nickname: string;
  team: Team;
  isBot: boolean;
}

export interface RoomSession {
  code: string;
  region: "BR" | "US";
  maxPlayers: number;
  humanIds: string[];
  botFill: boolean;
}
