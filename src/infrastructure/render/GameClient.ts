import * as THREE from "three";
import { recordImpression } from "@/domains/ads";
import {
  applyDamage as applyDamageToVitals,
  beginReload,
  canOpenBuyMenu,
  completeReload,
  isDead,
  tryBuy,
  WEAPONS,
} from "@/domains/combat";
import { Sfx } from "@/infrastructure/audio/Sfx";
import { getOrCreateSessionId, recordMatchResult } from "@/domains/identity";
import {
  createMatchPhase,
  moneyAfterRound,
  onRoundWin,
  tickPhase,
  type MatchPhaseState,
} from "@/domains/match";
import { pushImpression } from "@/infrastructure/analytics/queue";
import {
  BOT_LINES,
  BOT_NAMES,
  BOT_SPEED,
  BULLET_RADIUS,
  DEFAULT_MATCH,
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
  Team,
  WeaponId,
} from "@/game/types";
import {
  MAP_DUST,
  mapCollisionWalls,
  resolveCircleWalls,
  type GameMap,
} from "@/game/world/maps";
import { Input } from "./input";
import { ThreeRenderer } from "./ThreeRenderer";

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
  readonly map: GameMap = MAP_DUST;
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
  private collisionWalls = mapCollisionWalls(MAP_DUST);
  private helpSeenKey = "ff_help_seen";
  private sessionId = "server";
  private mapImpressionsRecorded = false;
  private freeCamX = 0;
  private freeCamZ = 0;
  private footCooldown = 0;
  private buyMessage: string | null = null;
  private buyMessageUntil = 0;
  /** Fire `recordMatchResult` once per match_over transition. */
  private missionMatchRecorded = false;
  /** When true, combat/bots come from Colyseus; local only predicts movement. */
  private networked = false;
  private networkSessionId: string | null = null;
  /** When set (room mode), purchases go to the server instead of local tryBuy. */
  private buySender: ((itemId: string) => void) | null = null;
  private matchConfig = {
    warmupTime: WARMUP_TIME,
    roundTime: ROUND_TIME,
    endPause: DEFAULT_MATCH.endPause,
    roundsToWin: ROUNDS_TO_WIN,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.three = new ThreeRenderer(canvas, this.map);
    this.scene = this.three.scene;
    this.camera = this.three.camera;
    this.renderer = this.three.renderer;

    this.sessionId = getOrCreateSessionId();
    this.state = this.createInitialState();
    this.initBotTimers();
    this.input.bind();
    // Seed meshes from initial players
    this.syncRender();
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
    }>;
    phase: string | null;
    round: number;
    scoreTR: number;
    scoreCT: number;
    timeLeft: number;
  }) {
    if (!this.networked) return;
    this.networkSessionId = net.sessionId;
    const prevPhase = this.state.phase;

    if (net.phase === "warmup" || net.phase === "live" || net.phase === "ended" || net.phase === "match_over") {
      this.state.phase = net.phase;
    }
    this.state.round = net.round;
    this.state.scoreTR = net.scoreTR;
    this.state.scoreCT = net.scoreCT;
    this.state.timeLeft = net.timeLeft;

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

      nextPlayers.push({
        id: np.id,
        name: np.name,
        team,
        isBot: np.isBot,
        x,
        z,
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
        color: TEAM_COLORS[team],
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

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(dt);
      this.three.render();
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
      cameraMode: "locked",
      hitMarkerUntil: 0,
      damageFlashUntil: 0,
      lastDamageAmount: 0,
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
      rot: team === "TR" ? Math.PI / 4 : (-3 * Math.PI) / 4,
      hp: 100,
      armor: team === "CT" ? 50 : 0,
      money: START_MONEY,
      weaponSlot: 2,
      weapons,
      ammo,
      alive: true,
      kills: 0,
      deaths: 0,
      assists: 0,
      lastShotAt: 0,
      reloadingUntil: 0,
      color: TEAM_COLORS[team],
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
      this.state.cameraMode =
        this.state.cameraMode === "locked" ? "free" : "locked";
      Sfx.play("ui");
      const local = this.state.players.find(
        (x) => x.id === this.state.localPlayerId,
      );
      if (local) {
        this.freeCamX = local.x;
        this.freeCamZ = local.z;
      }
    }

    if (this.input.wasPressed("KeyB")) {
      if (canOpenBuyMenu(this.state.phase) && !this.state.paused) {
        this.state.showBuyMenu = !this.state.showBuyMenu;
        Sfx.play("ui");
      } else if (!canOpenBuyMenu(this.state.phase)) {
        this.flashBuyMessage("Loja só no aquecimento ou entre rounds");
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
    this.three.animateDust(dt);
    this.three.updateFx(dt);
    this.syncRender();
    this.pushHud();
    this.input.endFrame();
  }

  /** Client prediction while server is authoritative. */
  private updateLocalPlayerNetworked(dt: number) {
    const p = this.state.players.find((x) => x.id === this.state.localPlayerId);
    if (!p || !p.alive) return;

    const move = this.input.moveVector();
    if (this.state.cameraMode === "free") {
      const pan = PLAYER_SPEED * 1.8 * dt;
      this.freeCamX += move.x * pan;
      this.freeCamZ += move.z * pan;
    } else if (move.x !== 0 || move.z !== 0) {
      const nx = p.x + move.x * PLAYER_SPEED * dt;
      const nz = p.z + move.z * PLAYER_SPEED * dt;
      const resolved = resolveCircleWalls(
        nx,
        nz,
        PLAYER_RADIUS,
        this.collisionWalls,
      );
      p.x = resolved.x;
      p.z = resolved.z;
      this.footCooldown -= dt;
      if (this.footCooldown <= 0) {
        Sfx.play("foot");
        this.footCooldown = 0.32;
      }
    }

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
    this.three.sync({
      players: this.state.players.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        isBot: p.isBot,
        x: p.x,
        z: p.z,
        rot: p.rot,
        alive: p.alive,
        color: p.color,
        weaponSlot: p.weaponSlot,
        weaponId: p.weapons[p.weaponSlot],
      })),
      bullets: this.state.bullets,
      localPlayerId: this.state.localPlayerId,
      cameraMode: this.state.cameraMode,
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
      this.applyRoundEndEffects("CT");
    }

    if (
      next.phase === "live" &&
      (prev.phase === "warmup" || prev.phase === "ended")
    ) {
      if (prev.phase === "warmup") {
        this.recordMapAdImpressions();
      }
      this.beginLiveRoundEffects();
    }

    if (next.phase === "match_over" && prev.phase !== "match_over") {
      this.maybeRecordMissionResult();
    } else if (next.phase !== "match_over") {
      this.missionMatchRecorded = false;
    }
  }

  /** Grant daily mission progress once when the match finishes. */
  private maybeRecordMissionResult() {
    if (this.state.phase !== "match_over" || this.missionMatchRecorded) return;
    this.missionMatchRecorded = true;

    const local = this.state.players.find(
      (p) => p.id === this.state.localPlayerId,
    );
    if (!local) return;

    const won =
      (local.team === "TR" && this.state.scoreTR > this.state.scoreCT) ||
      (local.team === "CT" && this.state.scoreCT > this.state.scoreTR);

    const { xpGranted } = recordMatchResult({
      won,
      kills: local.kills,
    });

    if (xpGranted > 0) {
      const msg = `Missão completa! +${xpGranted} XP`;
      this.flashBuyMessage(msg);
      this.addChat("SYSTEM", msg, "system");
    }
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

  private beginLiveRoundEffects() {
    this.state.bullets = [];
    this.addChat("SYSTEM", `ROUND ${this.state.round} — boa sorte`, "system");
    for (const p of this.state.players) this.respawnPlayer(p);
  }

  private applyRoundEndEffects(winner: Team) {
    this.addChat("SYSTEM", `${winner} venceu o round!`, "system");
    for (const p of this.state.players) {
      p.money = moneyAfterRound(p.team, winner, p.money);
    }
  }

  private endRound(winner: Team) {
    if (this.state.phase !== "live") return;
    const next = onRoundWin(this.toPhaseState(), winner);
    this.applyPhaseState(next);
    this.applyRoundEndEffects(winner);
    if (next.phase === "match_over") {
      this.maybeRecordMissionResult();
    }
  }

  private respawnPlayer(p: PlayerState) {
    const spawns = this.map.spawns.filter((s) => s.team === p.team);
    const spawn = spawns[Math.floor(Math.random() * spawns.length)]!;
    p.x = spawn.x + (Math.random() - 0.5);
    p.z = spawn.z + (Math.random() - 0.5);
    p.hp = 100;
    p.alive = true;
    p.reloadingUntil = 0;
    p.rot = p.team === "TR" ? Math.PI / 4 : (-3 * Math.PI) / 4;
    for (const [wid, ammo] of Object.entries(p.ammo)) {
      if (!ammo) continue;
      p.ammo[wid as WeaponId] = completeReload(ammo, wid as WeaponId);
    }
  }

  private updateLocalPlayer(dt: number) {
    const p = this.state.players.find((x) => x.id === this.state.localPlayerId);
    if (!p) return;

    if (p.reloadingUntil > 0 && performance.now() >= p.reloadingUntil) {
      this.finishReload(p);
    }

    if (!p.alive) {
      if (this.state.phase === "warmup" && this.input.wasPressed("KeyF")) {
        this.respawnPlayer(p);
      }
      return;
    }

    const move = this.input.moveVector();
    if (this.state.cameraMode === "free") {
      // Free cam: WASD pans view; player stays (still aims/shoots)
      const pan = PLAYER_SPEED * 1.8 * dt;
      this.freeCamX += move.x * pan;
      this.freeCamZ += move.z * pan;
    } else if (move.x !== 0 || move.z !== 0) {
      const nx = p.x + move.x * PLAYER_SPEED * dt;
      const nz = p.z + move.z * PLAYER_SPEED * dt;
      const resolved = resolveCircleWalls(
        nx,
        nz,
        PLAYER_RADIUS,
        this.collisionWalls,
      );
      p.x = resolved.x;
      p.z = resolved.z;
      this.footCooldown -= dt;
      if (this.footCooldown <= 0) {
        Sfx.play("foot");
        this.footCooldown = 0.32;
      }
    }

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

    if (this.input.isMouseDown(0) && p.reloadingUntil <= 0) {
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
    }

    if (isDead(victim.hp)) {
      victim.hp = 0;
      victim.alive = false;
      victim.deaths += 1;
      killer.kills += 1;

      if (this.state.phase === "live") killer.money += KILL_REWARD;

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

      if (this.state.phase === "live") {
        const trAlive = this.state.players.some(
          (p) => p.team === "TR" && p.alive,
        );
        const ctAlive = this.state.players.some(
          (p) => p.team === "CT" && p.alive,
        );
        if (!trAlive) this.endRound("CT");
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
