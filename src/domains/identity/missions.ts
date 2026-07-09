import type { DailyMission } from "./types";

/** Static daily mission stubs (progress not yet persisted). */
export const DAILY_MISSION_STUBS: DailyMission[] = [
  {
    id: "play_3",
    label: "Jogue 3 partidas",
    xp: 150,
    target: 3,
    progress: 0,
  },
  {
    id: "win_3",
    label: "Vença 3 partidas",
    xp: 450,
    target: 3,
    progress: 0,
  },
  {
    id: "obj_2",
    label: "Complete 2 objetivos",
    xp: 250,
    target: 2,
    progress: 0,
  },
];

export function formatMissionProgress(m: DailyMission): string {
  return `${m.progress}/${m.target}`;
}
