/**
 * Pure C4 plant / defuse / explode — server copy of src/domains/match/bomb.ts
 * Wave 5 §2.1. Keep timings and transitions in sync with domain.
 */

export type BombState =
  | "carried"
  | "planting"
  | "planted"
  | "defusing"
  | "exploded"
  | "defused";

/** Why the last round ended (HUD banners). */
export type RoundEndReason =
  | ""
  | "elimination"
  | "time"
  | "bomb_exploded"
  | "bomb_defused";

/** Seconds to hold F while planting. */
export const PLANT_TIME = 3.5;
/** Seconds to hold F while defusing (no kit). */
export const DEFUSE_TIME = 5;
/**
 * Defuse with kit would be 3.5s (B2). No defuse kit in catalog yet — gap.
 * Keep constant for when kit ships; tickDefuse still uses DEFUSE_TIME.
 */
export const DEFUSE_TIME_KIT = 3.5;
/** Seconds until explosion after plant. */
export const BOMB_TIMER = 40;
/** Spec defuse reach. */
export const DEFUSE_RADIUS = 2.5;

export interface BombMatchState {
  bombState: BombState;
  bombCarrierId: string | null;
  bombX: number;
  bombZ: number;
  /** 0–1 */
  plantProgress: number;
  /** 0–1 */
  defuseProgress: number;
  /** Seconds remaining when planted / defusing. */
  bombTimer: number;
}

export interface BombSite {
  id?: string;
  x: number;
  z: number;
  radius: number;
}

/** Alias used by GameRoom runtime. */
export type BombSimState = BombMatchState;

export const BOMB = {
  plantTime: PLANT_TIME,
  defuseTime: DEFUSE_TIME,
  fuseTime: BOMB_TIMER,
  defuseRadius: DEFUSE_RADIUS,
} as const;

/** Default bomb sites per map id (mirror client 72×72 layouts). */
export const BOMB_SITES: Record<string, BombSite[]> = {
  dust: [
    { id: "A", x: 24, z: -20, radius: 4.2 },
    { id: "B", x: -20, z: 18, radius: 4.2 },
  ],
  favela: [
    { id: "A", x: 22, z: -18, radius: 4.0 },
    { id: "B", x: -20, z: 16, radius: 4.0 },
  ],
  yard: [
    { id: "A", x: 24, z: -18, radius: 4.0 },
    { id: "B", x: -22, z: 18, radius: 4.0 },
  ],
};

export function getBombSites(mapId: string): BombSite[] {
  return BOMB_SITES[mapId] ?? BOMB_SITES.dust!;
}

export function createBombState(
  carrierId: string | null = null,
): BombMatchState {
  return {
    bombState: "carried",
    bombCarrierId: carrierId,
    bombX: 0,
    bombZ: 0,
    plantProgress: 0,
    defuseProgress: 0,
    bombTimer: BOMB_TIMER,
  };
}

/** Reset for a new live round with optional TR carrier. */
export function resetBombForRound(carrierId: string): BombMatchState {
  return createBombState(carrierId || null);
}

export interface BombCarrierCandidate {
  id: string;
  /** Prefer non-bots when assigning / reassigning C4. */
  isBot?: boolean;
}

/**
 * Pick C4 carrier among living TR candidates.
 * Prefers humans; falls back to bots. Empty → "".
 * Keep in sync with src/domains/match/bomb.ts.
 */
export function pickBombCarrier(
  candidates: BombCarrierCandidate[],
  rng: () => number = Math.random,
): string {
  if (candidates.length === 0) return "";
  const humans = candidates.filter((c) => !c.isBot);
  const pool = humans.length > 0 ? humans : candidates;
  const i = Math.floor(rng() * pool.length);
  return pool[i]!.id;
}

function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function isInsideSite(
  x: number,
  z: number,
  site: BombSite,
): boolean {
  const r = site.radius;
  return dist2(x, z, site.x, site.z) <= r * r;
}

export function findSiteAt(
  x: number,
  z: number,
  sites: BombSite[],
): BombSite | null {
  for (const s of sites) {
    if (isInsideSite(x, z, s)) return s;
  }
  return null;
}

export function isWithinRadius(
  x: number,
  z: number,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  return dist2(x, z, cx, cz) <= radius * radius;
}

export function isNearBomb(
  x: number,
  z: number,
  bombX: number,
  bombZ: number,
  radius = DEFUSE_RADIUS,
): boolean {
  return isWithinRadius(x, z, bombX, bombZ, radius);
}

