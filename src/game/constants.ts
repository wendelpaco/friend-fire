export { WEAPONS } from "@/domains/combat";

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
