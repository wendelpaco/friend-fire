import { Client, type Room } from "colyseus.js";
import { getNickname, getRegion, type RegionCode } from "@/domains/identity";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "@/domains/session";
import { saveLastRoom } from "@/infrastructure/realtime/lastRoom";

export {
  clearLastRoom,
  getLastRoom,
  saveLastRoom,
  LAST_ROOM_CODE_KEY,
  LAST_ROOM_MAP_KEY,
  type LastRoom,
} from "@/infrastructure/realtime/lastRoom";

const DEFAULT_COLYSEUS_PORT = 2567;

/**
 * Resolve Colyseus WS URL at call time (not module load).
 * - NEXT_PUBLIC_COLYSEUS_URL wins when set
 * - Browser: same hostname as the page (so http://192.168.x.x:3000 works on LAN)
 * - SSR / Node: 127.0.0.1
 */
export function getColyseusUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_COLYSEUS_URL?.trim();
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname;
    const protocol =
      window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${host}:${DEFAULT_COLYSEUS_PORT}`;
  }
  return `ws://127.0.0.1:${DEFAULT_COLYSEUS_PORT}`;
}

/** @deprecated Prefer getColyseusUrl() — kept for callers that need a string snapshot. */
export const COLYSEUS_URL = getColyseusUrl();

/** HTTP base derived from current Colyseus URL (ws:// → http://). */
export function getHttpUrl(): string {
  return getColyseusUrl().replace(/^ws/i, "http");
}

/** @deprecated Prefer getHttpUrl() */
export const HTTP_URL = typeof window === "undefined"
  ? `http://127.0.0.1:${DEFAULT_COLYSEUS_PORT}`
  : getHttpUrl();

export const GAME_ROOM_NAME = "game";

export type RoomVisibility = "public" | "private";

export type RoomRegion = RegionCode;

export type CreateRoomOptions = {
  mapId?: string;
  roomName?: string;
  /** Browser listing visibility; server default is typically public. */
  visibility?: RoomVisibility;
  /** BR | US — defaults to identity getRegion() on create. */
  region?: RoomRegion;
};

/** Query params for GET /rooms (server browser filters). */
export type ListRoomsOptions = {
  mapId?: string;
  hasSlots?: boolean;
  visibility?: RoomVisibility;
  /** Filter rooms by region (GET /rooms?region=BR). */
  region?: RoomRegion;
};

export type QuickMatchOptions = {
  mapId?: string;
  /** Prefer rooms in this region; defaults to getRegion(). */
  region?: RoomRegion;
};

export type QuickMatchResult = {
  code: string;
  /** True when no public room had a slot and a new room was created. */
  host: boolean;
};

/** Open room row from GET /rooms (server browser). */
export type RoomListItem = {
  roomId: string;
  code: string;
  mapId: string;
  mapName: string;
  roomName: string;
  clients: number;
  maxClients: number;
  phase?: string;
  visibility?: RoomVisibility;
  region?: RoomRegion;
};

/** HE grenade FX broadcast from GameRoom (cosmetic). */
export type HeFxEvent =
  | { type: "throw"; id: string; ownerId: string; x: number; z: number; fuse: number }
  | { type: "explode"; id: string; x: number; z: number };

/** Gunshot cosmetic: muzzle + optional wall impact (multiplayer). */
export type ShotFxEvent = {
  ownerId: string;
  x: number;
  z: number;
  rot: number;
  impact: {
    x: number;
    y: number;
    z: number;
    nx: number;
    ny: number;
    nz: number;
    surface: "wall" | "ground" | "prop";
  } | null;
};

export interface RoomClient {
  create(opts?: CreateRoomOptions): Promise<{ code: string }>;
  join(code: string): Promise<void>;
  leave(): Promise<void>;
  onState(cb: (state: unknown) => void): () => void;
  sendInput(input: unknown): void;
  listRooms(opts?: ListRoomsOptions): Promise<RoomListItem[]>;
  quickMatch(opts?: QuickMatchOptions): Promise<QuickMatchResult>;
}

/** Snapshot exposed to UI / GameCanvas. */
export type NetworkRoomState = {
  code: string | null;
  players: NetworkPlayer[];
  mode: "idle" | "connecting" | "in_room" | "error";
  sessionId: string | null;
  connected: boolean;
  phase: string | null;
  mapId: string | null;
  mapName: string | null;
  round: number;
  scoreTR: number;
  scoreCT: number;
  timeLeft: number;
  error: string | null;
  /**
   * True only when server is not authoritative (legacy/offline).
   * When false, combat runs on the Colyseus GameRoom.
   */
  hybridLocalCombat: boolean;
  /** C4 FSM from MatchState (Wave 5). Empty when inactive. */
  bombState: string;
  bombX: number;
  bombZ: number;
  bombTimer: number;
  bombCarrierId: string;
  plantProgress: number;
  defuseProgress: number;
  /** elimination | time | bomb_exploded | bomb_defused | "" */
  roundEndReason: string;
};

