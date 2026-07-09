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
  /** True after XP was granted for completing this mission today. */
  claimed: boolean;
}

/** Persisted daily missions snapshot (resets when dayKey changes). */
export interface MissionDayState {
  dayKey: string;
  /** mission id → current progress (capped at target when read/written by domain) */
  progress: Record<string, number>;
  /** mission ids that already granted XP today */
  claimed: string[];
}

export interface MissionCatalogEntry {
  id: string;
  label: string;
  xp: number;
  target: number;
}

export interface RecordMatchResultInput {
  won: boolean;
  kills: number;
}

export interface RecordMatchResultOutput {
  missions: DailyMission[];
  xpGranted: number;
  completedIds: string[];
}
