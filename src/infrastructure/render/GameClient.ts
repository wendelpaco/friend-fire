import * as THREE from "three";
import { recordImpression } from "@/domains/ads";
import {
  applyDamage as applyDamageToVitals,
  beginReload,
  canOpenBuyMenu,
  completeReload,
  explodeAt,
  HE_FUSE,
  HE_GRAVITY,
  isDead,
  throwGrenade,
  tryBuy,
  WEAPONS,
} from "@/domains/combat";
import { Sfx } from "@/infrastructure/audio/Sfx";
import {
  getNickname,
  getOrCreateSessionId,
  recordMatchResult,
} from "@/domains/identity";
import {
  canDefuse,
  canPlant,
  createBombState,
  createMatchPhase,
  explode as explodeBomb,
  isInsideSite,
  applyDefaultLoadout,
  applyRoundEconomy,
  clampMoney,
  onDefuseComplete,
  onPlantComplete,
  onRoundWin,
  tickBombTimer,
  tickDefuse,
  tickPhase,
  tickPlant,
  type BombMatchState,
  type MatchPhaseState,
} from "@/domains/match";
import {
  appendMatch,
  upsertPlayerStats,
  type MatchResult,
} from "@/domains/stats";
import { pushImpression } from "@/infrastructure/analytics/queue";
import {
  BOT_LINES,
  BOT_NAMES,
  BOT_SPEED,
  BULLET_RADIUS,
  DEFAULT_MATCH,
  DEFUSE_RADIUS,
  KILL_REWARD,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  ROUND_TIME,
  ROUNDS_TO_WIN,
  START_MONEY,
  TEAM_COLORS,
  WARMUP_TIME,
} from "@/game/constants";
import type {
  BulletState,
  ChatEntry,
  HudSnapshot,
  KillFeedEntry,
  MatchState,
  PlayerState,
  RoundBannerKind,
  Team,
  WeaponId,
} from "@/game/types";
import { roundBannerText } from "@/game/types";
import {
  getMapById,
  mapCollisionWalls,
  resolveCircleWalls,
  tickMotor,
  type GameMap,
  type WallRect,
} from "@/domains/world";
import { RapierWorld } from "@/infrastructure/physics/RapierWorld";
import {
  FrameSampler,
  QualityController,
  type AdaptReason,
} from "@/infrastructure/perf";
import {
  getAutoQuality,
  getGraphicsQuality,
  parseGraphicsQuality,
  type GraphicsQuality,
} from "@/domains/prefs";
import { Input } from "./input";
import { ThreeRenderer } from "./ThreeRenderer";

/** Mirrors SettingsPanel keys — keep in sync with presentation/game/SettingsPanel. */
const PREFS_EVENT = "ff-prefs";

function readCameraDefault(): "locked" | "free" {
  if (typeof window === "undefined") return "locked";
  try {
    return localStorage.getItem("ff_camera_default") === "free"
      ? "free"
      : "locked";
  } catch {
    return "locked";
  }
}

function readFogEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem("ff_fog_enabled");
    return v == null ? true : v !== "0" && v !== "false";
  } catch {
    return true;
  }
}

