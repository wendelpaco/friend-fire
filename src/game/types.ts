export type { Team } from "@/shared/types/team";
export type { WeaponId, WeaponDef } from "@/domains/combat";
export type { Vec2 } from "@/domains/world";
export type { RoundPhase } from "@/domains/match";

import type { Team } from "@/shared/types/team";
import type { WeaponId } from "@/domains/combat";
import type { RoundPhase } from "@/domains/match";

export interface PlayerState {
  id: string;
  name: string;
  team: Team;
  isBot: boolean;
  x: number;
  z: number;
  rot: number;
  hp: number;
  armor: number;
  money: number;
  weaponSlot: number;
  weapons: Partial<Record<number, WeaponId>>;
  ammo: Partial<Record<WeaponId, { mag: number; reserve: number }>>;
  alive: boolean;
  kills: number;
  deaths: number;
  assists: number;
  lastShotAt: number;
  reloadingUntil: number;
  color: number;
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
  buyMessage: string | null;
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
