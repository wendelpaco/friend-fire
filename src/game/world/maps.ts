export {
  MAP_DUST,
  MAP_IDS,
  DEFAULT_MAP_ID,
  getMapById,
  listMaps,
  getLastMapId,
  setLastMapId,
  LAST_MAP_STORAGE_KEY,
  circleHitsWall,
  resolveCircleWalls,
  mapCollisionWalls,
} from "@/domains/world";
export type {
  MapId,
  WallRect,
  PropBox,
  SpawnPoint,
  GameMap,
  BillboardSlot,
  Vec2,
} from "@/domains/world";