export type NetworkPlayer = {
  id: string;
  name: string;
  team: string;
  isBot: boolean;
  alive: boolean;
  x: number;
  z: number;
  y: number;
  vy: number;
  crouching: boolean;
  onGround: boolean;
  rot: number;
  hp: number;
  armor: number;
  kills: number;
  deaths: number;
  /** Economy / loadout (server-authoritative shop) */
  money: number;
  primaryId: string;
  secondaryId: string;
  /** Active slot: 1 primary | 2 secondary | 4 knife */
  activeSlot: number;
  mag: number;
  reserve: number;
  /** HE grenades carried (0–2) */
  heCount: number;
};

export type InputPayload = {
  dx: number;
  dz: number;
  aimX: number;
  aimZ: number;
  fire: boolean;
  reload: boolean;
  slot: number;
  /** Hold F — plant (TR) or defuse (CT). */
  plant: boolean;
  /** Hold/edge G — throw HE (server rising-edge). */
  he: boolean;
  /** Edge: Space jump. */
  jump: boolean;
  /** Hold bit: Control down (server rising-edge → toggle crouch). */
  crouch: boolean;
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
  // Browser fetch/XHR network failures often surface as ProgressEvent
  // (`Error: [object ProgressEvent]`), not a useful message string.
  const isProgressEvent =
    typeof ProgressEvent !== "undefined" && err instanceof ProgressEvent;
  const raw = isProgressEvent
    ? "network progress event"
    : err instanceof Error
      ? err.message
      : String(err ?? "unknown");
  const lower = raw.toLowerCase();
  if (
    isProgressEvent ||
    lower.includes("[object progressevent]") ||
    lower.includes("progressevent") ||
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("load failed") ||
    lower.includes("econnrefused") ||
    lower.includes("websocket") ||
    lower.includes("connection") ||
    lower.includes("fetch")
  ) {
    return (
      "Servidor multiplayer indisponível. Em outro terminal rode " +
      `\`bun run dev:server\` (${getColyseusUrl()}) e recarregue a página.`
    );
  }
  if (
    lower.includes("not found") ||
    lower.includes("no rooms") ||
    lower.includes("room not found") ||
    lower.includes("não existe")
  ) {
    return "Sala não existe";
  }
  if (lower.includes("invalid room code")) {
    return "Código inválido ou sala cheia.";
  }
  return raw || "Falha ao conectar na sala.";
}

function makeClient(): Client {
  return new Client(getColyseusUrl());
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
      y: Number(o.y) || 0,
      vy: Number(o.vy) || 0,
      crouching: Boolean(o.crouching),
      onGround: o.onGround !== false,
      rot: Number(o.rot) || 0,
      hp: Number(o.hp) || 0,
      armor: Number(o.armor) || 0,
      kills: Number(o.kills) || 0,
      deaths: Number(o.deaths) || 0,
      money: Number(o.money) || 0,
      primaryId: typeof o.primaryId === "string" ? o.primaryId : "",
      secondaryId: typeof o.secondaryId === "string" ? o.secondaryId : "",
      activeSlot: Number(o.activeSlot) || 2,
      mag: Number(o.mag) || 0,
      reserve: Number(o.reserve) || 0,
      heCount: Number(o.heCount) || 0,
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

function stringFieldFromState(
  state: unknown,
  key: "mapId" | "mapName",
): string | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeVisibility(raw: unknown): RoomVisibility | undefined {
  if (raw === "public" || raw === "private") return raw;
  return undefined;
}

function normalizeRegion(raw: unknown): RoomRegion | undefined {
  if (raw === "BR" || raw === "US") return raw;
  return undefined;
}

function normalizeRoomListItem(raw: unknown): RoomListItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const roomId = String(o.roomId ?? o.room_id ?? "");
  const code = String(o.code ?? "");
  if (!roomId && !code) return null;
  return {
    roomId: roomId || code,
    code,
    mapId: String(o.mapId ?? o.map_id ?? ""),
    mapName: String(o.mapName ?? o.map_name ?? ""),
    roomName: String(o.roomName ?? o.room_name ?? o.roomLabel ?? ""),
    clients: Number(o.clients ?? o.players ?? 0) || 0,
    maxClients: Number(o.maxClients ?? o.maxPlayers ?? 0) || 0,
    phase: typeof o.phase === "string" ? o.phase : undefined,
    visibility: normalizeVisibility(o.visibility),
    region: normalizeRegion(o.region),
  };
}

