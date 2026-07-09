import { createId } from "@/shared/ids";
import { clamp } from "@/shared/math";
import {
  CHUNK_SIZE_MAX,
  CHUNK_SIZE_MIN,
  DECAL_NORMAL_BIAS,
  DECAL_SIZE_MAX,
  DECAL_SIZE_MIN,
  DEFAULT_CHUNK_LIFE,
  DEFAULT_DECAL_LIFE,
  MAX_CHUNKS,
  MAX_DECALS,
  type ChunkSpec,
  type CreateImpactResult,
  type DecalSpec,
  type ImpactKind,
  type ImpactPoint,
  type WallDamageState,
} from "./types";

export function emptyWallDamage(): WallDamageState {
  return { chunks: [], decals: [] };
}

export function shouldExpire(
  item: { createdAt: number; life: number },
  now: number,
): boolean {
  return now - item.createdAt >= item.life;
}

/** Age of an item in seconds (clamped to [0, life]). */
export function itemAge(
  item: { createdAt: number; life: number },
  now: number,
): number {
  return clamp(now - item.createdAt, 0, item.life);
}

/** Opacity 1→0 over the last `fade` seconds of life (default chunk fade 0.4s). */
export function fadeOpacity(
  item: { createdAt: number; life: number },
  now: number,
  fade = 0.4,
): number {
  const remaining = item.life - (now - item.createdAt);
  if (remaining <= 0) return 0;
  if (remaining >= fade) return 1;
  return remaining / fade;
}

/**
 * Drop expired chunks/decals. Pure: returns a new state.
 * Does not touch map collision geometry.
 */
export function expireWallDamage(
  state: WallDamageState,
  now: number,
): WallDamageState {
  return {
    chunks: state.chunks.filter((c) => !shouldExpire(c, now)),
    decals: state.decals.filter((d) => !shouldExpire(d, now)),
  };
}

/**
 * Enforce hard caps by dropping oldest entries first.
 */
export function enforceCaps(
  state: WallDamageState,
  maxChunks = MAX_CHUNKS,
  maxDecals = MAX_DECALS,
): WallDamageState {
  let chunks = state.chunks;
  let decals = state.decals;
  if (chunks.length > maxChunks) {
    chunks = chunks.slice(chunks.length - maxChunks);
  }
  if (decals.length > maxDecals) {
    decals = decals.slice(decals.length - maxDecals);
  }
  return { chunks, decals };
}

function impactKind(surface: ImpactPoint["surface"]): ImpactKind {
  return surface;
}

function sizeInRange(min: number, max: number, seed: number): number {
  const t = seed - Math.floor(seed);
  return min + t * (max - min);
}

/**
 * Register cosmetic wall damage from a hit.
 * - Ground/prop: decal only (no wall chunk).
 * - Wall: decal + temporary chunk.
 * Never mutates collision walls; state is cosmetic bookkeeping only.
 */
export function createImpact(
  state: WallDamageState,
  hit: ImpactPoint,
  now: number,
  opts?: {
    chunkLife?: number;
    decalLife?: number;
    maxChunks?: number;
    maxDecals?: number;
    /** Optional deterministic size seed in [0,1). */
    sizeSeed?: number;
  },
): CreateImpactResult {
  const kind = impactKind(hit.surface);
  const seed = opts?.sizeSeed ?? Math.random();
  const chunkLife = opts?.chunkLife ?? DEFAULT_CHUNK_LIFE;
  const decalLife = opts?.decalLife ?? DEFAULT_DECAL_LIFE;

  const bx = hit.x + hit.nx * DECAL_NORMAL_BIAS;
  const by = hit.y + hit.ny * DECAL_NORMAL_BIAS;
  const bz = hit.z + hit.nz * DECAL_NORMAL_BIAS;

  const decal: DecalSpec = {
    id: createId("decal"),
    x: bx,
    y: by,
    z: bz,
    nx: hit.nx,
    ny: hit.ny,
    nz: hit.nz,
    size: sizeInRange(DECAL_SIZE_MIN, DECAL_SIZE_MAX, seed),
    createdAt: now,
    life: decalLife,
  };

  let chunk: ChunkSpec | null = null;
  if (hit.surface === "wall") {
    chunk = {
      id: createId("chunk"),
      x: hit.x,
      y: hit.y,
      z: hit.z,
      nx: hit.nx,
      ny: hit.ny,
      nz: hit.nz,
      size: sizeInRange(CHUNK_SIZE_MIN, CHUNK_SIZE_MAX, seed + 0.37),
      createdAt: now,
      life: chunkLife,
    };
  }

  let next: WallDamageState = {
    chunks: chunk ? [...state.chunks, chunk] : [...state.chunks],
    decals: [...state.decals, decal],
  };
  next = expireWallDamage(next, now);
  next = enforceCaps(next, opts?.maxChunks, opts?.maxDecals);

  return { state: next, decal, chunk, kind };
}

/**
 * Explicit non-mutation helper for tests/callers:
 * wall damage never yields collision wall updates.
 */
export function collisionWallsUnchanged<T>(walls: T): T {
  return walls;
}