export interface CanPlantInput {
  bomb: BombMatchState;
  playerId: string;
  team: "TR" | "CT";
  alive: boolean;
  x: number;
  z: number;
  stationary: boolean;
  site: BombSite | null;
}

/** TR carrier, alive, stationary, inside site, bomb still carried/planting. */
export function canPlant(input: CanPlantInput): boolean {
  const { bomb, playerId, team, alive, stationary, site } = input;
  if (!alive || team !== "TR" || !stationary || !site) return false;
  if (bomb.bombCarrierId !== playerId) return false;
  if (bomb.bombState !== "carried" && bomb.bombState !== "planting") {
    return false;
  }
  return isInsideSite(input.x, input.z, site);
}

export interface CanDefuseInput {
  bomb: BombMatchState;
  team: "TR" | "CT";
  alive: boolean;
  x: number;
  z: number;
  radius: number;
}

/** CT alive near planted bomb. */
export function canDefuse(input: CanDefuseInput): boolean {
  const { bomb, team, alive, x, z, radius } = input;
  if (!alive || team !== "CT") return false;
  if (bomb.bombState !== "planted" && bomb.bombState !== "defusing") {
    return false;
  }
  return isWithinRadius(x, z, bomb.bombX, bomb.bombZ, radius);
}

/**
 * Advance or cancel plant while holding F.
 * When progress reaches 1, caller should invoke `onPlantComplete`.
 */
export function tickPlant(
  bomb: BombMatchState,
  dt: number,
  holding: boolean,
  plantOk: boolean,
): BombMatchState {
  if (bomb.bombState !== "carried" && bomb.bombState !== "planting") {
    return bomb;
  }
  if (!holding || !plantOk) {
    if (bomb.bombState === "carried" && bomb.plantProgress === 0) return bomb;
    return {
      ...bomb,
      bombState: "carried",
      plantProgress: 0,
    };
  }
  const plantProgress = Math.min(1, bomb.plantProgress + dt / PLANT_TIME);
  return {
    ...bomb,
    bombState: "planting",
    plantProgress,
  };
}

/**
 * Advance or cancel defuse while holding F.
 * When progress reaches 1, caller should invoke `onDefuseComplete`.
 */
export function tickDefuse(
  bomb: BombMatchState,
  dt: number,
  holding: boolean,
  defuseOk: boolean,
): BombMatchState {
  if (bomb.bombState !== "planted" && bomb.bombState !== "defusing") {
    return bomb;
  }
  if (!holding || !defuseOk) {
    if (bomb.bombState === "planted" && bomb.defuseProgress === 0) return bomb;
    return {
      ...bomb,
      bombState: "planted",
      defuseProgress: 0,
    };
  }
  const defuseProgress = Math.min(1, bomb.defuseProgress + dt / DEFUSE_TIME);
  return {
    ...bomb,
    bombState: "defusing",
    defuseProgress,
  };
}

/**
 * Countdown after plant. Returns unchanged if not planted/defusing.
 */
export function tickBombTimer(bomb: BombMatchState, dt: number): BombMatchState {
  if (bomb.bombState !== "planted" && bomb.bombState !== "defusing") {
    return bomb;
  }
  const bombTimer = Math.max(0, bomb.bombTimer - dt);
  return { ...bomb, bombTimer };
}

/** Transition planting → planted at world pos; starts bomb timer. */
export function onPlantComplete(
  bomb: BombMatchState,
  x: number,
  z: number,
): BombMatchState {
  return {
    ...bomb,
    bombState: "planted",
    bombX: x,
    bombZ: z,
    plantProgress: 1,
    defuseProgress: 0,
    bombTimer: BOMB_TIMER,
    bombCarrierId: null,
  };
}

/** Transition defusing → defused (CT win reason). */
export function onDefuseComplete(bomb: BombMatchState): BombMatchState {
  return {
    ...bomb,
    bombState: "defused",
    defuseProgress: 1,
  };
}

/** Transition planted/defusing → exploded (TR win reason). */
export function explode(bomb: BombMatchState): BombMatchState {
  return {
    ...bomb,
    bombState: "exploded",
    bombTimer: 0,
  };
}

/** True when bomb is on the ground and fuse is running (planted | defusing). */
export function isBombPlantedActive(s: BombMatchState): boolean {
  return s.bombState === "planted" || s.bombState === "defusing";
}

/**
 * Whether live round-clock expiry may award a CT win.
 * False while planted/defusing — keep in sync with domains/match/bomb.ts.
 */
export function shouldLiveTimerAwardCtWin(bomb: BombMatchState): boolean {
  return !isBombPlantedActive(bomb);
}