/** Build `?mapId=&hasSlots=1&visibility=&region=` for GET /rooms. */
export function buildRoomsQuery(opts?: ListRoomsOptions): string {
  const params = new URLSearchParams();
  if (opts?.mapId) params.set("mapId", opts.mapId);
  if (opts?.hasSlots) params.set("hasSlots", "1");
  if (opts?.visibility) params.set("visibility", opts.visibility);
  if (opts?.region) params.set("region", opts.region);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Resolve region for create/quickMatch (explicit opts or identity default). */
function resolveRegion(region?: RoomRegion): RoomRegion {
  return region ?? getRegion();
}

/**
 * Pick fullest public room (prefer mapId match). Used by quickMatch.
 * Returns null when the list is empty.
 */
export function pickQuickMatchRoom(
  rooms: RoomListItem[],
  mapId?: string,
): RoomListItem | null {
  if (rooms.length === 0) return null;
  const byMap =
    mapId && mapId.length > 0
      ? rooms.filter((r) => r.mapId === mapId)
      : [];
  const pool = byMap.length > 0 ? byMap : rooms;
  let best = pool[0]!;
  for (let i = 1; i < pool.length; i++) {
    const r = pool[i]!;
    if (r.clients > best.clients) best = r;
  }
  return best;
}

/** Fetch open game rooms from the Colyseus HTTP API. */
export async function fetchRoomList(
  opts?: ListRoomsOptions,
): Promise<RoomListItem[]> {
  const res = await fetch(`${getHttpUrl()}/rooms${buildRoomsQuery(opts)}`);
  if (!res.ok) {
    throw new Error(`Failed to list rooms (${res.status})`);
  }
  const data: unknown = await res.json();
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as { rooms?: unknown })?.rooms)
      ? ((data as { rooms: unknown[] }).rooms)
      : [];
  return rows
    .map(normalizeRoomListItem)
    .filter((item): item is RoomListItem => item !== null);
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

  async create(opts?: CreateRoomOptions): Promise<{ code: string }> {
    let code = generateRoomCode();
    for (let i = 0; i < 8 && localRooms.has(code); i++) {
      code = generateRoomCode();
    }
    localRooms.set(code, { code, players: ["local"] });
    this.code = code;
    saveLastRoom({ code, mapId: opts?.mapId ?? "" });
    this.emit();
    return { code };
  }

  async listRooms(_opts?: ListRoomsOptions): Promise<RoomListItem[]> {
    return [];
  }

  async quickMatch(opts?: QuickMatchOptions): Promise<QuickMatchResult> {
    const region = resolveRegion(opts?.region);
    const rooms = await this.listRooms({
      hasSlots: true,
      visibility: "public",
      region,
    });
    const best = pickQuickMatchRoom(rooms, opts?.mapId);
    if (best?.code) {
      await this.join(best.code);
      return { code: best.code, host: false };
    }
    const { code } = await this.create({
      mapId: opts?.mapId,
      visibility: "public",
      region,
    });
    return { code, host: true };
  }

  async join(code: string): Promise<void> {
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      throw new Error("Código inválido. Use 6 caracteres (A–Z, 2–9).");
    }
    const room = localRooms.get(normalized);
    if (!room) {
      throw new Error("Sala não existe");
    }
    if (!room.players.includes("local")) {
      room.players.push("local");
    }
    this.code = normalized;
    saveLastRoom({ code: normalized, mapId: "" });
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
 * Colyseus client for private `game` rooms.
 * When server `authoritative` is true, combat is server-driven.
 */
export class ColyseusRoomClient implements RoomClient {
  private room: Room | null = null;
  private code: string | null = null;
  private sessionId: string | null = null;
  private mode: NetworkRoomState["mode"] = "idle";
  private error: string | null = null;
  private readonly listeners = new Set<(state: unknown) => void>();
  private readonly heFxListeners = new Set<(event: HeFxEvent) => void>();
  private readonly shotFxListeners = new Set<(event: ShotFxEvent) => void>();
  private unbindRoom: (() => void) | null = null;
  /** Serialize create/join/connect so Strict Mode / double-click can't race. */
  private connectChain: Promise<void> = Promise.resolve();

