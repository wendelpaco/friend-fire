import { Client, type Room } from "colyseus.js";
import { getNickname } from "@/domains/identity";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "@/domains/session";

/** WebSocket URL for the Colyseus game server (Task 10). */
export const COLYSEUS_URL =
  process.env.NEXT_PUBLIC_COLYSEUS_URL || "ws://localhost:2567";

export const GAME_ROOM_NAME = "game";

export interface RoomClient {
  create(): Promise<{ code: string }>;
  join(code: string): Promise<void>;
  leave(): Promise<void>;
  onState(cb: (state: unknown) => void): () => void;
  sendInput(input: unknown): void;
}

/** Snapshot exposed to UI / GameCanvas. */
export type NetworkRoomState = {
  code: string | null;
  players: NetworkPlayer[];
  mode: "idle" | "connecting" | "in_room" | "error";
  sessionId: string | null;
  connected: boolean;
  phase: string | null;
  error: string | null;
  /** True when local combat is still client-side (server does not sim yet). */
  hybridLocalCombat: boolean;
};

export type NetworkPlayer = {
  id: string;
  name: string;
  team: string;
  isBot: boolean;
  alive: boolean;
  x: number;
  z: number;
  rot: number;
  hp: number;
};

export type InputPayload = {
  dx: number;
  dz: number;
  aimX: number;
  aimZ: number;
  fire: boolean;
  reload: boolean;
  slot: number;
};

interface LocalRoomRecord {
  code: string;
  players: string[];
}

/** In-memory rooms for the local mock client (shared across instances). */
const localRooms = new Map<string, LocalRoomRecord>();

export type LocalRoomState = {
  code: string | null;
  players: string[];
  mode: "idle" | "in_room";
};

function friendlyConnectError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "unknown");
  const lower = raw.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("load failed") ||
    lower.includes("econnrefused") ||
    lower.includes("websocket") ||
    lower.includes("connection")
  ) {
    return (
      "Servidor multiplayer indisponível. Rode `npm run dev:server` " +
      `(${COLYSEUS_URL}) e tente de novo.`
    );
  }
  if (lower.includes("not found") || lower.includes("no rooms")) {
    return "Sala não encontrada. Peça ao host para entrar na partida primeiro.";
  }
  if (lower.includes("invalid room code") || lower.includes("code")) {
    return "Código inválido ou sala cheia.";
  }
  return raw || "Falha ao conectar na sala.";
}

function makeClient(): Client {
  return new Client(COLYSEUS_URL);
}

