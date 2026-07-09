import * as THREE from "three";
import { recordImpression } from "@/domains/ads";
import {
  applyDamage as applyDamageToVitals,
  beginReload,
  completeReload,
  isDead,
  WEAPONS,
} from "@/domains/combat";
import { getOrCreateSessionId } from "@/domains/identity";
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
    const primary: WeaponId = team === "TR" ? "ak47" : "usp";
    const secondary: WeaponId = team === "TR" ? "glock" : "deagle";

    const weapons: PlayerState["weapons"] = {
      1: primary,
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
      this.togglePause();
    }
    if (this.input.wasPressed("KeyH")) {
      if (this.state.showHelp) this.dismissHelp();
      else this.state.showHelp = true;
    }
    this.state.showScoreboard = this.input.isDown("Tab");

    if (this.state.paused || this.state.showHelp) {
      this.pushHud();
      this.input.endFrame();
      return;
    }

    if (this.state.phase !== "match_over") {
      this.updateAim();
      this.updateTimer(dt);
    }

    if (this.state.phase === "match_over") {
      this.pushHud();
      this.input.endFrame();
      return;
    }

    this.updateLocalPlayer(dt);
    this.updateBots(dt);
    this.updateBullets(dt);
    this.three.animateDust(dt);
    this.syncRender();
    this.pushHud();
    this.input.endFrame();
  }

  private syncRender() {
    this.three.sync({
      players: this.state.players,
      bullets: this.state.bullets,
      localPlayerId: this.state.localPlayerId,
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
    if (move.x !== 0 || move.z !== 0) {
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
    }

    const dx = this.input.aimWorldX - p.x;
    const dz = this.input.aimWorldZ - p.z;
    if (dx !== 0 || dz !== 0) p.rot = Math.atan2(dx, dz);

    const slot = this.input.weaponSlotKey();
    if (slot && p.weapons[slot]) {
      p.weaponSlot = slot;
      p.reloadingUntil = 0;
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
    if (until !== null) p.reloadingUntil = until;
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
    this.three.spawnMuzzleFlash(p.x, p.z, p.rot, now + 45);
  }

  private meleeAttack(p: PlayerState, damage: number, range: number) {
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

  private updateBullets(dt: number) {
    const walls = this.map.walls;
    const next: BulletState[] = [];

    for (const b of this.state.bullets) {
      const stepX = b.vx * dt;
      const stepZ = b.vz * dt;
      const stepLen = Math.hypot(stepX, stepZ);
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
    }
    if (killer.id === this.state.localPlayerId) {
      this.state.hitMarkerUntil = performance.now() + 120;
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
      reloading,
      reloadProgress: Math.max(0, Math.min(1, reloadProgress)),
      lowAmmo:
        !!ammo &&
        ammo.mag <= Math.ceil((def?.magazine ?? 10) * 0.25) &&
        !def?.isMelee,
      hitMarker: now < this.state.hitMarkerUntil,
      damageFlash: Math.max(0, (this.state.damageFlashUntil - now) / 220),
      mapName: this.map.displayName,
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
