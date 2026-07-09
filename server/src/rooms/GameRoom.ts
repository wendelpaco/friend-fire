import { Room, Client } from "colyseus";
import {
  MatchState,
  PlayerState,
  type InputMessage,
} from "../schema/MatchState";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "../sim/codes";
import {
  createMatchPhase,
  tickPhase,
  type MatchPhaseState,
  type Team,
} from "../sim/phases";

/** Keep in sync with src/domains/session/types.ts */
const MATCH_SIZE = 6;

const TICK_MS = 50; // 20 Hz
const SPAWN = {
  TR: { x: -8, z: 0 },
  CT: { x: 8, z: 0 },
} as const;

export type GameRoomOptions = {
  code?: string;
  name?: string;
};

/**
 * Private match room: create/join by 6-char code, bot-fill to MATCH_SIZE.
 *
 * Limitations (v1 scaffold):
 * - Input is accepted but not applied to movement/combat
 * - Bots are static placeholders (no AI pathing/shooting)
 * - Phase timer advances; no round-win via kills / bomb plant
 */
export class GameRoom extends Room<MatchState> {
  maxClients = MATCH_SIZE;

  private phase: MatchPhaseState = createMatchPhase();
  private botSeq = 0;
  /** sessionId → last input (stub store) */
  private inputs = new Map<string, InputMessage>();

  async onCreate(options: GameRoomOptions = {}) {
    this.setState(new MatchState());

    const code = this.resolveCode(options.code);
    this.state.code = code;
    // filterBy(["code"]) queries top-level listing fields (not only metadata).
    // Set both so create-without-code still matchable after server generates code.
    (this.listing as { code?: string }).code = code;
    await this.setMetadata({ code });

    this.applyPhaseToState();
    this.syncBots();

    this.setSimulationInterval((deltaMs) => this.tick(deltaMs / 1000), TICK_MS);

    this.onMessage("input", (client, message: Partial<InputMessage>) => {
      this.inputs.set(client.sessionId, {
        dx: Number(message?.dx) || 0,
        dz: Number(message?.dz) || 0,
        aimX: Number(message?.aimX) || 0,
        aimZ: Number(message?.aimZ) || 0,
        fire: Boolean(message?.fire),
        reload: Boolean(message?.reload),
        slot: Number(message?.slot) || 0,
      });
      // Movement/combat intentionally stubbed for Task 10.
    });

    this.onMessage("ping", (client) => {
      client.send("pong", { t: Date.now() });
    });

    console.log(`[GameRoom] created code=${code} roomId=${this.roomId}`);
  }

  onAuth(_client: Client, options: GameRoomOptions) {
    if (options?.code) {
      const code = normalizeRoomCode(options.code);
      if (!isValidRoomCode(code) || code !== this.state.code) {
        throw new Error("Invalid room code");
      }
    }
    return true;
  }

  onJoin(client: Client, options: GameRoomOptions = {}) {
    const name =
      (typeof options.name === "string" && options.name.trim()) ||
      `Player ${this.clients.length}`;

    // Prefer replacing a bot slot so roster stays at MATCH_SIZE.
    const botKey = this.findBotKey();
    if (botKey) {
      this.state.players.delete(botKey);
    }

    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = name.slice(0, 24);
    player.team = this.nextTeam();
    player.isBot = false;
    player.hp = 100;
    player.armor = 0;
    player.alive = true;
    this.applySpawn(player);

    this.state.players.set(client.sessionId, player);
    this.syncBots();

    console.log(
      `[GameRoom] join ${client.sessionId} name=${player.name} team=${player.team} code=${this.state.code}`,
    );
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.syncBots();
    console.log(`[GameRoom] leave ${client.sessionId} code=${this.state.code}`);
  }

  onDispose() {
    console.log(`[GameRoom] dispose code=${this.state.code}`);
  }

  private tick(dt: number) {
    this.phase = tickPhase(this.phase, dt);
    this.applyPhaseToState();

    // Placeholder bot "activity": tiny idle drift so clients see entities update.
    this.state.players.forEach((p) => {
      if (p.isBot && this.phase.phase === "live" && p.alive) {
        p.rot += dt * 0.2;
      }
    });
  }

  private resolveCode(raw?: string): string {
    if (raw) {
      const n = normalizeRoomCode(raw);
      if (isValidRoomCode(n)) return n;
    }
    return generateRoomCode();
  }

  private applyPhaseToState() {
    this.state.phase = this.phase.phase;
    this.state.round = this.phase.round;
    this.state.scoreTR = this.phase.scoreTR;
    this.state.scoreCT = this.phase.scoreCT;
    this.state.timeLeft = Math.max(0, this.phase.timeLeft);
  }

  /** Pad / trim bots so total players == MATCH_SIZE. */
  private syncBots() {
    let humans = 0;
    let bots = 0;
    this.state.players.forEach((p) => {
      if (p.isBot) bots += 1;
      else humans += 1;
    });

    const targetBots = Math.max(0, MATCH_SIZE - humans);

    while (bots < targetBots) {
      this.botSeq += 1;
      const id = `bot_${this.botSeq}`;
      const p = new PlayerState();
      p.id = id;
      p.name = `BOT ${this.botSeq}`;
      p.team = this.nextTeam();
      p.isBot = true;
      p.hp = 100;
      p.armor = 0;
      p.alive = true;
      this.applySpawn(p);
      this.state.players.set(id, p);
      bots += 1;
    }

    if (bots > targetBots) {
      const toRemove: string[] = [];
      this.state.players.forEach((p, key) => {
        if (p.isBot) toRemove.push(key);
      });
      // Remove newest bots first
      toRemove.reverse();
      for (let i = 0; i < bots - targetBots; i++) {
        const key = toRemove[i];
        if (key) this.state.players.delete(key);
      }
    }
  }

  private findBotKey(): string | undefined {
    let found: string | undefined;
    this.state.players.forEach((p, key) => {
      if (!found && p.isBot) found = key;
    });
    return found;
  }

  private nextTeam(): Team {
    let tr = 0;
    let ct = 0;
    this.state.players.forEach((p) => {
      if (p.team === "TR") tr += 1;
      else ct += 1;
    });
    return tr <= ct ? "TR" : "CT";
  }

  private applySpawn(p: PlayerState) {
    const team = (p.team === "CT" ? "CT" : "TR") as Team;
    const s = SPAWN[team];
    // Slight offset so entities do not stack
    const n = this.state.players.size;
    p.x = s.x + (n % 3) * 1.5;
    p.z = s.z + Math.floor(n / 3) * 1.5;
    p.rot = team === "TR" ? 0 : Math.PI;
  }
}
