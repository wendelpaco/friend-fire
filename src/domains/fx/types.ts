/** Surface hit by a projectile (cosmetic FX only). */
export type ImpactSurface = "wall" | "ground" | "prop";

/** Visual kind derived from surface for particle bias. */
export type ImpactKind = "wall" | "ground" | "prop";

/** Coarse state (legacy / speed-only). */
export type LocomotionState = "idle" | "run";

/**
 * Directional locomotion (angle between move and model facing).
 * Prefer `LocomotionDir` from locomotion.ts for new code.
 */
export type LocomotionDirection =
  | "idle"
  | "forward"
  | "backward"
  | "strafeLeft"
  | "strafeRight";

export interface ImpactPoint {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  surface: ImpactSurface;
}

export interface DecalSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  /** Quad size in meters (0.12–0.22). */
  size: number;
  createdAt: number;
  /** Lifetime in seconds. */
  life: number;
}

export interface ChunkSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  /** Chunk extent in meters (~0.15–0.35). */
  size: number;
  createdAt: number;
  /** Lifetime in seconds before fade/despawn. */
  life: number;
}

/** Pure wall-damage bookkeeping (renderer owns meshes). */
export interface WallDamageState {
  chunks: ChunkSpec[];
  decals: DecalSpec[];
}

export interface CreateImpactResult {
  state: WallDamageState;
  decal: DecalSpec | null;
  chunk: ChunkSpec | null;
  kind: ImpactKind;
}

/** Locked defaults from combat-feedback design. */
export const DEFAULT_CHUNK_LIFE = 5.0;
export const DEFAULT_DECAL_LIFE = 10.0;
export const DEFAULT_CHUNK_FADE = 0.4;
export const MAX_CHUNKS = 40;
export const MAX_DECALS = 80;
export const DEFAULT_RUN_THRESHOLD = 0.3;

export const DECAL_SIZE_MIN = 0.12;
export const DECAL_SIZE_MAX = 0.22;
export const CHUNK_SIZE_MIN = 0.15;
export const CHUNK_SIZE_MAX = 0.35;
/** Normal bias (m) to reduce decal z-fighting. */
export const DECAL_NORMAL_BIAS = 0.02;
