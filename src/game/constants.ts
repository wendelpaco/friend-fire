import type { WeaponDef, WeaponId } from "./types";

export const GAME_NAME = "Friend Fire";
export const GAME_TAGLINE = "TÁTICO // TOP-DOWN // MULTIPLAYER";

export const PLAYER_RADIUS = 0.45;
export const PLAYER_SPEED = 6.5;
export const BOT_SPEED = 4.2;
export const BULLET_RADIUS = 0.08;
export const CAMERA_HEIGHT = 22;
export const CAMERA_OFFSET = 16;
export const ROUND_TIME = 90;
export const WARMUP_TIME = 20;
export const START_MONEY = 800;
export const KILL_REWARD = 300;
export const ROUND_WIN_REWARD = 3250;
export const ROUND_LOSS_REWARD = 1400;

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  knife: {
    id: "knife",
    name: "FACA",
    slot: 4,
    damage: 55,
    fireRate: 450,
    magazine: 1,
    reserve: 0,
    spread: 0,
    speed: 0,
    range: 1.4,
    reloadTime: 0,
    isMelee: true,
  },
  glock: {
    id: "glock",
    name: "GLOCK-18",
    slot: 2,
    damage: 28,
    fireRate: 170,
    magazine: 20,
    reserve: 120,
    spread: 0.04,
    speed: 38,
    range: 45,
    reloadTime: 1800,
  },
  usp: {
    id: "usp",
    name: "USP-S",
    slot: 2,
    damage: 33,
    fireRate: 200,
    magazine: 12,
    reserve: 100,
    spread: 0.03,
    speed: 40,
    range: 48,
    reloadTime: 1900,
  },
  deagle: {
    id: "deagle",
    name: "DESERT EAGLE",
    slot: 2,
    damage: 63,
    fireRate: 420,
    magazine: 7,
    reserve: 35,
    spread: 0.05,
    speed: 42,
    range: 50,
    reloadTime: 2200,
  },
  ak47: {
    id: "ak47",
    name: "AK-47",
    slot: 1,
    damage: 36,
    fireRate: 100,
    magazine: 30,
    reserve: 90,
    spread: 0.035,
    speed: 48,
    range: 55,
    reloadTime: 2400,
  },
};

export const TEAM_COLORS = {
  TR: 0xc45c26,
  CT: 0x3a6ea5,
} as const;

export const BOT_NAMES = [
  "BOT Lucão",
  "BOT Pedrão",
  "BOT Enzo",
  "BOT Davi",
  "BOT Theo",
  "BOT Rafa",
] as const;

export const BOT_LINES = {
  enemySpotted: [
    "Inimigo avistado.",
    "Contato visual!",
    "Tem um CT aqui kkkk",
    "Vi o cara, bora!",
  ],
  kill: [
    "Belo tiro!",
    "GG easy",
    "Dormiu no ponto kkk",
    "2k sem morrer, tá fácil demais",
  ],
  underFire: [
    "Sob fogo! Preciso de ajuda!",
    "Tô tomando dano!",
    "Cover cover!",
  ],
  taunt: [
    "filho, cê tá de brincadeira kkkk",
    "bora pro B milk, tá fácil demais",
    "segura essa opressão kkkk",
    "só lixeira nesse time, vamos pra cima",
  ],
} as const;

export const CONTROLS_HELP = [
  { keys: "WASD", action: "Mover" },
  { keys: "Mouse", action: "Mirar" },
  { keys: "Clique", action: "Atirar" },
  { keys: "R", action: "Recarregar" },
  { keys: "1–4", action: "Trocar arma" },
  { keys: "Tab", action: "Placar" },
  { keys: "Esc", action: "Pausar / menu" },
  { keys: "H", action: "Ajuda" },
] as const;