let idCounter = 0;
function uid(prefix: string) {
  idCounter += 1;
  return `${prefix}_${idCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function asWeaponId(id: string | undefined | null): WeaponId | null {
  if (!id) return null;
  return id in WEAPONS ? (id as WeaponId) : null;
}

function pointInWall(
  x: number,
  z: number,
  w: { x: number; z: number; w: number; d: number },
): boolean {
  const halfW = w.w / 2;
  const halfD = w.d / 2;
  return (
    x > w.x - halfW &&
    x < w.x + halfW &&
    z > w.z - halfD &&
    z < w.z + halfD
  );
}

/** Approximate surface point + outward normal for a wall AABB hit. */
function wallImpactAt(
  x: number,
  z: number,
  w: { x: number; z: number; w: number; d: number; h?: number },
  prevX?: number,
  prevZ?: number,
): { x: number; y: number; z: number; nx: number; ny: number; nz: number } {
  const halfW = w.w / 2;
  const halfD = w.d / 2;
  const y = Math.min(1.1, (w.h ?? 2.5) * 0.45);

  // Prefer entry face from previous free position when available
  if (prevX !== undefined && prevZ !== undefined) {
    const left = w.x - halfW;
    const right = w.x + halfW;
    const bottom = w.z - halfD;
    const top = w.z + halfD;
    if (prevX <= left && x > left) {
      return { x: left, y, z: clamp(z, bottom, top), nx: -1, ny: 0, nz: 0 };
    }
    if (prevX >= right && x < right) {
      return { x: right, y, z: clamp(z, bottom, top), nx: 1, ny: 0, nz: 0 };
    }
    if (prevZ <= bottom && z > bottom) {
      return { x: clamp(x, left, right), y, z: bottom, nx: 0, ny: 0, nz: -1 };
    }
    if (prevZ >= top && z < top) {
      return { x: clamp(x, left, right), y, z: top, nx: 0, ny: 0, nz: 1 };
    }
  }

  // Nearest face from interior penetration
  const left = x - (w.x - halfW);
  const right = w.x + halfW - x;
  const bottom = z - (w.z - halfD);
  const top = w.z + halfD - z;
  const min = Math.min(left, right, bottom, top);
  if (min === left) {
    return { x: w.x - halfW, y, z, nx: -1, ny: 0, nz: 0 };
  }
  if (min === right) {
    return { x: w.x + halfW, y, z, nx: 1, ny: 0, nz: 0 };
  }
  if (min === bottom) {
    return { x, y, z: w.z - halfD, nx: 0, ny: 0, nz: -1 };
  }
  return { x, y, z: w.z + halfD, nx: 0, ny: 0, nz: 1 };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Map server primary/secondary/activeSlot/mag into client PlayerState loadout. */
function loadoutFromNetwork(
  np: {
    money?: number;
    primaryId?: string;
    secondaryId?: string;
    activeSlot?: number;
    mag?: number;
    reserve?: number;
    team?: string;
  },
  existing: PlayerState | undefined,
  team: Team,
): Pick<PlayerState, "money" | "weaponSlot" | "weapons" | "ammo"> {
  const primary = asWeaponId(np.primaryId);
  const secondary =
    asWeaponId(np.secondaryId) ??
    (team === "CT" ? ("usp" as WeaponId) : ("glock" as WeaponId));

  const weapons: PlayerState["weapons"] = { 4: "knife" };
  if (primary) weapons[1] = primary;
  weapons[2] = secondary;

  let weaponSlot = np.activeSlot ?? existing?.weaponSlot ?? 2;
  if (weaponSlot !== 1 && weaponSlot !== 2 && weaponSlot !== 4) {
    weaponSlot = 2;
  }
  // Don't keep slot 1 active if primary was dropped/missing
  if (weaponSlot === 1 && !primary) weaponSlot = 2;

  const ammo: PlayerState["ammo"] = { ...(existing?.ammo ?? {}) };
  if (primary && !ammo[primary]) {
    const w = WEAPONS[primary];
    ammo[primary] = { mag: w.magazine, reserve: w.reserve };
  }
  if (!ammo[secondary]) {
    const w = WEAPONS[secondary];
    ammo[secondary] = { mag: w.magazine, reserve: w.reserve };
  }

  // Server only streams mag/reserve for the active firearm
  const activeId =
    weaponSlot === 1 ? primary : weaponSlot === 2 ? secondary : null;
  if (activeId && typeof np.mag === "number") {
    ammo[activeId] = {
      mag: np.mag,
      reserve: typeof np.reserve === "number" ? np.reserve : 0,
    };
  }

  const money =
    typeof np.money === "number" && Number.isFinite(np.money)
      ? np.money
      : (existing?.money ?? START_MONEY);

  return { money, weaponSlot, weapons, ammo };
}

/**
 * Owns match simulation + input; drives ThreeRenderer each frame.
 * Public API matches the former GameEngine surface used by HUD / GameCanvas.
 */
export class GameClient {
  readonly input = new Input();
  readonly map: GameMap;
  /** @deprecated Prefer renderer accessors; kept for any legacy consumers. */
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private three: ThreeRenderer;
  private state: MatchState;
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private onHud?: (hud: HudSnapshot) => void;
  private botTimers = new Map<
    string,
    { nextShot: number; nextChat: number }
  >();
  private collisionWalls: WallRect[];
  private helpSeenKey = "ff_help_seen";
  private sessionId = "server";
  private mapImpressionsRecorded = false;
  private freeCamX = 0;
  private freeCamZ = 0;

  private buyMessage: string | null = null;
  private buyMessageUntil = 0;
  /** Fire `recordMatchResult` once per match_over transition. */
  private missionMatchRecorded = false;
  /** When true, combat/bots come from Colyseus; local only predicts movement. */
  private networked = false;
  private networkSessionId: string | null = null;
  /** When set (room mode), purchases go to the server instead of local tryBuy. */
  private buySender: ((itemId: string) => void) | null = null;

  /** Reused each frame to avoid allocating player snapshot arrays. */
  private renderPlayers: Array<{
    id: string;
    name: string;
    team: PlayerState["team"];
    isBot: boolean;
    x: number;
    z: number;
    y: number;
    crouching: boolean;
    onGround: boolean;
    reloading: boolean;
    rot: number;
    alive: boolean;
    color: number;
    weaponSlot: number;
    weaponId: string | undefined;
  }> = [];
  private showFps = false;
  private autoQuality = true;
  private userTierMax: GraphicsQuality = "medium";
  private fpsFrames = 0;
  private fpsLastT = 0;
  private fpsDisplay = 0;
  private lastDrawCalls = 0;
  private lastTriangles = 0;
  private frameSampler = new FrameSampler(120);
  private qualityController = new QualityController();
  private perfP50Ms = 0;
  private perfP95Ms = 0;
  private perfCpuP95Ms = 0;
  private perfRenderP95Ms = 0;
  private lastAdaptReason: AdaptReason | null = null;
  private metricsPublishAt = 0;
  /** Active HE projectiles (local solo). */
  private heProjectiles: Array<{
    slot: number;
    ownerId: string;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    age: number;
    fuse: number;
  }> = [];
  private heSlotSeq = 0;
  private matchConfig = {
    warmupTime: WARMUP_TIME,
    buyTime: DEFAULT_MATCH.buyTime,
    roundTime: ROUND_TIME,
    endPause: DEFAULT_MATCH.endPause,
    roundsToWin: ROUNDS_TO_WIN,
  };
  /** Client-side Rapier map (async init). Server still uses AABB motor. */
  private physics: RapierWorld | null = null;
  private physicsInit: Promise<void> | null = null;
  /** Round banner toast until performance.now() (§2.2). */
  private roundBannerUntil = 0;
  private roundBannerKind: RoundBannerKind | null = null;
  /** Killer to follow while spectating; null → free cam. */
  private spectateTargetId: string | null = null;
  /** true = follow target, false = free pan (Space toggles). */
  private spectatorFollow = true;

  private readBomb(): BombMatchState {
    return {
      bombState: this.state.bombState,
      bombCarrierId: this.state.bombCarrierId,
      bombX: this.state.bombX,
      bombZ: this.state.bombZ,
      plantProgress: this.state.plantProgress,
      defuseProgress: this.state.defuseProgress,
      bombTimer: this.state.bombTimer,
    };
  }

  private writeBomb(b: BombMatchState) {
    this.state.bombState = b.bombState;
    this.state.bombCarrierId = b.bombCarrierId;
    this.state.bombX = b.bombX;
    this.state.bombZ = b.bombZ;
    this.state.plantProgress = b.plantProgress;
    this.state.defuseProgress = b.defuseProgress;
    this.state.bombTimer = b.bombTimer;
  }

  /** Assign C4 to a random TR at live-round start. */
  private assignBombCarrier() {
    const trs = this.state.players.filter((p) => p.team === "TR");
    const carrier =
      trs.length > 0
        ? trs[Math.floor(Math.random() * trs.length)]!
        : null;
    this.writeBomb(createBombState(carrier?.id ?? null));
    this.syncBombVisual();
    if (carrier) {
      this.addChat("SYSTEM", `${carrier.name} carrega a C4`, "system");
    }
  }

  private siteUnderPlayer(x: number, z: number) {
    for (const s of this.map.bombSites) {
      if (isInsideSite(x, z, s)) return s;
    }
    return null;
  }

  private bombIsDown(): boolean {
    const s = this.state.bombState;
    return s === "planted" || s === "defusing";
  }

  private syncBombVisual() {
    if (this.bombIsDown()) {
      this.three.setBombVisual({ x: this.state.bombX, z: this.state.bombZ });
    } else {
      this.three.setBombVisual(null);
    }
  }

  /** Local solo plant / defuse / explode using domains/match/bomb. */
  private updateBomb(dt: number) {
    if (this.networked || this.state.phase !== "live") {
      this.syncBombVisual();
      return;
    }

    let bomb = this.readBomb();

    if (bomb.bombState === "planted" || bomb.bombState === "defusing") {
      bomb = tickBombTimer(bomb, dt);
      if (bomb.bombTimer <= 0) {
        bomb = explodeBomb(bomb);
        this.writeBomb(bomb);
        this.syncBombVisual();
        this.endRound("TR", "bomb_exploded");
        return;
      }
      this.writeBomb(bomb);
    }

    const p = this.state.players.find((x) => x.id === this.state.localPlayerId);
    if (!p || !p.alive) {
      this.syncBombVisual();
      return;
    }

    const holdingF = this.input.isDown("KeyF");
    const move = this.input.moveVector();
    // Free cam pans without moving body → still counts as stationary for plant.
    const stationary =
      this.state.cameraMode === "free" || (move.x === 0 && move.z === 0);
    const site = this.siteUnderPlayer(p.x, p.z);

    const plantOk = canPlant({
      bomb,
      playerId: p.id,
      team: p.team,
      alive: p.alive,
      x: p.x,
      z: p.z,
      stationary,
      site,
    });
    const defuseOk = canDefuse({
      bomb,
      team: p.team,
      alive: p.alive,
      x: p.x,
      z: p.z,
      radius: DEFUSE_RADIUS,
    });

    if (plantOk || bomb.bombState === "planting") {
      bomb = tickPlant(bomb, dt, holdingF, plantOk);
      if (bomb.plantProgress >= 1 && bomb.bombState === "planting") {
        bomb = onPlantComplete(bomb, p.x, p.z);
        this.writeBomb(bomb);
        this.syncBombVisual();
        this.addChat("SYSTEM", "C4 plantada!", "system");
        Sfx.play("ui");
        return;
      }
      this.writeBomb(bomb);
    } else if (defuseOk || bomb.bombState === "defusing") {
      bomb = tickDefuse(bomb, dt, holdingF, defuseOk);
      if (bomb.defuseProgress >= 1 && bomb.bombState === "defusing") {
        bomb = onDefuseComplete(bomb);
        this.writeBomb(bomb);
        this.syncBombVisual();
        this.endRound("CT", "bomb_defused");
        return;
      }
      this.writeBomb(bomb);
    }

    this.syncBombVisual();
  }

  private tryThrowHE(p: PlayerState) {
    if (this.networked) return;
    if (!p.alive || (p.heCount ?? 0) <= 0) return;
    if (this.state.phase !== "live" && this.state.phase !== "warmup") return;

    p.heCount = Math.max(0, (p.heCount ?? 0) - 1);
    const dirX = Math.sin(p.rot);
    const dirZ = Math.cos(p.rot);
    const thrown = throwGrenade(
      { x: p.x + dirX * 0.6, z: p.z + dirZ * 0.6 },
      { x: dirX, z: dirZ },
      1,
    );
    const slot = this.heSlotSeq++ % 8;
    this.heProjectiles.push({
      slot,
      ownerId: p.id,
      x: thrown.origin.x,
      y: thrown.origin.y,
      z: thrown.origin.z,
      vx: thrown.velocity.vx,
      vy: thrown.velocity.vy,
      vz: thrown.velocity.vz,
      age: 0,
      fuse: thrown.fuse || HE_FUSE,
    });
    this.three.spawnHE(
      thrown.origin.x,
      thrown.origin.y,
      thrown.origin.z,
      false,
      slot,
    );
    Sfx.play("ui");
  }

  private updateHE(dt: number) {
    if (this.networked || this.heProjectiles.length === 0) return;
    const next: typeof this.heProjectiles = [];
    for (const g of this.heProjectiles) {
      g.age += dt;
      g.vy -= HE_GRAVITY * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z += g.vz * dt;

      let explodeNow = false;
      if (g.y <= 0) {
        g.y = 0;
        explodeNow = true;
      }
      if (g.age >= g.fuse) explodeNow = true;

      if (explodeNow) {
        this.three.spawnHE(g.x, g.y, g.z, true, g.slot);
        const owner = this.state.players.find((pl) => pl.id === g.ownerId);
        const hits = explodeAt(
          g.x,
          g.z,
          this.state.players.map((pl) => ({
            id: pl.id,
            x: pl.x,
            z: pl.z,
            alive: pl.alive,
          })),
        );
        for (const hit of hits) {
          const victim = this.state.players.find((pl) => pl.id === hit.id);
          if (!victim || !victim.alive) continue;
          const killer = owner ?? victim;
          this.applyDamage(victim, killer, hit.damage, "HE");
          this.three.spawnDamageNumber(
            victim.x,
            1.4,
            victim.z,
            `-${Math.round(hit.damage)}`,
          );
        }
        continue;
      }

      this.three.spawnHE(g.x, g.y, g.z, false, g.slot);
      next.push(g);
    }
    this.heProjectiles = next;
  }

  /**
   * @param canvas WebGL host
   * @param mapId map registry id (default `dust`); unknown ids fall back to dust
   */
  constructor(canvas: HTMLCanvasElement, mapId?: string) {
    this.map = getMapById(mapId || "dust");
    this.collisionWalls = mapCollisionWalls(this.map);
    this.three = new ThreeRenderer(canvas, this.map);
    this.scene = this.three.scene;
    this.camera = this.three.camera;
    this.renderer = this.three.renderer;

    this.sessionId = getOrCreateSessionId();
    this.state = this.createInitialState();
    this.applyFogPref(readFogEnabled());
    this.applyGraphicsPrefs();
    this.initBotTimers();
    this.input.bind();
    if (typeof window !== "undefined") {
      window.addEventListener(PREFS_EVENT, this.onPrefsEvent);
    }
    // Seed meshes from initial players
    this.syncRender();
    void this.ensurePhysics();
  }

  /** Lazy Rapier init (WASM). Falls back to AABB motor until ready. */
  private async ensurePhysics(): Promise<void> {
    if (this.physics || this.physicsInit) return this.physicsInit ?? undefined;
    this.physicsInit = (async () => {
      try {
        this.physics = await RapierWorld.create(this.map);
        for (const p of this.state.players) {
          this.physics.ensureCharacter(p.id, p.x, p.z, p.y ?? 0);
        }
      } catch (err) {
        console.warn("[physics] Rapier init failed, using AABB motor", err);
        this.physics = null;
      }
    })();
    return this.physicsInit;
  }

  private onPrefsEvent = (ev: Event) => {
    const detail = (
      ev as CustomEvent<{
        fogEnabled?: boolean;
        graphicsQuality?: string;
        showFps?: boolean;
        autoQuality?: boolean;
      }>
    ).detail;
    if (detail && typeof detail.fogEnabled === "boolean") {
      this.applyFogPref(detail.fogEnabled);
    } else {
      this.applyFogPref(readFogEnabled());
    }
    this.applyGraphicsPrefs(detail);
  };

  private applyFogPref(enabled: boolean) {
    const three = this.three as ThreeRenderer & {
      setFogEnabled?: (on: boolean) => void;
    };
    if (typeof three.setFogEnabled === "function") {
      three.setFogEnabled(enabled);
    }
  }

  private applyGraphicsPrefs(detail?: {
    graphicsQuality?: string;
    showFps?: boolean;
    autoQuality?: boolean;
  }) {
    // Prefs are persisted before the event; re-read storage as source of truth.
    const tier =
      detail && detail.graphicsQuality != null
        ? parseGraphicsQuality(detail.graphicsQuality)
        : getGraphicsQuality();
    const auto =
      detail && typeof detail.autoQuality === "boolean"
        ? detail.autoQuality
        : getAutoQuality();

    const tierChanged = tier !== this.userTierMax;
    this.userTierMax = tier;
    this.autoQuality = auto;

    if (detail && typeof detail.showFps === "boolean") {
      this.showFps = detail.showFps;
    } else if (typeof window !== "undefined") {
      try {
        const v = localStorage.getItem("ff_show_fps");
        this.showFps = v === "1" || v === "true";
      } catch {
        this.showFps = false;
      }
    }

    if (!auto) {
      const knobs = this.qualityController.freezeToTier(tier);
      this.three.applyRuntimeKnobs(knobs);
      this.lastAdaptReason = "user";
    } else if (tierChanged) {
      const knobs = this.qualityController.setUserTier(tier);
      this.three.applyRuntimeKnobs(knobs);
      this.lastAdaptReason = "user";
    } else {
      // Auto on, same tier — re-apply current controller knobs (or init)
      this.three.applyRuntimeKnobs(this.qualityController.getKnobs());
    }
  }

  setHudListener(fn: (hud: HudSnapshot) => void) {
    this.onHud = fn;
  }

  setPaused(paused: boolean) {
    this.state.paused = paused;
    if (!paused) this.clock.getDelta();
  }

  togglePause() {
    this.setPaused(!this.state.paused);
  }

  dismissHelp() {
    this.state.showHelp = false;
    try {
      localStorage.setItem(this.helpSeenKey, "1");
    } catch {
      /* ignore */
    }
  }

  openHelp() {
    this.state.showHelp = true;
  }

  /**
   * Enable server-authoritative combat. Local bots/bullets stop;
   * `applyNetworkState` drives entities + scores.
   */
  setNetworked(enabled: boolean, sessionId: string | null = null) {
    this.networked = enabled;
    this.networkSessionId = sessionId;
    if (enabled) {
      this.state.bullets = [];
    } else {
      this.buySender = null;
    }
  }

  isNetworked() {
    return this.networked;
  }

  /** Inject room.send("buy") from GameCanvas when Colyseus is connected. */
  setBuySender(sender: ((itemId: string) => void) | null) {
    this.buySender = sender;
  }

  applyNetworkState(net: {
    sessionId: string | null;
    players: Array<{
      id: string;
      name: string;
      team: string;
      isBot: boolean;
      alive: boolean;
      x: number;
      z: number;
      y?: number;
      vy?: number;
      crouching?: boolean;
      onGround?: boolean;
      rot: number;
      hp: number;
      armor?: number;
      kills?: number;
      deaths?: number;
      money?: number;
      primaryId?: string;
      secondaryId?: string;
      activeSlot?: number;
      mag?: number;
      reserve?: number;
      heCount?: number;
    }>;
    phase: string | null;
    round: number;
    scoreTR: number;
    scoreCT: number;
    timeLeft: number;
    bombState?: string;
    bombX?: number;
    bombZ?: number;
    bombTimer?: number;
    bombCarrierId?: string;
    plantProgress?: number;
    defuseProgress?: number;
    roundEndReason?: string;
  }) {
    if (!this.networked) return;
    this.networkSessionId = net.sessionId;
    const prevPhase = this.state.phase;
    const prevScoreTR = this.state.scoreTR;
    const prevScoreCT = this.state.scoreCT;

    if (
      net.phase === "warmup" ||
      net.phase === "buy" ||
      net.phase === "live" ||
      net.phase === "ended" ||
      net.phase === "match_over"
    ) {
      this.state.phase = net.phase;
    }
    this.state.round = net.round;
    this.state.scoreTR = net.scoreTR;
    this.state.scoreCT = net.scoreCT;
    this.state.timeLeft = net.timeLeft;

    // C4 mirror from server
    const bs = net.bombState ?? "";
    if (
      bs === "carried" ||
      bs === "planting" ||
      bs === "planted" ||
      bs === "defusing" ||
      bs === "exploded" ||
      bs === "defused"
    ) {
      this.state.bombState = bs;
    } else if (!bs) {
      this.state.bombState = "carried";
    }
    this.state.bombX = net.bombX ?? 0;
    this.state.bombZ = net.bombZ ?? 0;
    this.state.bombTimer = net.bombTimer ?? 0;
    this.state.bombCarrierId = net.bombCarrierId || null;
    this.state.plantProgress = net.plantProgress ?? 0;
    this.state.defuseProgress = net.defuseProgress ?? 0;
    this.syncBombVisual();

    // Round banner on live → ended (or score bump mid-sync)
    if (
      prevPhase === "live" &&
      (this.state.phase === "ended" || this.state.phase === "match_over")
    ) {
      const reason = net.roundEndReason ?? "";
      if (reason === "bomb_exploded") {
        this.showRoundBanner("bomb_exploded");
      } else if (reason === "bomb_defused") {
        this.showRoundBanner("bomb_defused");
      } else if (net.scoreTR > prevScoreTR) {
        this.showRoundBanner("tr_win");
      } else if (net.scoreCT > prevScoreCT) {
        this.showRoundBanner("ct_win");
      }
    }
    if (this.state.phase === "live" && prevPhase !== "live") {
      this.clearSpectator();
      this.heProjectiles = [];
    }

    const localId = net.sessionId ?? this.state.localPlayerId;
    // Keep localPlayerId as session id for HUD
    if (net.sessionId) this.state.localPlayerId = net.sessionId;

    const nextPlayers: PlayerState[] = [];
    for (const np of net.players) {
      const team = (np.team === "CT" ? "CT" : "TR") as Team;
      const existing = this.state.players.find((p) => p.id === np.id);
      const isLocal = np.id === localId;

      // Client-side prediction: keep local position if slightly ahead (optional blend)
      let x = np.x;
      let z = np.z;
      let rot = np.rot;
      if (isLocal && existing && this.state.cameraMode === "locked") {
        // Soft correct toward server
        x = existing.x * 0.35 + np.x * 0.65;
        z = existing.z * 0.35 + np.z * 0.65;
        rot = np.rot;
      }

      const loadout = loadoutFromNetwork(np, existing, team);

      // Floating damage numbers when enemy HP drops soon after local shot
      if (
        existing &&
        np.hp < existing.hp &&
        !isLocal &&
        existing.team !==
          (this.state.players.find((p) => p.id === localId)?.team ?? existing.team)
      ) {
        const localP = this.state.players.find((p) => p.id === localId);
        const dealt = Math.round(existing.hp - np.hp);
        if (
          dealt > 0 &&
          localP &&
          performance.now() - localP.lastShotAt < 250
        ) {
          this.three.spawnDamageNumber(np.x, 1.4, np.z, `-${dealt}`);
        }
      }

      // Enter spectator when local dies mid-live
      if (
        isLocal &&
        existing?.alive &&
        !np.alive &&
        this.state.phase === "live"
      ) {
        this.enterSpectator(null);
      }

      // Jump/crouch: remote from server; local keeps prediction (soft y blend).
      let y = np.y ?? existing?.y ?? 0;
      let vy = np.vy ?? existing?.vy ?? 0;
      let crouching = np.crouching ?? existing?.crouching ?? false;
      let onGround = np.onGround ?? existing?.onGround ?? true;
      if (isLocal && existing) {
        y = existing.y * 0.5 + y * 0.5;
        crouching = existing.crouching;
        onGround = existing.onGround;
        vy = existing.vy;
      }

      nextPlayers.push({
        id: np.id,
        name: np.name,
        team,
        isBot: np.isBot,
        x,
        z,
        y,
        vy,
        crouching,
        onGround,
        rot,
        hp: np.hp,
        armor: np.armor ?? existing?.armor ?? 0,
        money: loadout.money,
        weaponSlot: loadout.weaponSlot,
        weapons: loadout.weapons,
        ammo: loadout.ammo,
        alive: np.alive,
        kills: np.kills ?? existing?.kills ?? 0,
        deaths: np.deaths ?? existing?.deaths ?? 0,
        assists: existing?.assists ?? 0,
        lastShotAt: existing?.lastShotAt ?? 0,
        reloadingUntil: existing?.reloadingUntil ?? 0,
        heCount: np.heCount ?? existing?.heCount ?? 0,
        color: TEAM_COLORS[team],
        diedThisRound:
          existing?.diedThisRound ||
          (isLocal && existing?.alive && !np.alive) ||
          false,
      });
    }

    if (nextPlayers.length > 0) {
      this.state.players = nextPlayers;
    }
    this.state.bullets = [];

    if (this.state.phase === "match_over" && prevPhase !== "match_over") {
      this.maybeRecordMissionResult();
    } else if (this.state.phase !== "match_over") {
      this.missionMatchRecorded = false;
    }
  }

  /** Cosmetic HE from server `he_throw` / `he_explode` broadcasts. */
  applyNetworkHeFx(event: {
    type: "throw" | "explode";
    id: string;
    x: number;
    z: number;
    fuse?: number;
    ownerId?: string;
  }) {
    if (!this.networked) return;
    // Map string ids to small slot pool for mesh reuse
    let slot = 0;
    for (let i = 0; i < event.id.length; i++) {
      slot = (slot + event.id.charCodeAt(i)) % 8;
    }
    if (event.type === "throw") {
      this.three.spawnHE(event.x, 1.2, event.z, false, slot);
      Sfx.play("ui");
    } else {
      this.three.spawnHE(event.x, 0.2, event.z, true, slot);
    }
  }

  /**
   * Multiplayer gunshot cosmetics from server `fx_shot`.
   * Local player already predicted muzzle/impact — skip duplicate self FX.
   */
  applyNetworkShotFx(event: {
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
  }) {
    if (!this.networked) return;
    const localId = this.networkSessionId ?? this.state.localPlayerId;
    if (event.ownerId === localId) return; // already predicted client-side

    this.three.spawnMuzzle(event.x, event.z, event.rot);
    this.three.notifyShoot(event.ownerId);
    if (event.impact) {
      this.three.spawnTracer(
        event.x,
        1.15,
        event.z,
        event.impact.x,
        event.impact.y,
        event.impact.z,
      );
      this.three.spawnImpact(
        event.impact.x,
        event.impact.y,
        event.impact.z,
        event.impact.nx,
        event.impact.ny,
        event.impact.nz,
        event.impact.surface,
      );
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.fpsLastT = performance.now();
    this.fpsFrames = 0;
    this.metricsPublishAt = performance.now();
    this.frameSampler.clear();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t0 = performance.now();
      this.update(dt);
      const t1 = performance.now();
      this.three.render();
      const t2 = performance.now();

      this.frameSampler.push({
        frameMs: t2 - t0,
        cpuMs: t1 - t0,
        renderMs: t2 - t1,
      });

      if (this.showFps) this.fpsFrames += 1;

      // Metrics + quality controller ~2 Hz (not every frame)
      if (t2 - this.metricsPublishAt >= 500) {
        const snap = this.frameSampler.snapshot();
        this.perfP50Ms = snap.p50FrameMs;
        this.perfP95Ms = snap.p95FrameMs;
        this.perfCpuP95Ms = snap.p95CpuMs;
        this.perfRenderP95Ms = snap.p95RenderMs;

        if (this.showFps) {
          const elapsed = t2 - this.fpsLastT;
          if (elapsed > 0 && this.fpsFrames > 0) {
            this.fpsDisplay = Math.round((this.fpsFrames * 1000) / elapsed);
          }
          this.fpsFrames = 0;
          this.fpsLastT = t2;
          const info = this.three.getRenderInfo();
          this.lastDrawCalls = info.calls;
          this.lastTriangles = info.triangles;
        }

        const tick = this.qualityController.tick(
          { p50FrameMs: snap.p50FrameMs, p95FrameMs: snap.p95FrameMs },
          {
            autoEnabled: this.autoQuality,
            userTierMax: this.userTierMax,
            documentHidden:
              typeof document !== "undefined" ? document.hidden : false,
          },
        );
        if (tick.changed) {
          this.three.applyRuntimeKnobs(tick.knobs);
          this.lastAdaptReason = tick.reason;
        } else if (tick.reason === "grace" || tick.reason === "user") {
          this.lastAdaptReason = tick.reason;
        }

        this.metricsPublishAt = t2;
      }
    };
    loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    this.input.unbind();
    if (typeof window !== "undefined") {
      window.removeEventListener(PREFS_EVENT, this.onPrefsEvent);
    }
    this.physics?.dispose();
    this.physics = null;
    this.three.dispose();
  }

  resize(width: number, height: number) {
    this.three.resize(width, height);
  }

  // ─── setup ───────────────────────────────────────────────

  private createInitialState(): MatchState {
    const localId = "local_player";
    let showHelp = true;
    try {
      showHelp = localStorage.getItem(this.helpSeenKey) !== "1";
    } catch {
      showHelp = true;
    }

    const cameraMode = readCameraDefault();

    const players: PlayerState[] = [
      this.makePlayer(localId, "Você", "TR", false, 0),
      this.makePlayer(uid("bot"), BOT_NAMES[0], "TR", true, 1),
      this.makePlayer(uid("bot"), BOT_NAMES[1], "TR", true, 2),
      this.makePlayer(uid("bot"), BOT_NAMES[2], "CT", true, 0),
      this.makePlayer(uid("bot"), BOT_NAMES[3], "CT", true, 1),
      this.makePlayer(uid("bot"), BOT_NAMES[4], "CT", true, 2),
    ];

    const match = createMatchPhase(this.matchConfig);

    return {
      phase: match.phase,
      round: match.round,
      timeLeft: match.timeLeft,
      scoreTR: match.scoreTR,
      scoreCT: match.scoreCT,
      lossStreakTR: 0,
      lossStreakCT: 0,
      players,
      bullets: [],
      killFeed: [],
      chat: [
        {
          id: uid("chat"),
          from: "SYSTEM",
          text: "AQUECIMENTO — treine mira e movimento. Nada conta.",
          kind: "system",
          at: performance.now(),
        },
      ],
      localPlayerId: localId,
      paused: false,
      showScoreboard: false,
      showHelp,
      showBuyMenu: false,
      cameraMode,
      hitMarkerUntil: 0,
      damageFlashUntil: 0,
      lastDamageAmount: 0,
      bombState: "carried",
      bombCarrierId: null,
      bombX: 0,
      bombZ: 0,
      plantProgress: 0,
      defuseProgress: 0,
      bombTimer: 40,
    };
  }

  private initBotTimers() {
    for (const p of this.state.players) {
      if (p.isBot) {
        this.botTimers.set(p.id, {
          nextShot: 0,
          nextChat: performance.now() + 3000 + Math.random() * 5000,
        });
      }
    }
  }

  private toPhaseState(): MatchPhaseState {
    return {
      phase: this.state.phase,
      round: this.state.round,
      timeLeft: this.state.timeLeft,
      scoreTR: this.state.scoreTR,
      scoreCT: this.state.scoreCT,
      ...this.matchConfig,
    };
  }

  private applyPhaseState(m: MatchPhaseState) {
    this.state.phase = m.phase;
    this.state.round = m.round;
    this.state.timeLeft = m.timeLeft;
    this.state.scoreTR = m.scoreTR;
    this.state.scoreCT = m.scoreCT;
  }

  private makePlayer(
    id: string,
    name: string,
    team: Team,
    isBot: boolean,
    spawnIndex: number,
  ): PlayerState {
    const spawns = this.map.spawns.filter((s) => s.team === team);
    const spawn = spawns[spawnIndex % spawns.length]!;
    // Humans start with pistol only (buy menu upgrades); bots get full kit
    const secondary: WeaponId = team === "TR" ? "glock" : "usp";
    const weapons: PlayerState["weapons"] = isBot
      ? {
          1: team === "TR" ? "ak47" : "mp5",
          2: secondary,
          4: "knife",
        }
      : {
          2: secondary,
          4: "knife",
        };

    const ammo: PlayerState["ammo"] = {};
    for (const wid of Object.values(weapons)) {
      if (!wid) continue;
      const def = WEAPONS[wid];
      ammo[wid] = { mag: def.magazine, reserve: def.reserve };
    }

    return {
      id,
      name,
      team,
      isBot,
      x: spawn.x + (Math.random() - 0.5) * 1.5,
      z: spawn.z + (Math.random() - 0.5) * 1.5,
      y: 0,
      vy: 0,
      crouching: false,
      onGround: true,
      rot: team === "TR" ? Math.PI / 4 : (-3 * Math.PI) / 4,
      hp: 100,
      armor: team === "CT" ? 50 : 0,
      money: START_MONEY,
      weaponSlot: 2,
      weapons,
      ammo,
      heCount: 0,
      alive: true,
      kills: 0,
      deaths: 0,
      assists: 0,
      lastShotAt: 0,
      reloadingUntil: 0,
      color: TEAM_COLORS[team],
      diedThisRound: false,
    };
  }

  // ─── update ──────────────────────────────────────────────

  private update(dt: number) {
    if (this.input.wasPressed("Escape")) {
      if (this.state.showBuyMenu) {
        this.closeBuyMenu();
      } else {
        this.togglePause();
      }
    }
    if (this.input.wasPressed("KeyH")) {
      if (this.state.showHelp) this.dismissHelp();
      else this.state.showHelp = true;
    }
    this.state.showScoreboard = this.input.isDown("Tab");

    if (this.input.wasPressed("KeyC") && !this.state.showBuyMenu) {
      const local = this.state.players.find(
        (x) => x.id === this.state.localPlayerId,
      );
      const spectating =
        !!local && !local.alive && this.state.phase === "live";
      if (spectating) {
        this.toggleSpectatorCamera();
      } else {
        this.state.cameraMode =
          this.state.cameraMode === "locked" ? "free" : "locked";
        Sfx.play("ui");
        if (local) {
          this.freeCamX = local.x;
          this.freeCamZ = local.z;
        }
      }
    }

    if (this.input.wasPressed("KeyB")) {
      if (canOpenBuyMenu(this.state.phase) && !this.state.paused) {
        this.state.showBuyMenu = !this.state.showBuyMenu;
        Sfx.play("ui");
      } else if (!canOpenBuyMenu(this.state.phase)) {
        this.flashBuyMessage("Loja só no aquecimento ou na fase de compra");
        Sfx.play("deny");
      }
    }

    if (this.buyMessage && performance.now() > this.buyMessageUntil) {
      this.buyMessage = null;
    }

    if (this.state.paused || this.state.showHelp) {
      this.pushHud();
      this.input.endFrame();
      return;
    }

    if (this.state.phase !== "match_over") {
      this.updateAim();
      // Phase timer only local when offline; networked phases come from server
      if (!this.networked) {
        this.updateTimer(dt);
      }
    }

    this.updateSpectator(dt);

    if (this.state.phase === "match_over") {
      this.maybeRecordMissionResult();
      this.pushHud();
      this.input.endFrame();
      return;
    }

    // Buy menu open: freeze local combat (network still receives external state)
    if (this.state.showBuyMenu) {
      if (!canOpenBuyMenu(this.state.phase)) {
        this.state.showBuyMenu = false;
      }
      if (!this.networked) {
        this.updateBots(dt);
        this.updateBullets(dt);
      }
      this.three.animateDust(dt);
      this.three.updateFx(dt);
      this.syncRender();
      this.pushHud();
      this.input.endFrame();
      return;
    }

    if (this.networked) {
      // Predict local movement only; combat/HP/bots from server via applyNetworkState
      this.updateLocalPlayerNetworked(dt);
      this.three.animateDust(dt);
      this.three.updateFx(dt);
      this.syncRender();
      this.pushHud();
      this.input.endFrame();
      return;
    }

    this.updateLocalPlayer(dt);
    this.updateBots(dt);
    this.updateBullets(dt);
    this.updateBomb(dt);
    this.updateHE(dt);
    this.three.animateDust(dt);
    this.three.updateFx(dt);
    this.syncRender();
    this.pushHud();
    this.input.endFrame();
  }

  /** Client prediction while server is authoritative (includes jump/crouch). */
  private updateLocalPlayerNetworked(dt: number) {
    const p = this.state.players.find((x) => x.id === this.state.localPlayerId);
    if (!p || !p.alive) return;

    this.applyPlayerMotor(p, dt, {
      freeCamPan: this.state.cameraMode === "free",
    });

    const dx = this.input.aimWorldX - p.x;
    const dz = this.input.aimWorldZ - p.z;
    if (dx !== 0 || dz !== 0) p.rot = Math.atan2(dx, dz);

    // Local fire SFX + cosmetic muzzle/wall FX (damage is server-side)
    if (this.input.isMouseDown(0)) {
      const now = performance.now();
      const wid = p.weapons[p.weaponSlot];
      const def = wid ? WEAPONS[wid] : null;
      if (def?.isMelee) return;
      const ammo = wid ? p.ammo[wid] : null;
      // Respect weapon fire rate and local mag when present (sync may lag)
      if (ammo && ammo.mag <= 0) return;
      const cd = def?.fireRate ?? 140;
      if (now - p.lastShotAt > cd) {
        p.lastShotAt = now;
        if (ammo) ammo.mag = Math.max(0, ammo.mag - 1);
        Sfx.play("shoot");
        this.three.spawnMuzzle(p.x, p.z, p.rot);
        this.three.notifyShoot(p.id);
        const reach = Math.min(def?.range ?? 50, 40);
        this.three.spawnTracer(
          p.x + Math.sin(p.rot) * 0.7,
          1.15,
          p.z + Math.cos(p.rot) * 0.7,
          p.x + Math.sin(p.rot) * reach,
          1.0,
          p.z + Math.cos(p.rot) * reach,
        );
        this.cosmeticWallRay(p.x, p.z, p.rot, def?.range ?? 50);
      }
    }
  }

  /** Called from BuyMenu UI */
  purchase(itemId: string) {
    const p = this.state.players.find((x) => x.id === this.state.localPlayerId);
    if (!p || !this.state.showBuyMenu) return;
    if (!canOpenBuyMenu(this.state.phase)) {
      this.flashBuyMessage("Loja fechada");
      Sfx.play("deny");
      return;
    }

    // Room mode: server owns money/loadout — send buy, wait for state sync
    if (this.networked && this.buySender) {
      this.buySender(itemId);
      this.flashBuyMessage("Compra enviada…");
      Sfx.play("buy");
      return;
    }

    const result = tryBuy(
      {
        money: p.money,
        armor: p.armor,
        weapons: p.weapons,
        ammo: p.ammo,
        weaponSlot: p.weaponSlot,
        heCount: p.heCount ?? 0,
      },
      itemId,
    );
    if (!result.ok || !result.player) {
      this.flashBuyMessage(result.ok ? "Erro" : result.reason);
      Sfx.play("deny");
      return;
    }
    p.money = result.player.money;
    p.armor = result.player.armor;
    p.weapons = result.player.weapons;
    p.ammo = result.player.ammo;
    p.weaponSlot = result.player.weaponSlot;
    if (result.player.heCount != null) p.heCount = result.player.heCount;
    this.flashBuyMessage(result.message);
    Sfx.play("buy");
  }

  closeBuyMenu() {
    this.state.showBuyMenu = false;
    Sfx.play("ui");
  }

  private flashBuyMessage(msg: string) {
    this.buyMessage = msg;
    this.buyMessageUntil = performance.now() + 2200;
  }

  private syncRender() {
    const local = this.state.players.find(
      (x) => x.id === this.state.localPlayerId,
    );
    const spectating =
      !!local && !local.alive && this.state.phase === "live";
    const now = performance.now();
    // Ground reticle (RUSH-B style) — hide in menus / dead
    const showReticle =
      !!local &&
      local.alive &&
      !this.state.paused &&
      !this.state.showBuyMenu &&
      !this.state.showHelp;
    this.three.setAimReticle(
      this.input.aimWorldX,
      this.input.aimWorldZ,
      showReticle,
    );
    const n = this.state.players.length;
    // Grow buffer once; mutate slots in place (no per-frame map alloc).
    while (this.renderPlayers.length < n) {
      this.renderPlayers.push({
        id: "",
        name: "",
        team: "CT",
        isBot: false,
        x: 0,
        z: 0,
        y: 0,
        crouching: false,
        onGround: true,
        reloading: false,
        rot: 0,
        alive: true,
        color: 0,
        weaponSlot: 0,
        weaponId: undefined,
      });
    }
    this.renderPlayers.length = n;
    for (let i = 0; i < n; i++) {
      const p = this.state.players[i]!;
      const slot = this.renderPlayers[i]!;
      slot.id = p.id;
      slot.name = p.name;
      slot.team = p.team;
      slot.isBot = p.isBot;
      slot.x = p.x;
      slot.z = p.z;
      slot.y = p.y ?? 0;
      slot.crouching = p.crouching ?? false;
      slot.onGround = p.onGround ?? true;
      slot.reloading = p.reloadingUntil > now;
      slot.rot = p.rot;
      slot.alive = p.alive;
      slot.color = p.color;
      slot.weaponSlot = p.weaponSlot;
      slot.weaponId = p.weapons[p.weaponSlot];
    }
    // Spectator always drives free-cam look target (follow or pan).
    this.three.sync({
      players: this.renderPlayers,
      bullets: this.state.bullets,
      localPlayerId: this.state.localPlayerId,
      cameraMode: spectating ? "free" : this.state.cameraMode,
      freeCamX: this.freeCamX,
      freeCamZ: this.freeCamZ,
    });
  }

  private updateAim() {
    const hit = this.three.pickGround(this.input.mouseX, this.input.mouseY);
    if (hit) {
      this.input.aimWorldX = hit.x;
      this.input.aimWorldZ = hit.z;
    }
  }

  private updateTimer(dt: number) {
    const prev = this.toPhaseState();
    const next = tickPhase(prev, dt);
    this.applyPhaseState(next);

    if (
      prev.phase === "live" &&
      (next.phase === "ended" || next.phase === "match_over")
    ) {
      this.applyRoundEndEffects("CT", "ct_win");
    }

    // Warmup → buy (first round) or ended → buy (next rounds)
    if (next.phase === "buy" && prev.phase !== "buy") {
      if (prev.phase === "warmup") {
        this.recordMapAdImpressions();
      }
      this.beginBuyPhaseEffects();
    }

    // Buy freezetime over → live combat
    if (next.phase === "live" && prev.phase === "buy") {
      this.state.showBuyMenu = false;
      this.beginLiveRoundEffects();
    }

    if (next.phase === "match_over" && prev.phase !== "match_over") {
      this.maybeRecordMissionResult();
    } else if (next.phase !== "match_over") {
      this.missionMatchRecorded = false;
    }
  }

  /**
   * Once per match_over: daily mission progress + match history + leaderboard.
   * Shares a single latch so missions and stats stay in lockstep.
   */
  private maybeRecordMissionResult() {
    if (this.state.phase !== "match_over" || this.missionMatchRecorded) return;
    this.missionMatchRecorded = true;

    const local = this.state.players.find(
      (p) => p.id === this.state.localPlayerId,
    );
    if (!local) return;

    const result = this.localMatchResult(local.team);
    const won = result === "win";

    const { xpGranted } = recordMatchResult({
      won,
      kills: local.kills,
    });

    const nickname = getNickname();
    appendMatch({
      nickname,
      kills: local.kills,
      deaths: local.deaths,
      money: local.money,
      result,
      map: this.map.displayName,
    });
    upsertPlayerStats({
      nickname,
      kills: local.kills,
      won,
    });

    if (xpGranted > 0) {
      const msg = `Missão completa! +${xpGranted} XP`;
      this.flashBuyMessage(msg);
      this.addChat("SYSTEM", msg, "system");
    }
  }

  private localMatchResult(team: Team): MatchResult {
    if (this.state.scoreTR === this.state.scoreCT) return "draw";
    const trWon = this.state.scoreTR > this.state.scoreCT;
    if (team === "TR") return trWon ? "win" : "loss";
    return trWon ? "loss" : "win";
  }

  private recordMapAdImpressions() {
    if (this.mapImpressionsRecorded) return;
    this.mapImpressionsRecorded = true;
    for (const slot of this.map.billboards) {
      pushImpression(
        recordImpression({
          placement: "map_billboard",
          creativeId: slot.adId,
          sessionId: this.sessionId,
        }),
      );
    }
    for (const poster of this.map.wallPosters) {
      pushImpression(
        recordImpression({
          placement: "map_poster",
          creativeId: poster.adId,
          sessionId: this.sessionId,
        }),
      );
    }
  }

  /** Start of buy freezetime: CS strip if died, spawn, shop unlocked. */
  private beginBuyPhaseEffects() {
    this.state.bullets = [];
    this.heProjectiles = [];
    this.clearSpectator();
    this.addChat(
      "SYSTEM",
      `COMPRA · round ${this.state.round} · ${Math.ceil(this.state.timeLeft)}s · tecla B`,
      "system",
    );
    for (const p of this.state.players) {
      // CS: die → knife + team pistol next buy; survive → keep guns
      if (p.diedThisRound) {
        const stripped = applyDefaultLoadout(p);
        p.weapons = stripped.weapons;
        p.ammo = stripped.ammo;
        p.weaponSlot = stripped.weaponSlot;
        p.armor = stripped.armor;
        p.heCount = stripped.heCount;
      }
      p.diedThisRound = false;
      this.respawnPlayer(p);
    }
    this.assignBombCarrier();
    if (!this.networked && canOpenBuyMenu("buy")) {
      this.state.showBuyMenu = true;
    }
  }

  /** Buy ended → combat starts (no re-buy until next buy phase). */
  private beginLiveRoundEffects() {
    this.state.bullets = [];
    this.heProjectiles = [];
    this.clearSpectator();
    this.state.showBuyMenu = false;
    for (const p of this.state.players) {
      p.diedThisRound = false;
    }
    this.addChat("SYSTEM", `ROUND ${this.state.round} — combate!`, "system");
  }

  private applyRoundEndEffects(winner: Team, reason?: RoundBannerKind) {
    const kind = reason ?? (winner === "TR" ? "tr_win" : "ct_win");
    this.showRoundBanner(kind);
    this.addChat("SYSTEM", `${winner} venceu o round!`, "system");
    // CS economy: win $3250 / loss $1400 + consecutive loss bonus, cap $16k
    const eco = applyRoundEconomy(
      this.state.players,
      winner,
      this.state.lossStreakTR,
      this.state.lossStreakCT,
    );
    this.state.players = eco.players as PlayerState[];
    this.state.lossStreakTR = eco.lossStreakTR;
    this.state.lossStreakCT = eco.lossStreakCT;
    // Freeze bomb/HE visuals until next live assign
    this.heProjectiles = [];
    this.three.setBombVisual(null);
  }

  /** Full-width toast for 2.5s (spec §2.2). */
  private showRoundBanner(kind: RoundBannerKind) {
    this.roundBannerKind = kind;
    this.roundBannerUntil = performance.now() + 2500;
  }

  /**
   * End live round. Optional reason for bomb explode/defuse banners.
   * Call with `endRound("TR", "bomb_exploded")` etc.
   */
  private endRound(winner: Team, reason?: RoundBannerKind) {
    if (this.state.phase !== "live") return;
    const next = onRoundWin(this.toPhaseState(), winner);
    this.applyPhaseState(next);
    this.applyRoundEndEffects(
      winner,
      reason ?? (winner === "TR" ? "tr_win" : "ct_win"),
    );
    if (next.phase === "match_over") {
      this.maybeRecordMissionResult();
    }
  }

  private clearSpectator() {
    this.spectateTargetId = null;
    this.spectatorFollow = true;
  }

  private enterSpectator(killerId: string | null) {
    const local = this.state.players.find(
      (x) => x.id === this.state.localPlayerId,
    );
    if (!local) return;

    this.spectateTargetId = killerId;
    const target = killerId
      ? this.state.players.find((p) => p.id === killerId && p.alive)
      : null;

    if (target) {
      this.spectatorFollow = true;
      this.state.cameraMode = "locked";
      this.freeCamX = target.x;
      this.freeCamZ = target.z;
    } else {
      this.spectatorFollow = false;
      this.state.cameraMode = "free";
      this.freeCamX = local.x;
      this.freeCamZ = local.z;
    }
  }

  private toggleSpectatorCamera() {
    this.spectatorFollow = !this.spectatorFollow;
    this.state.cameraMode = this.spectatorFollow ? "locked" : "free";
    Sfx.play("ui");
    if (this.spectatorFollow && this.spectateTargetId) {
      const t = this.state.players.find(
        (p) => p.id === this.spectateTargetId && p.alive,
      );
      if (t) {
        this.freeCamX = t.x;
        this.freeCamZ = t.z;
      } else {
        this.spectatorFollow = false;
        this.state.cameraMode = "free";
      }
    }
  }

  /** Free / follow cam while dead in live phase (§2.3). */
  private updateSpectator(dt: number) {
    const local = this.state.players.find(
      (x) => x.id === this.state.localPlayerId,
    );
    if (!local || local.alive || this.state.phase !== "live") return;

    if (this.input.wasPressed("Space")) {
      this.toggleSpectatorCamera();
    }

    if (this.spectatorFollow && this.spectateTargetId) {
      const t = this.state.players.find(
        (p) => p.id === this.spectateTargetId && p.alive,
      );
      if (t) {
        this.freeCamX = t.x;
        this.freeCamZ = t.z;
      } else {
        this.spectatorFollow = false;
        this.state.cameraMode = "free";
      }
    } else {
      const move = this.input.moveVector();
      const pan = PLAYER_SPEED * 1.8 * dt;
      this.freeCamX += move.x * pan;
      this.freeCamZ += move.z * pan;
    }
  }

  private computeBombPrompt(local: PlayerState): string | null {
    if (!local.alive) return null;
    const s = this.state;

    if (
      local.team === "TR" &&
      s.bombCarrierId === local.id &&
      (s.bombState === "carried" || s.bombState === "planting")
    ) {
      const nearSite = this.map.bombSites.some(
        (site) =>
          (local.x - site.x) ** 2 + (local.z - site.z) ** 2 <=
          site.radius * site.radius,
      );
      if (nearSite) return "Segure F para plantar";
    }

    if (
      canDefuse({
        bomb: {
          bombState: s.bombState,
          bombCarrierId: s.bombCarrierId,
          bombX: s.bombX,
          bombZ: s.bombZ,
          plantProgress: s.plantProgress,
          defuseProgress: s.defuseProgress,
          bombTimer: s.bombTimer,
        },
        team: local.team,
        alive: local.alive,
        x: local.x,
        z: local.z,
        radius: DEFUSE_RADIUS,
      })
    ) {
      return "Segure F para desarmar";
    }
    return null;
  }

  private respawnPlayer(p: PlayerState) {
    const spawns = this.map.spawns.filter((s) => s.team === p.team);
    const spawn = spawns[Math.floor(Math.random() * spawns.length)]!;
    p.x = spawn.x + (Math.random() - 0.5);
    p.z = spawn.z + (Math.random() - 0.5);
    p.y = 0;
    p.vy = 0;
    p.crouching = false;
    p.onGround = true;
    p.hp = 100;
    p.alive = true;
    p.reloadingUntil = 0;
    p.rot = p.team === "TR" ? Math.PI / 4 : (-3 * Math.PI) / 4;
    for (const [wid, ammo] of Object.entries(p.ammo)) {
      if (!ammo) continue;
      p.ammo[wid as WeaponId] = completeReload(ammo, wid as WeaponId);
    }
    this.physics?.ensureCharacter(p.id, p.x, p.z, 0);
  }

  /**
   * CS-like horizontal + jump/crouch.
   * Prefers Rapier CharacterController when WASM ready; else AABB motor.
   * Crouch is **toggle** (Control edge). Free cam pans view only.
   */
  private applyPlayerMotor(
    p: PlayerState,
    dt: number,
    opts: { freeCamPan: boolean },
  ) {
    const move = this.input.moveVector();
    if (opts.freeCamPan) {
      const pan = PLAYER_SPEED * 1.8 * dt;
      this.freeCamX += move.x * pan;
      this.freeCamZ += move.z * pan;
    }

    // Toggle crouch on Control edge; pass state (not key hold) to motor/Rapier
    if (this.input.wasCrouchPressed()) {
      p.crouching = !p.crouching;
    }

    const wishX = opts.freeCamPan ? 0 : move.x;
    const wishZ = opts.freeCamPan ? 0 : move.z;
    const jump = this.input.wasJumpPressed();

    void this.ensurePhysics();
    if (this.physics) {
      this.physics.ensureCharacter(p.id, p.x, p.z, p.y ?? 0);
      const pose = this.physics.stepCharacter(p.id, {
        wishX,
        wishZ,
        jump,
        crouching: p.crouching ?? false,
        dt,
        standSpeed: PLAYER_SPEED,
      });
      if (pose) {
        p.x = pose.x;
        p.z = pose.z;
        p.y = pose.y;
        p.vy = pose.vy;
        p.crouching = pose.crouching;
        p.onGround = pose.onGround;
      }
    } else {
      const next = tickMotor(
        {
          x: p.x,
          z: p.z,
          y: p.y ?? 0,
          vy: p.vy ?? 0,
          crouching: p.crouching ?? false,
          onGround: p.onGround ?? true,
        },
        {
          wishX,
          wishZ,
          jump,
          crouch: p.crouching ?? false,
          dt,
          standSpeed: PLAYER_SPEED,
          walls: this.collisionWalls,
        },
      );
      p.x = next.x;
      p.z = next.z;
      p.y = next.y;
      p.vy = next.vy;
      p.crouching = next.crouching;
      p.onGround = next.onGround;
    }

    // Foot SFX is driven by CharacterAnimator foot-plant phase in ThreeRenderer
    // (finer sync than a fixed cooldown timer).
    void dt;
  }

  private updateLocalPlayer(dt: number) {
    const p = this.state.players.find((x) => x.id === this.state.localPlayerId);
    if (!p) return;

    if (p.reloadingUntil > 0 && performance.now() >= p.reloadingUntil) {
      this.finishReload(p);
    }

    if (!p.alive) {
      if (
        (this.state.phase === "warmup" || this.state.phase === "buy") &&
        this.input.wasPressed("KeyF")
      ) {
        this.respawnPlayer(p);
      }
      return;
    }

    this.applyPlayerMotor(p, dt, {
      freeCamPan: this.state.cameraMode === "free",
    });

    const dx = this.input.aimWorldX - p.x;
    const dz = this.input.aimWorldZ - p.z;
    if (dx !== 0 || dz !== 0) p.rot = Math.atan2(dx, dz);

    const slot = this.input.weaponSlotKey();
    if (slot && p.weapons[slot]) {
      p.weaponSlot = slot;
      p.reloadingUntil = 0;
      Sfx.play("ui");
    }

    if (this.input.wasPressed("KeyR")) {
      this.startReload(p);
    }

    if (this.input.wasPressed("KeyG")) {
      this.tryThrowHE(p);
    }

    // Combat only warmup + live (not buy freezetime / ended)
    if (
      this.input.isMouseDown(0) &&
      p.reloadingUntil <= 0 &&
      (this.state.phase === "live" || this.state.phase === "warmup")
    ) {
      this.tryShoot(p);
    }
  }

  private startReload(p: PlayerState) {
    if (!p.alive || p.reloadingUntil > 0) return;
    const wid = p.weapons[p.weaponSlot];
    if (!wid) return;
    const ammo = p.ammo[wid];
    if (!ammo) return;
    const until = beginReload(ammo, wid, performance.now());
    if (until !== null) {
      p.reloadingUntil = until;
      if (!p.isBot) Sfx.play("reload");
    }
  }

  private finishReload(p: PlayerState) {
    p.reloadingUntil = 0;
    const wid = p.weapons[p.weaponSlot];
    if (!wid) return;
    const ammo = p.ammo[wid];
    if (!ammo) return;
    p.ammo[wid] = completeReload(ammo, wid);
  }

  private updateBots(dt: number) {
    const now = performance.now();
    for (const bot of this.state.players) {
      if (!bot.isBot || !bot.alive) continue;
      if (bot.reloadingUntil > 0 && now >= bot.reloadingUntil) {
        this.finishReload(bot);
      }

      const timer = this.botTimers.get(bot.id) ?? {
        nextShot: 0,
        nextChat: now + 5000,
      };

      const enemies = this.state.players.filter(
        (p) => p.alive && p.team !== bot.team,
      );
      let target: PlayerState | undefined;
      let best = Infinity;
      for (const e of enemies) {
        const d = (e.x - bot.x) ** 2 + (e.z - bot.z) ** 2;
        if (d < best) {
          best = d;
          target = e;
        }
      }

      if (target) {
        const dx = target.x - bot.x;
        const dz = target.z - bot.z;
        const dist = Math.hypot(dx, dz);
        bot.rot = Math.atan2(dx, dz);

        let mx = 0;
        let mz = 0;
        if (dist > 9) {
          mx = (dx / dist) * BOT_SPEED * dt;
          mz = (dz / dist) * BOT_SPEED * dt;
        } else if (dist < 4.5) {
          mx = (-dx / dist) * BOT_SPEED * 0.55 * dt;
          mz = (-dz / dist) * BOT_SPEED * 0.55 * dt;
        } else {
          mx = (-dz / dist) * BOT_SPEED * 0.65 * dt;
          mz = (dx / dist) * BOT_SPEED * 0.65 * dt;
        }
        const resolved = resolveCircleWalls(
          bot.x + mx,
          bot.z + mz,
          PLAYER_RADIUS,
          this.collisionWalls,
        );
        bot.x = resolved.x;
        bot.z = resolved.z;

        const wid = bot.weapons[bot.weaponSlot];
        const ammo = wid ? bot.ammo[wid] : null;
        if (ammo && ammo.mag === 0 && ammo.reserve > 0) {
          this.startReload(bot);
        }

        if (dist < 22 && now >= timer.nextShot && bot.reloadingUntil <= 0) {
          this.tryShoot(bot);
          const def = wid ? WEAPONS[wid] : WEAPONS.glock;
          timer.nextShot = now + def.fireRate + Math.random() * 140;
        }

        if (now >= timer.nextChat) {
          if (dist < 12 && Math.random() < 0.5) {
            this.addChat(bot.name, pick(BOT_LINES.enemySpotted), "radio");
          } else if (Math.random() < 0.3) {
            this.addChat(bot.name, pick(BOT_LINES.taunt), "all");
          }
          timer.nextChat = now + 7000 + Math.random() * 9000;
        }
      }

      this.botTimers.set(bot.id, timer);
    }
  }

  private tryShoot(p: PlayerState) {
    const wid = p.weapons[p.weaponSlot];
    if (!wid) return;
    const def = WEAPONS[wid];
    const now = performance.now();
    if (now - p.lastShotAt < def.fireRate) return;

    if (def.isMelee) {
      p.lastShotAt = now;
      this.meleeAttack(p, def.damage, def.range);
      return;
    }

    const ammo = p.ammo[wid];
    if (!ammo || ammo.mag <= 0) {
      if (ammo && ammo.reserve > 0) this.startReload(p);
      else if (p.weapons[2] && (p.ammo[p.weapons[2]]?.mag ?? 0) > 0) {
        p.weaponSlot = 2;
      } else {
        p.weaponSlot = 4;
      }
      return;
    }

    ammo.mag -= 1;
    p.lastShotAt = now;
    if (!p.isBot) Sfx.play("shoot");

    const spread = (Math.random() - 0.5) * def.spread;
    const angle = p.rot + spread;
    const bullet: BulletState = {
      id: uid("b"),
      ownerId: p.id,
      team: p.team,
      x: p.x + Math.sin(p.rot) * 0.75,
      z: p.z + Math.cos(p.rot) * 0.75,
      vx: Math.sin(angle) * def.speed,
      vz: Math.cos(angle) * def.speed,
      damage: def.damage,
      rangeLeft: def.range,
      bornAt: now,
    };
    this.state.bullets.push(bullet);
    this.three.spawnMuzzle(p.x, p.z, p.rot);
    this.three.notifyShoot(p.id);
    // Cosmetic tracer toward aim (range estimate)
    const reach = Math.min(def.range, 40);
    this.three.spawnTracer(
      p.x + Math.sin(p.rot) * 0.7,
      1.15,
      p.z + Math.cos(p.rot) * 0.7,
      p.x + Math.sin(angle) * reach,
      1.0,
      p.z + Math.cos(angle) * reach,
    );
  }

  private meleeAttack(p: PlayerState, damage: number, range: number) {
    // Melee: no wall FX (spec — skip wall impacts for knife)
    for (const other of this.state.players) {
      if (!other.alive || other.id === p.id || other.team === p.team) continue;
      const dx = other.x - p.x;
      const dz = other.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range) continue;
      const ang = Math.atan2(dx, dz);
      let diff = ang - p.rot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 0.9) continue;
      this.applyDamage(other, p, damage, "FACA");
    }
  }

  /**
   * Networked cosmetic: raycast map walls along aim and spawn impact FX.
   * Collision topology is unchanged.
   */
  private cosmeticWallRay(
    x: number,
    z: number,
    rot: number,
    maxRange: number,
  ) {
    const dx = Math.sin(rot);
    const dz = Math.cos(rot);
    const steps = 48;
    const step = Math.min(maxRange, 60) / steps;
    let px = x + dx * 0.75;
    let pz = z + dz * 0.75;
    for (let i = 0; i < steps; i++) {
      const nx = px + dx * step;
      const nz = pz + dz * step;
      for (const w of this.map.walls) {
        if (pointInWall(nx, nz, w) && !pointInWall(px, pz, w)) {
          const hit = wallImpactAt(nx, nz, w);
          this.three.spawnImpact(
            hit.x,
            hit.y,
            hit.z,
            hit.nx,
            hit.ny,
            hit.nz,
            "wall",
          );
          return;
        }
      }
      px = nx;
      pz = nz;
    }
  }

  private updateBullets(dt: number) {
    const walls = this.map.walls;
    const next: BulletState[] = [];

    for (const b of this.state.bullets) {
      const stepX = b.vx * dt;
      const stepZ = b.vz * dt;
      const stepLen = Math.hypot(stepX, stepZ);
      const prevX = b.x;
      const prevZ = b.z;
      b.x += stepX;
      b.z += stepZ;
      b.rangeLeft -= stepLen;

      let hitWall = false;
      for (const w of walls) {
        const halfW = w.w / 2;
        const halfD = w.d / 2;
        if (
          b.x > w.x - halfW &&
          b.x < w.x + halfW &&
          b.z > w.z - halfD &&
          b.z < w.z + halfD
        ) {
          hitWall = true;
          const hit = wallImpactAt(b.x, b.z, w, prevX, prevZ);
          this.three.spawnImpact(
            hit.x,
            hit.y,
            hit.z,
            hit.nx,
            hit.ny,
            hit.nz,
            "wall",
          );
          break;
        }
      }
      if (hitWall || b.rangeLeft <= 0) {
        continue;
      }

      let hitPlayer = false;
      for (const p of this.state.players) {
        if (!p.alive || p.team === b.team || p.id === b.ownerId) continue;
        const dx = p.x - b.x;
        const dz = p.z - b.z;
        if (dx * dx + dz * dz < (PLAYER_RADIUS + BULLET_RADIUS) ** 2) {
          const owner = this.state.players.find((o) => o.id === b.ownerId);
          const weaponName =
            owner && owner.weapons[owner.weaponSlot]
              ? WEAPONS[owner.weapons[owner.weaponSlot]!].name
              : "ARMA";
          if (owner) this.applyDamage(p, owner, b.damage, weaponName);
          hitPlayer = true;
          break;
        }
      }

      if (hitPlayer) continue;
      next.push(b);
    }
    this.state.bullets = next;
  }

  private applyDamage(
    victim: PlayerState,
    killer: PlayerState,
    damage: number,
    weaponName: string,
  ) {
    if (!victim.alive) return;

    const result = applyDamageToVitals(
      { hp: victim.hp, armor: victim.armor },
      damage,
    );
    victim.hp = result.hp;
    victim.armor = result.armor;

    if (victim.id === this.state.localPlayerId) {
      this.state.damageFlashUntil = performance.now() + 220;
      this.state.lastDamageAmount = damage;
      Sfx.play("hit");
    }
    if (killer.id === this.state.localPlayerId) {
      this.state.hitMarkerUntil = performance.now() + 120;
      Sfx.play("hit");
      // Floating damage numbers for local damage dealt (Wave 5 §2.8)
      this.three.spawnDamageNumber(
        victim.x,
        1.4,
        victim.z,
        `-${Math.round(damage)}`,
      );
    }

    if (isDead(victim.hp)) {
      victim.hp = 0;
      victim.alive = false;
      victim.deaths += 1;
      killer.kills += 1;
      if (this.state.phase === "live") {
        victim.diedThisRound = true;
        killer.money = clampMoney(killer.money + KILL_REWARD);
      }

      const entry: KillFeedEntry = {
        id: uid("kf"),
        killer: killer.name,
        victim: victim.name,
        weapon: weaponName,
        at: performance.now(),
      };
      this.state.killFeed.unshift(entry);
      this.state.killFeed = this.state.killFeed.slice(0, 6);

      if (killer.isBot) {
        this.addChat(killer.name, pick(BOT_LINES.kill), "all");
      }

      if (
        victim.id === this.state.localPlayerId &&
        this.state.phase === "live"
      ) {
        this.enterSpectator(killer.id);
      }

      if (this.state.phase === "live") {
        const trAlive = this.state.players.some(
          (p) => p.team === "TR" && p.alive,
        );
        const ctAlive = this.state.players.some(
          (p) => p.team === "CT" && p.alive,
        );
        // Bomb planted: CT must defuse even if all TR dead.
        if (!trAlive && !this.bombIsDown()) this.endRound("CT");
        else if (!ctAlive) this.endRound("TR");
      }

      if (this.state.phase === "warmup") {
        setTimeout(() => {
          if (this.state.phase === "warmup" && !victim.alive) {
            this.respawnPlayer(victim);
          }
        }, 2000);
      }
    }
  }

  private addChat(from: string, text: string, kind: ChatEntry["kind"]) {
    this.state.chat.push({
      id: uid("chat"),
      from,
      text,
      kind,
      at: performance.now(),
    });
    this.state.chat = this.state.chat.slice(-8);
  }

  private pushHud() {
    if (!this.onHud) return;
    const p = this.state.players.find((x) => x.id === this.state.localPlayerId);
    if (!p) return;

    const now = performance.now();
    const wid = p.weapons[p.weaponSlot];
    const def = wid ? WEAPONS[wid] : null;
    const ammo = wid ? p.ammo[wid] : null;

    const weapons: HudSnapshot["weapons"] = [];
    for (const [slotStr, w] of Object.entries(p.weapons)) {
      if (!w) continue;
      weapons.push({
        slot: Number(slotStr),
        name: WEAPONS[w].name,
        active: Number(slotStr) === p.weaponSlot,
      });
    }
    weapons.sort((a, b) => a.slot - b.slot);

    const reloading = p.reloadingUntil > now;
    let reloadProgress = 0;
    if (reloading && def && def.reloadTime > 0) {
      const left = p.reloadingUntil - now;
      reloadProgress = 1 - left / def.reloadTime;
    }

    const spectating = !p.alive && this.state.phase === "live";
    const roundBanner =
      this.roundBannerKind && now < this.roundBannerUntil
        ? roundBannerText(this.roundBannerKind)
        : null;
    if (this.roundBannerKind && now >= this.roundBannerUntil) {
      this.roundBannerKind = null;
    }

    const bombDown =
      this.state.bombState === "planted" ||
      this.state.bombState === "defusing";

    this.onHud({
      hp: Math.max(0, Math.round(p.hp)),
      armor: Math.max(0, Math.round(p.armor)),
      money: p.money,
      mag: ammo?.mag ?? 0,
      reserve: ammo?.reserve ?? 0,
      weaponName: def?.name ?? "—",
      weaponSlot: p.weaponSlot,
      weapons,
      scoreTR: this.state.scoreTR,
      scoreCT: this.state.scoreCT,
      timeLeft: Math.max(0, this.state.timeLeft),
      phase: this.state.phase,
      round: this.state.round,
      matchOver: this.state.phase === "match_over",
      sessionId: this.sessionId,
      killFeed: this.state.killFeed,
      chat: this.state.chat,
      alive: p.alive,
      paused: this.state.paused,
      showScoreboard: this.state.showScoreboard,
      showHelp: this.state.showHelp,
      showBuyMenu: this.state.showBuyMenu,
      canBuy: canOpenBuyMenu(this.state.phase),
      cameraMode: this.state.cameraMode,
      reloading,
      reloadProgress: Math.max(0, Math.min(1, reloadProgress)),
      lowAmmo:
        !!ammo &&
        ammo.mag <= Math.ceil((def?.magazine ?? 10) * 0.25) &&
        !def?.isMelee,
      hitMarker: now < this.state.hitMarkerUntil,
      damageFlash: Math.max(0, (this.state.damageFlashUntil - now) / 220),
      mapName: this.map.displayName,
      buyMessage: this.buyMessage,
      bombState: this.state.bombState,
      bombTimer: bombDown ? this.state.bombTimer : 0,
      plantProgress: this.state.plantProgress,
      defuseProgress: this.state.defuseProgress,
      bombPrompt: this.computeBombPrompt(p),
      roundBanner,
      spectating,
      perf: this.showFps
        ? {
            fps: this.fpsDisplay,
            drawCalls: this.lastDrawCalls,
            triangles: this.lastTriangles,
            p50Ms: Math.round(this.perfP50Ms * 10) / 10,
            p95Ms: Math.round(this.perfP95Ms * 10) / 10,
            cpuMsP95: Math.round(this.perfCpuP95Ms * 10) / 10,
            renderMsP95: Math.round(this.perfRenderP95Ms * 10) / 10,
            autoEnabled: this.autoQuality,
            userTierMax: this.userTierMax,
            adaptReason: this.lastAdaptReason,
            knobs: this.three.getRuntimeKnobs(),
          }
        : null,
      minimap: this.state.players.map((pl) => ({
        id: pl.id,
        x: pl.x,
        z: pl.z,
        team: pl.team,
        isLocal: pl.id === this.state.localPlayerId,
        alive: pl.alive,
      })),
      scoreboard: this.state.players
        .map((pl) => ({
          id: pl.id,
          name: pl.name,
          team: pl.team,
          kills: pl.kills,
          deaths: pl.deaths,
          money: pl.money,
          alive: pl.alive,
          isLocal: pl.id === this.state.localPlayerId,
          isBot: pl.isBot,
        }))
        .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths),
    });
  }
}
