/**
 * Pure C4 plant / defuse / explode state machine (Wave 5 §2.1).
 * No Three.js — client/server call these with world inputs.
 */

export type BombState =
  | "carried"
  | "planting"
  | "planted"
  | "defusing"
  | "exploded"
  | "defused";

/** Seconds to hold F while planting. */
export const PLANT_TIME = 3.5;
/** Seconds to hold F while defusing (no kit). */
export const DEFUSE_TIME = 5;
/**
 * Defuse with kit would be 3.5s (B2). Catalog has **no** defuse kit item yet
 * (gap — do not invent a $400 kit without product sign-off). When kit ships,
 * pass this duration into `tickDefuse` instead of DEFUSE_TIME.
 */
export const DEFUSE_TIME_KIT = 3.5;
/** Seconds until explosion after plant. */
export const BOMB_TIMER = 40;

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
  x: number;
  z: number;
  /** Site radius from map / call (not a fixed domain constant). */
  radius: number;
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

export function isWithinRadius(
  x: number,
  z: number,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  return dist2(x, z, cx, cz) <= radius * radius;
}

export interface CanPlantInput {
  bomb: BombMatchState;
  playerId: string;
  team: "TR" | "CT";
  alive: boolean;
  x: number;
  z: number;
  /** Must be true (stationary) to plant. */
  stationary: boolean;
  /** Active bomb site under the player (caller picks nearest/overlapping). */
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
  /** Defuse reach radius from call (spec default 2.5). */
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
 * When progress reaches 1, state becomes `planting` with progress 1
 * (caller should invoke `onPlantComplete`).
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
 * When timer hits 0, returns state ready for `explode` (timer 0, still planted/defusing).
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
export function isBombPlantedActive(bomb: BombMatchState): boolean {
  return bomb.bombState === "planted" || bomb.bombState === "defusing";
}

/**
 * Whether live round-clock expiry may award a CT win.
 * False while planted/defusing — objective integrity (CS style).
 */
export function shouldLiveTimerAwardCtWin(bomb: BombMatchState): boolean {
  return !isBombPlantedActive(bomb);
}

export interface BombCarrierCandidate {
  id: string;
  /** Prefer non-bots when assigning / reassigning C4. */
  isBot?: boolean;
}

/**
 * Pick C4 carrier among living TR candidates.
 * Prefers humans; falls back to bots. Empty → "".
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