  private enqueueConnect<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.connectChain.then(fn, fn);
    this.connectChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async create(opts?: CreateRoomOptions): Promise<{ code: string }> {
    return this.enqueueConnect(async () => {
      this.mode = "connecting";
      this.error = null;
      this.emit();
      try {
        await this.leave();
        const client = makeClient();
        const region = resolveRegion(opts?.region);
        // Host creates a real room and keeps the seat so the code stays joinable
        // until the host opens /play (or leaves). Guests use join-only.
        const room = await client.create(GAME_ROOM_NAME, {
          name: getNickname(),
          mapId: opts?.mapId,
          roomName: opts?.roomName,
          visibility: opts?.visibility,
          region,
        });
        this.bindRoom(room);
        const code = await waitForCode(room);
        this.code = code;
        this.mode = "in_room";
        this.error = null;
        const mapId =
          opts?.mapId ?? stringFieldFromState(room.state, "mapId") ?? "";
        saveLastRoom({ code, mapId });
        this.emit();
        return { code };
      } catch (e) {
        this.mode = "error";
        this.error = friendlyConnectError(e);
        this.emit();
        throw new Error(this.error);
      }
    });
  }

  async listRooms(opts?: ListRoomsOptions): Promise<RoomListItem[]> {
    return fetchRoomList(opts);
  }

  /**
   * Join fullest public room with slots (prefer mapId), else create public.
   * Returns host=true when a new room was created.
   */
  async quickMatch(opts?: QuickMatchOptions): Promise<QuickMatchResult> {
    const region = resolveRegion(opts?.region);
    try {
      const rooms = await this.listRooms({
        hasSlots: true,
        visibility: "public",
        region,
      });
      const best = pickQuickMatchRoom(rooms, opts?.mapId);
      if (best?.code) {
        await this.join(best.code);
        return { code: best.code, host: false };
      }
      const { code } = await this.create({
        mapId: opts?.mapId,
        visibility: "public",
        region,
      });
      return { code, host: true };
    } catch (e) {
      // create/join already set mode/error; rethrow normalized message if not.
      if (this.error) throw new Error(this.error);
      const msg = friendlyConnectError(e);
      this.mode = "error";
      this.error = msg;
      this.emit();
      throw new Error(msg);
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
      // Join-only: never create. Missing/typo codes must fail.
      await this.leave();
      const client = makeClient();
      const room = await client.join(GAME_ROOM_NAME, {
        code: normalized,
        name: getNickname(),
      });
      this.bindRoom(room);
      const serverCode =
        (await waitForCode(room).catch(() => normalized)) || normalized;
      this.code = serverCode;
      this.mode = "in_room";
      this.error = null;
      const mapId = stringFieldFromState(room.state, "mapId") ?? "";
      saveLastRoom({ code: serverCode, mapId });
      this.emit();
    } catch (e) {
      this.mode = "error";
      this.error = friendlyConnectError(e);
      this.emit();
      throw new Error(this.error);
    }
  }

