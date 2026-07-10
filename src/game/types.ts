export type { Team } from "@/shared/types/team";
export type { WeaponId, WeaponDef } from "@/domains/combat";
export type { Vec2 } from "@/domains/world";
export type { RoundPhase } from "@/domains/match";

import type { Team } from "@/shared/types/team";
import type { WeaponId } from "@/domains/combat";
import type { RoundPhase } from "@/domains/match";

/** C4 lifecycle (Wave 5 §2.1). */
export type BombState =
  | "carried"
  | "planting"
  | "planted"
  | "defusing"
  | "exploded"
  | "defused";

export interface PlayerState {
  id: string;
  name: string;
  team: Team;
  isBot: boolean;
  x: number;
  z: number;
  /** Vertical position (0 = floor). Jump/crouch motor. */
  y: number;
  /** Vertical velocity. */
  vy: number;
  /** Toggle crouch (Control edge). Desired posture state. */
  crouching: boolean;
  /** True when feet on floor (can jump). */
  onGround: boolean;
  rot: number;
  hp: number;
  armor: number;
  money: number;
  weaponSlot: number;
  weapons: Partial<Record<number, WeaponId>>;
  ammo: Partial<Record<WeaponId, { mag: number; reserve: number }>>;
  /** Owned HE grenades (shop `he`). Wave 5 §2.4. */
  heCount: number;
  alive: boolean;
  kills: number;
  deaths: number;
  assists: number;
  lastShotAt: number;
  reloadingUntil: number;
  /** Shots fired in current burst (accuracy bloom); reset after recovery. */
  shotsInBurst: number;
  /** Last horizontal speed m/s from motor (accuracy movement term). */
  moveSpeed: number;
  color: number;
  /**
   * Died during the last live round — next buy strips to knife + team pistol.
   * Survivors keep guns (CS economy).
   */
  diedThisRound: boolean;
  /** Operator roster id (session meta skins). Empty/undefined = team color only. */
  operatorId?: string;
  /** Skin id under operator catalog. */
  skinId?: string;
  /** Fatigues tint when skin applied (primary is reflected in `color` for UI). */
  secondaryColor?: number;
}

export interface BulletState {
  id: string;
  ownerId: string;
  team: Team;
  x: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
  rangeLeft: number;
  bornAt: number;
}

export interface KillFeedEntry {
  id: string;
  killer: string;
  victim: string;
  weapon: string;
  at: number;
}

export interface ChatEntry {
  id: string;
  from: string;
  text: string;
  kind: "radio" | "all" | "system";
  at: number;
}

export interface MatchState {
  phase: RoundPhase;
  round: number;
  timeLeft: number;
  scoreTR: number;
  scoreCT: number;
  /** Consecutive losses for loss-bonus economy (0–5). */
  lossStreakTR: number;
  lossStreakCT: number;
  players: PlayerState[];
  bullets: BulletState[];
  killFeed: KillFeedEntry[];
  chat: ChatEntry[];
  localPlayerId: string;
  paused: boolean;
  showScoreboard: boolean;
  showHelp: boolean;
  showBuyMenu: boolean;
  /** locked = follow player; free = WASD pans, mouse still aims for shoot */
  cameraMode: "locked" | "free";
  hitMarkerUntil: number;
  damageFlashUntil: number;
  lastDamageAmount: number;
  /** C4 FSM (Wave 5 §2.1). */
  bombState: BombState;
  bombCarrierId: string | null;
  bombX: number;
  bombZ: number;
  plantProgress: number;
  defuseProgress: number;
  /** Seconds remaining when planted / defusing. */
  bombTimer: number;
}

export interface ScoreboardRow {
  id: string;
  name: string;
  team: Team;
  kills: number;
  deaths: number;
  money: number;
  alive: boolean;
  isLocal: boolean;
  isBot: boolean;
}

/** Round-end banner reason → Portuguese toast copy (§2.2). */
export type RoundBannerKind =
  | "tr_win"
  | "ct_win"
  | "bomb_exploded"
  | "bomb_defused";

export function roundBannerText(kind: RoundBannerKind): string {
  switch (kind) {
    case "tr_win":
      return "TR VENCEU";
    case "ct_win":
      return "CT VENCEU";
    case "bomb_exploded":
      return "BOMBA EXPLODIU";
    case "bomb_defused":
      return "BOMBA DESARMADA";
  }
}

export interface HudSnapshot {
  hp: number;
  armor: number;
  money: number;
  mag: number;
  reserve: number;
  weaponName: string;
  weaponSlot: number;
  weapons: Array<{ slot: number; name: string; active: boolean }>;
  scoreTR: number;
  scoreCT: number;
  timeLeft: number;
  phase: RoundPhase;
  round: number;
  /** True when phase is match_over (end-match break UI). */
  matchOver: boolean;
  sessionId: string;
  killFeed: KillFeedEntry[];
  chat: ChatEntry[];
  alive: boolean;
  paused: boolean;
  showScoreboard: boolean;
  showHelp: boolean;
  showBuyMenu: boolean;
  canBuy: boolean;
  cameraMode: "locked" | "free";
  reloading: boolean;
  reloadProgress: number;
  lowAmmo: boolean;
  hitMarker: boolean;
  damageFlash: number;
  mapName: string;
  /** Playable map extent for minimap projection. */
  mapWidth: number;
  mapDepth: number;
  buyMessage: string | null;
  /** C4 state for HUD (§2.1). */
  bombState: BombState;
  /** Seconds until explode when planted/defusing; 0 otherwise. */
  bombTimer: number;
  /** 0–1 plant hold progress. */
  plantProgress: number;
  /** 0–1 defuse hold progress. */
  defuseProgress: number;
  /** e.g. "Segure F para plantar". */
  bombPrompt: string | null;
  /** Full-width round toast; null when hidden. */
  roundBanner: string | null;
  /** Dead in live round — spectator cam active. */
  spectating: boolean;
  /** Always-on smoothed FPS for the mini counter (≈2 Hz). */
  fps: number;
  /**
   * Full perf panel when Settings → overlay avançado is on; null otherwise.
   */
  perf: {
    fps: number;
    drawCalls: number;
    triangles: number;
    p50Ms: number;
    p95Ms: number;
    cpuMsP95: number;
    renderMsP95: number;
    autoEnabled: boolean;
    userTierMax: "low" | "medium" | "high";
    adaptReason: "degrade" | "upgrade" | "user" | "grace" | "init" | null;
    knobs: {
      maxPixelRatio: number;
      shadowsEnabled: boolean;
      shadowMapSize: number;
      fxBudget: number;
      dustCount: number;
    };
  } | null;
  minimap: Array<{
    id: string;
    x: number;
    z: number;
    team: Team;
    isLocal: boolean;
    alive: boolean;
  }>;
  scoreboard: ScoreboardRow[];
}
