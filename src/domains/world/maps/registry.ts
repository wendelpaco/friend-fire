import type { GameMap } from "../types";
import { MAP_DUST } from "./dust";
import { MAP_FAVELA } from "./favela";
import { MAP_YARD } from "./yard";

export const MAP_IDS = ["dust", "favela", "yard"] as const;
export type MapId = (typeof MAP_IDS)[number];

const MAP_BY_ID: Record<MapId, GameMap> = {
  dust: MAP_DUST,
  favela: MAP_FAVELA,
  yard: MAP_YARD,
};

/** All registered maps in stable order (dust, favela, yard). */
export function listMaps(): GameMap[] {
  return MAP_IDS.map((id) => MAP_BY_ID[id]);
}

/**
 * Resolve a map by id. Unknown ids fall back to dust so callers
 * (URL params, room metadata) never crash on a bad mapId.
 */
export function getMapById(id: string): GameMap {
  if ((MAP_IDS as readonly string[]).includes(id)) {
    return MAP_BY_ID[id as MapId];
  }
  return MAP_DUST;
}