function readCode(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const code = (state as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : null;
}

function playersFromState(state: unknown): NetworkPlayer[] {
  if (!state || typeof state !== "object") return [];
  const playersMap = (state as { players?: Map<string, unknown> | Record<string, unknown> })
    .players;
  if (!playersMap) return [];

  const out: NetworkPlayer[] = [];
  const visit = (p: unknown, key: string) => {
    if (!p || typeof p !== "object") return;
    const o = p as Record<string, unknown>;
    out.push({
      id: String(o.id ?? key),
      name: String(o.name ?? "Player"),
      team: String(o.team ?? "TR"),
      isBot: Boolean(o.isBot),
      alive: o.alive !== false,
      x: Number(o.x) || 0,
      z: Number(o.z) || 0,
      rot: Number(o.rot) || 0,
      hp: Number(o.hp) || 0,
    });
  };

  if (typeof (playersMap as Map<string, unknown>).forEach === "function") {
    (playersMap as Map<string, unknown>).forEach((p, key) => visit(p, key));
  } else {
    for (const [key, p] of Object.entries(playersMap as Record<string, unknown>)) {
      visit(p, key);
    }
  }
  return out;
}

function phaseFromState(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const phase = (state as { phase?: unknown }).phase;
  return typeof phase === "string" ? phase : null;
}

async function waitForCode(room: Room, timeoutMs = 4000): Promise<string> {
  const immediate = readCode(room.state);
  if (immediate) return immediate;

  return new Promise((resolve, reject) => {
    const onChange = (state: unknown) => {
      const code = readCode(state);
      if (!code) return;
      clearTimeout(timer);
      room.onStateChange.remove(onChange);
      resolve(code);
    };

    const timer = setTimeout(() => {
      room.onStateChange.remove(onChange);
      reject(new Error("Timeout waiting for room code from server"));
    }, timeoutMs);

    room.onStateChange(onChange);
  });
}

/**
 * Client-side mock of multiplayer rooms. Codes come from the session domain;
 * state is kept in memory. Kept for tests / offline fallback.
 */
export class LocalRoomClient implements RoomClient {
  private code: string | null = null;
  private readonly listeners = new Set<(state: unknown) => void>();
  private lastInput: unknown = null;

  async create(): Promise<{ code: string }> {
    let code = generateRoomCode();
    for (let i = 0; i < 8 && localRooms.has(code); i++) {
      code = generateRoomCode();
    }
    localRooms.set(code, { code, players: ["local"] });
    this.code = code;
    this.emit();
    return { code };
  }

  async join(code: string): Promise<void> {
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      throw new Error("Código inválido. Use 6 caracteres (A–Z, 2–9).");
    }
    let room = localRooms.get(normalized);
    if (!room) {
      room = { code: normalized, players: [] };
      localRooms.set(normalized, room);
    }
    if (!room.players.includes("local")) {
      room.players.push("local");
    }
    this.code = normalized;
    this.emit();
  }

  async leave(): Promise<void> {
    if (this.code) {
      const room = localRooms.get(this.code);
      if (room) {
        room.players = room.players.filter((p) => p !== "local");
        if (room.players.length === 0) {
          localRooms.delete(this.code);
        }
      }
    }
    this.code = null;
    this.emit();
  }

  onState(cb: (state: unknown) => void): () => void {
    this.listeners.add(cb);
    cb(this.snapshot());
    return () => {
      this.listeners.delete(cb);
    };
  }

  sendInput(input: unknown): void {
    this.lastInput = input;
  }

  getCode(): string | null {
    return this.code;
  }

  getLastInput(): unknown {
    return this.lastInput;
  }

  private snapshot(): LocalRoomState {
    if (!this.code) {
      return { code: null, players: [], mode: "idle" };
    }
    const room = localRooms.get(this.code);
    return {
      code: this.code,
      players: room?.players.slice() ?? ["local"],
      mode: "in_room",
    };
  }

  private emit(): void {
    const state = this.snapshot();
    for (const cb of this.listeners) {
      cb(state);
    }
  }
}

/**
 * Real Colyseus client for private `game` rooms.
 *
 * Hybrid mode (v1): networking is for presence/code/roster + input relay.
 * Combat/bots still run locally in GameClient until the server simulates them.
 */
export class ColyseusRoomClient implements RoomClient {
  private room: Room | null = null;
  private code: string | null = null;
  private sessionId: string | null = null;
  private mode: NetworkRoomState["mode"] = "idle";
  private error: string | null = null;
  private readonly listeners = new Set<(state: unknown) => void>();
  private unbindRoom: (() => void) | null = null;

  async create(): Promise<{ code: string }> {
    this.mode = "connecting";
    this.error = null;
    this.emit();
    try {
      const client = makeClient();
      const room = await client.create(GAME_ROOM_NAME, {
        name: getNickname(),
      });
      const code = await waitForCode(room);
      // Lobby only needs the code; leave so we do not hold a seat until /play.
      // Play page re-enters via joinOrCreate with the same code.
      await room.leave(true);
      this.room = null;
      this.code = code;
      this.sessionId = null;
      this.mode = "idle";
      this.emit();
      return { code };
    } catch (e) {
      this.mode = "error";
      this.error = friendlyConnectError(e);
      this.emit();
      throw new Error(this.error);
    }
  }

