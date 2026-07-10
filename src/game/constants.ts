export { WEAPONS } from "@/domains/combat";
export {
  DEFAULT_MATCH,
  KILL_REWARD,
  ROUND_WIN_REWARD,
  ROUND_LOSS_REWARD,
  MAX_MONEY,
  START_MONEY as MATCH_START_MONEY,
} from "@/domains/match";
import { DEFAULT_MATCH } from "@/domains/match";

export const GAME_NAME = "Friend Fire";
export const GAME_TAGLINE = "TÁTICO // TOP-DOWN // MULTIPLAYER";

/**
 * Debug HUD / advanced overlays (perf dump, verbose labels).
 * Compile-time gated: production builds tree-shake branches behind this flag.
 * Never enable via runtime localStorage alone in production.
 */
export const DEBUG_OVERLAYS = process.env.NODE_ENV !== "production";

export const PLAYER_RADIUS = 0.45;
export const PLAYER_SPEED = 6.5;
export const BOT_SPEED = 4.2;
export const BULLET_RADIUS = 0.08;
/** Slightly higher camera for larger 72×72 maps. */
export const CAMERA_HEIGHT = 28;
export const CAMERA_OFFSET = 20;
export const ROUND_TIME = DEFAULT_MATCH.round;
export const WARMUP_TIME = DEFAULT_MATCH.warmup;
export const START_MONEY = 800;

/**
 * QA: set NEXT_PUBLIC_DEBUG_ROUNDS_TO_WIN=1 (or any positive int) so match_over
 * is reachable without playing a full BO15-style series. Unset in production.
 */
function resolveRoundsToWin(): number {
  const raw = process.env.NEXT_PUBLIC_DEBUG_ROUNDS_TO_WIN;
  if (raw == null || raw === "") return DEFAULT_MATCH.roundsToWin;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  return DEFAULT_MATCH.roundsToWin;
}

export const ROUNDS_TO_WIN = resolveRoundsToWin();

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

/** CT defuse reach from planted bomb (Wave 5 §2.1). */
export const DEFUSE_RADIUS = 2.5;

export const CONTROLS_HELP = [
  { keys: "WASD", action: "Mover" },
  { keys: "Space", action: "Pular" },
  { keys: "Mouse", action: "Mirar" },
  { keys: "Clique", action: "Atirar" },
  { keys: "R", action: "Recarregar" },
  { keys: "F", action: "Plantar / desarmar C4" },
  { keys: "G", action: "Arremessar HE" },
  { keys: "B", action: "Loja (aquecimento / compra)" },
  { keys: "C", action: "Câmera travada / livre" },
  { keys: "1–4", action: "Trocar arma" },
  { keys: "Tab", action: "Placar" },
  { keys: "Esc", action: "Pausar / menu" },
  { keys: "H", action: "Ajuda" },
] as const;
