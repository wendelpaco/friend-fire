/**
 * Pure helpers for prop GPU batching / propDetail LOD (W1).
 */

export type PropKind =
  | "crate"
  | "barrel"
  | "car"
  | "dumpster"
  | "container"
  | "debris"
  | "pole";

/** Kinds that are a single body mesh (safe InstancedMesh). */
export const INSTANCEABLE_KINDS = [
  "crate",
  "barrel",
  "debris",
  "dumpster",
] as const;

export type InstanceableKind = (typeof INSTANCEABLE_KINDS)[number];

export function normalizePropKind(kind?: string | null): PropKind {
  if (
    kind === "barrel" ||
    kind === "car" ||
    kind === "dumpster" ||
    kind === "container" ||
    kind === "debris" ||
    kind === "pole" ||
    kind === "crate"
  ) {
    return kind;
  }
  return "crate";
}

export function isInstanceableKind(kind: PropKind): kind is InstanceableKind {
  return (
    kind === "crate" ||
    kind === "barrel" ||
    kind === "debris" ||
    kind === "dumpster"
  );
}

/** Batch key for InstancedMesh (geometry + material identity). */
export function propBatchKey(kind: InstanceableKind, color: number): string {
  return `${kind}:${(color >>> 0).toString(16)}`;
}

/**
 * propDetail LOD:
 * - 0: drop debris + poles (noise / thin objects)
 * - 1+: all kinds
 */
export function shouldIncludePropKind(
  kind: PropKind,
  propDetail: number,
): boolean {
  const d = Number.isFinite(propDetail) ? propDetail : 1;
  if (d <= 0) {
    if (kind === "debris" || kind === "pole") return false;
  }
  return true;
}

/**
 * Shadow camera half-extent from map size (tighter = cheaper shadow map).
 * propDetail 0 → smaller frustum; 2 → slightly larger.
 */
export function shadowHalfExtent(
  mapWidth: number,
  mapDepth: number,
  propDetail: number,
): number {
  const base = Math.max(mapWidth, mapDepth) * 0.55;
  const d = Number.isFinite(propDetail) ? propDetail : 1;
  if (d <= 0) return Math.max(18, base * 0.75);
  if (d >= 2) return Math.max(28, base * 1.05);
  return Math.max(22, base * 0.9);
}

/** Particle / burst density from fxBudget (0–1). */
export function fxDensityFromBudget(fxBudget: number): number {
  if (!Number.isFinite(fxBudget)) return 1;
  return Math.max(0, Math.min(1, fxBudget));
}
