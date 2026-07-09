export type RegionCode = "BR" | "US";

export interface PlayerIdentity {
  sessionId: string;
  nickname: string;
  region: RegionCode;
  xp: number;
}

export interface DailyMission {
  id: string;
  label: string;
  xp: number;
  target: number;
  progress: number;
}