  async join(code: string): Promise<void> {
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      throw new Error("Código inválido. Use 6 caracteres (A–Z, 2–9).");
    }
    this.mode = "connecting";
    this.error = null;
    this.emit();
    try {
      // Lobby validation: prove the room exists, then release the seat.
      // GameCanvas reconnects with joinOrCreate for the full session.
      const client = makeClient();
      const room = await client.join(GAME_ROOM_NAME, {
        code: normalized,
        name: getNickname(),
      });
      const serverCode = (await waitForCode(room).catch(() => normalized)) || normalized;
      await room.leave(true);
      this.room = null;
      this.code = serverCode;
      this.sessionId = null;
      this.mode = "idle";
      this.emit();
    } catch (e) {
      this.mode = "error";
      this.error = friendlyConnectError(e);
      this.emit();
      throw new Error(this.error);
    }
  }

  /**
   * Keep a live session for the play page (create-or-join by code).
   * Prefer this over create/join for in-match networking.
   */
  async connect(code: string): Promise<void> {
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      throw new Error("Código inválido. Use 6 caracteres (A–Z, 2–9).");
    }
    await this.leave();
    this.mode = "connecting";
    this.error = null;
    this.code = normalized;
    this.emit();
    try {
      const client = makeClient();
      const room = await client.joinOrCreate(GAME_ROOM_NAME, {
        code: normalized,
        name: getNickname(),
      });
      this.bindRoom(room);
      const serverCode = await waitForCode(room).catch(() => normalized);
      this.code = serverCode || normalized;
      this.mode = "in_room";
      this.error = null;
      this.emit();
    } catch (e) {
      this.mode = "error";
      this.error = friendlyConnectError(e);
      this.emit();
      throw new Error(this.error);
    }
  }

  async leave(): Promise<void> {
    this.unbindRoom?.();
    this.unbindRoom = null;
    if (this.room) {
      try {
        await this.room.leave(true);
      } catch {
        /* ignore close races */
      }
    }
    this.room = null;
    this.sessionId = null;
    this.mode = "idle";
    this.emit();
  }

  onState(cb: (state: unknown) => void): () => void {
    this.listeners.add(cb);
    cb(this.snapshot());
    return () => {
      this.listeners.delete(cb);
    };
  }

  sendInput(input: unknown): void {
    if (!this.room) return;
    try {
      this.room.send("input", input as InputPayload);
    } catch {
      /* drop if socket mid-close */
    }
  }

  getCode(): string | null {
    return this.code;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  isConnected(): boolean {
    return this.mode === "in_room" && this.room !== null;
  }

  getError(): string | null {
    return this.error;
  }

  snapshot(): NetworkRoomState {
    const state = this.room?.state;
    return {
      code: this.code ?? readCode(state),
      players: playersFromState(state),
      mode: this.mode,
      sessionId: this.sessionId,
      connected: this.isConnected(),
      phase: phaseFromState(state),
      error: this.error,
      hybridLocalCombat: true,
    };
  }

  private bindRoom(room: Room) {
    this.unbindRoom?.();
    this.room = room;
    this.sessionId = room.sessionId;

    const onChange = () => this.emit();
    room.onStateChange(onChange);
    room.onError((code, message) => {
      this.mode = "error";
      this.error = message || `Room error ${code}`;
      this.emit();
    });
    room.onLeave(() => {
      this.room = null;
      this.sessionId = null;
      if (this.mode === "in_room") {
        this.mode = "idle";
      }
      this.emit();
    });

    this.unbindRoom = () => {
      // colyseus.js signals are not always removable; null room is enough
      this.room = null;
    };
  }

  private emit(): void {
    const state = this.snapshot();
    for (const cb of this.listeners) {
      cb(state);
    }
  }
}

/** Singleton used by lobby UI (create/join). */
let sharedColyseus: ColyseusRoomClient | null = null;
let sharedLocal: LocalRoomClient | null = null;

export function getColyseusRoomClient(): ColyseusRoomClient {
  if (!sharedColyseus) {
    sharedColyseus = new ColyseusRoomClient();
  }
  return sharedColyseus;
}

export function getLocalRoomClient(): LocalRoomClient {
  if (!sharedLocal) {
    sharedLocal = new LocalRoomClient();
  }
  return sharedLocal;
}

/** Prefer Colyseus for room mode; LocalRoomClient remains for tests. */
export function getRoomClient(): ColyseusRoomClient {
  return getColyseusRoomClient();
}
