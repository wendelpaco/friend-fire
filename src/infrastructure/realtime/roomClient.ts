import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "@/domains/session";

export interface RoomClient {
  create(): Promise<{ code: string }>;
  join(code: string): Promise<void>;
  leave(): Promise<void>;
  onState(cb: (state: unknown) => void): () => void;
  sendInput(input: unknown): void;
}

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

/**
 * Client-side mock of multiplayer rooms. Codes come from the session domain;
 * state is kept in memory until a real Colyseus client replaces this.
 */
export class LocalRoomClient implements RoomClient {
  private code: string | null = null;
  private readonly listeners = new Set<(state: unknown) => void>();
  private lastInput: unknown = null;

  async create(): Promise<{ code: string }> {
    let code = generateRoomCode();
    // Extremely unlikely collision; retry a few times.
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
      // Mock: accept any valid code and open a local room entry.
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
    // Mock: no server; inputs are accepted and ignored.
  }

  getCode(): string | null {
    return this.code;
  }

  /** Exposed for tests / debug. */
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

/** Singleton used by lobby UI (create/join). */
let sharedClient: LocalRoomClient | null = null;

export function getLocalRoomClient(): LocalRoomClient {
  if (!sharedClient) {
    sharedClient = new LocalRoomClient();
  }
  return sharedClient;
}