  /**
   * Live session for the play page.
   * Host may create-or-join; guests must join an existing room only.
   * Host path can pass mapId/roomName when creating a new room.
   */
  async connect(
    code: string,
    options: { host?: boolean } & CreateRoomOptions = {},
  ): Promise<void> {
    return this.enqueueConnect(async () => {
      const normalized = normalizeRoomCode(code);
      if (!isValidRoomCode(normalized)) {
        throw new Error("Código inválido. Use 6 caracteres (A–Z, 2–9).");
      }

      // Reuse lobby create/join seat when already in this room.
      if (
        this.isConnected() &&
        this.code &&
        normalizeRoomCode(this.code) === normalized
      ) {
        const mapId =
          options.mapId ??
          stringFieldFromState(this.room?.state, "mapId") ??
          "";
        saveLastRoom({ code: this.code, mapId });
        this.emit();
        return;
      }

      if (options.host) {
        await this.leave();
        this.mode = "connecting";
        this.error = null;
        this.code = normalized;
        this.emit();
        try {
          const client = makeClient();
          const region = resolveRegion(options.region);
          const room = await client.joinOrCreate(GAME_ROOM_NAME, {
            code: normalized,
            name: getNickname(),
            mapId: options.mapId,
            roomName: options.roomName,
            visibility: options.visibility,
            region,
          });
          this.bindRoom(room);
          const serverCode = await waitForCode(room).catch(() => normalized);
          this.code = serverCode || normalized;
          this.mode = "in_room";
          this.error = null;
          const mapId =
            options.mapId ?? stringFieldFromState(room.state, "mapId") ?? "";
          saveLastRoom({ code: this.code, mapId });
          this.emit();
        } catch (e) {
          this.mode = "error";
          this.error = friendlyConnectError(e);
          this.emit();
          throw new Error(this.error);
        }
        return;
      }

      // Guest: join-only (no ghost rooms on typos).
      await this.join(normalized);
    });
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

  /** Authoritative shop purchase (server validates phase/money/catalog). */
  sendBuy(itemId: string): void {
    if (!this.room || !itemId) return;
    try {
      this.room.send("buy", { itemId });
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
    const state = this.room?.state as Record<string, unknown> | undefined;
    const authoritative =
      state && typeof state === "object"
        ? state.authoritative !== false
        : true;
    return {
      code: this.code ?? readCode(state),
      players: playersFromState(state),
      mode: this.mode,
      sessionId: this.sessionId,
      connected: this.isConnected(),
      phase: phaseFromState(state),
      mapId: stringFieldFromState(state, "mapId"),
      mapName: stringFieldFromState(state, "mapName"),
      round: Number(state?.round) || 0,
      scoreTR: Number(state?.scoreTR) || 0,
      scoreCT: Number(state?.scoreCT) || 0,
      timeLeft: Number(state?.timeLeft) || 0,
      error: this.error,
      // Server combat authority: not hybrid when connected + authoritative
      hybridLocalCombat: !(this.isConnected() && authoritative),
      bombState: typeof state?.bombState === "string" ? state.bombState : "",
      bombX: Number(state?.bombX) || 0,
      bombZ: Number(state?.bombZ) || 0,
      bombTimer: Number(state?.bombTimer) || 0,
      bombCarrierId:
        typeof state?.bombCarrierId === "string" ? state.bombCarrierId : "",
      plantProgress: Number(state?.plantProgress) || 0,
      defuseProgress: Number(state?.defuseProgress) || 0,
      roundEndReason:
        typeof state?.roundEndReason === "string" ? state.roundEndReason : "",
    };
  }

  /** Cosmetic HE FX from server broadcasts. */
  onHeFx(cb: (event: HeFxEvent) => void): () => void {
    this.heFxListeners.add(cb);
    return () => {
      this.heFxListeners.delete(cb);
    };
  }

  /** Cosmetic gunshot / wall impact (multiplayer). */
  onShotFx(cb: (event: ShotFxEvent) => void): () => void {
    this.shotFxListeners.add(cb);
    return () => {
      this.shotFxListeners.delete(cb);
    };
  }

  private bindRoom(room: Room) {
    this.unbindRoom?.();
    this.room = room;
    this.sessionId = room.sessionId;

    const onChange = () => this.emit();
    room.onStateChange(onChange);

    const onHeThrow = (data: unknown) => {
      const o = data as Record<string, unknown>;
      const event: HeFxEvent = {
        type: "throw",
        id: String(o?.id ?? ""),
        ownerId: String(o?.ownerId ?? ""),
        x: Number(o?.x) || 0,
        z: Number(o?.z) || 0,
        fuse: Number(o?.fuse) || 1.8,
      };
      for (const cb of this.heFxListeners) cb(event);
    };
    const onHeExplode = (data: unknown) => {
      const o = data as Record<string, unknown>;
      const event: HeFxEvent = {
        type: "explode",
        id: String(o?.id ?? ""),
        x: Number(o?.x) || 0,
        z: Number(o?.z) || 0,
      };
      for (const cb of this.heFxListeners) cb(event);
    };
    const onFxShot = (data: unknown) => {
      const o = data as Record<string, unknown>;
      const imp = o?.impact as Record<string, unknown> | null | undefined;
      const event: ShotFxEvent = {
        ownerId: String(o?.ownerId ?? ""),
        x: Number(o?.x) || 0,
        z: Number(o?.z) || 0,
        rot: Number(o?.rot) || 0,
        impact: imp
          ? {
              x: Number(imp.x) || 0,
              y: Number(imp.y) || 1,
              z: Number(imp.z) || 0,
              nx: Number(imp.nx) || 0,
              ny: Number(imp.ny) || 0,
              nz: Number(imp.nz) || 0,
              surface: "wall",
            }
          : null,
      };
      for (const cb of this.shotFxListeners) cb(event);
    };
    room.onMessage("he_throw", onHeThrow);
    room.onMessage("he_explode", onHeExplode);
    room.onMessage("fx_shot", onFxShot);

    room.onError((code, message) => {
      this.mode = "error";
      this.error = message || `Room error ${code}`;
      this.emit();
    });
    room.onLeave(() => {
      // Unexpected disconnect — keep code for rejoin.
      this.persistLastRoom();
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

  /** Store last room code + map for lobby "Reentrar na última sala". */
  private persistLastRoom(fallbackMapId?: string | null): void {
    const code = this.code;
    if (!code) return;
    const mapId =
      this.snapshot().mapId || fallbackMapId || "";
    saveLastRoom({ code, mapId });
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
