import { Room, Client } from "colyseus";
import {
  MatchState,
  PlayerState,
  type BuyMessage,
  type InputMessage,
} from "../schema/MatchState";
import {
  canDefuse,
  canPlant,
  createBombState,
  DEFUSE_RADIUS,
  explode,
  findSiteAt,
  getBombSites,
  isBombPlantedActive,
  onDefuseComplete,
  onPlantComplete,
  pickBombCarrier,
  resetBombForRound,
  tickBombTimer,
  tickDefuse,
  tickPlant,
  type BombSimState,
  type RoundEndReason,
} from "../sim/bomb";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "../sim/codes";
import {
  createHeProjectile,
  heDamageAtDistance,
  heImpactPoint,
  tickHeProjectile,
  type HeProjectile,
} from "../sim/he";
import {
  createMatchPhase,
  onRoundWin,
  tickPhase,
  type MatchPhaseState,
  type Team,
} from "../sim/phases";
import {
  activeWeaponStats,
  canBuyInPhase,
  ownsSlot,
  tryBuy,
  type AmmoMap,
} from "../sim/shop";
import {
  botPrimary,
  cooldownSec,
  fullAmmo,
  getWeapon,
  START_MONEY,
  starterSecondary,
  WEAPONS,
} from "../sim/weapons";
import { tickMotor } from "../sim/motor";
import {
  applyDamage,
  BOT_SPEED,
  HIT_RADIUS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  resolveCircleWalls,
  segmentBlockedByWalls,
  spawnsForTeam,
  wallsForMap,
  type WallRect,
} from "../sim/world";

const MATCH_SIZE = 6;
const TICK_MS = 50; // 20 Hz
const BOT_NAMES = ["Lucão", "Pedrão", "Enzo", "Davi", "Theo", "Rafa"];
const KILL_REWARD = 300;
const ROUND_WIN_REWARD = 3250;
const ROUND_LOSS_REWARD = 1400;
/** Warmup respawn delay — short so deaths don't feel like a soft-lock. */
const WARMUP_RESPAWN_MS = 1200;

/** Known maps for room create / browser metadata */
const MAPS: Record<string, string> = {
  dust: "Dust FF",
  favela: "Favela",
  yard: "Yard",
};

const DEFAULT_MAP_ID = "dust";

export type RoomVisibility = "public" | "private";
export type RoomRegion = "BR" | "US";

export type GameRoomOptions = {
  code?: string;
  name?: string;
  mapId?: string;
  roomName?: string;
  /** Browser listing: public (default) or private */
  visibility?: RoomVisibility | string;
  /** Creator region tag for browser filter (default BR) */
  region?: RoomRegion | string;
};

export type GameRoomMetadata = {
  code: string;
  mapId: string;
  mapName: string;
  roomName: string;
  visibility: RoomVisibility;
  region: RoomRegion;
  phase?: string;
};

function resolveMap(mapId?: string): { mapId: string; mapName: string } {
  const id =
    typeof mapId === "string" && mapId in MAPS ? mapId : DEFAULT_MAP_ID;
  return { mapId: id, mapName: MAPS[id]! };
}

function resolveVisibility(raw?: string): RoomVisibility {
  return raw === "private" ? "private" : "public";
}

function resolveRegion(raw?: string): RoomRegion {
  return raw === "US" ? "US" : "BR";
}

type RuntimeExtra = {
  fireCd: number;
  aimX: number;
  aimZ: number;
  /** Per-weapon ammo (primary/secondary ids). */
  ammo: AmmoMap;
  /** Edge-detect HE throw (hold G). */
  heHeld: boolean;
  /** Edge-detect jump (Space). */
  jumpHeld: boolean;
};

/**
 * Authoritative private match: movement, hitscan fire, bots, rounds, shop,
 * C4 plant/defuse, simplified HE.
 * `maxClients` (= MATCH_SIZE) is enforced by Colyseus; we also reject in
 * onAuth/onJoin with "Sala cheia" for a clear client-facing message.
 */
export class GameRoom extends Room<MatchState> {
  maxClients = MATCH_SIZE;

  private phase: MatchPhaseState = createMatchPhase();
  private botSeq = 0;
  private inputs = new Map<string, InputMessage>();
  private extras = new Map<string, RuntimeExtra>();
  private bomb: BombSimState = createBombState();
  private heProjectiles: HeProjectile[] = [];
  private heSeq = 0;
  /** Collision + cover for current map (hitscan cannot ignore walls). */
  private walls: WallRect[] = wallsForMap("dust");

  async onCreate(options: GameRoomOptions = {}) {
    this.setState(new MatchState());
    this.state.authoritative = true;

    const code = this.resolveCode(options.code);
    const { mapId, mapName } = resolveMap(options.mapId);
    this.walls = wallsForMap(mapId);
    const roomName =
      typeof options.roomName === "string"
        ? options.roomName.trim().slice(0, 32)
        : "";
    const visibility = resolveVisibility(
      typeof options.visibility === "string" ? options.visibility : undefined,
    );
    const region = resolveRegion(
      typeof options.region === "string" ? options.region : undefined,
    );

    this.state.code = code;
    this.state.mapId = mapId;
    this.state.mapName = mapName;
    this.state.roomName = roomName;
    this.state.visibility = visibility;
    this.state.region = region;

    (this.listing as { code?: string }).code = code;
    await this.setMetadata({
      code,
      mapId,
      mapName,
      roomName,
      visibility,
      region,
      phase: this.state.phase,
    } satisfies GameRoomMetadata);

    this.applyPhaseToState();
    this.syncBombToState();
    this.syncBots();

    this.setSimulationInterval((deltaMs) => this.tick(deltaMs / 1000), TICK_MS);

    this.onMessage("input", (client, message: Partial<InputMessage>) => {
      const dx = Number(message?.dx) || 0;
      const dz = Number(message?.dz) || 0;
      const len = Math.hypot(dx, dz) || 1;
      this.inputs.set(client.sessionId, {
        dx: dx / len,
        dz: dz / len,
        aimX: Number(message?.aimX) || 0,
        aimZ: Number(message?.aimZ) || 0,
        fire: Boolean(message?.fire),
        reload: Boolean(message?.reload),
        slot: Number(message?.slot) || 0,
        plant: Boolean(message?.plant),
        he: Boolean(message?.he),
        jump: Boolean(message?.jump),
        crouch: Boolean(message?.crouch),
      });
    });

    this.onMessage("buy", (client, message: Partial<BuyMessage>) => {
      this.handleBuy(client, message?.itemId);
    });

    this.onMessage("ping", (client) => {
      client.send("pong", { t: Date.now() });
    });

    console.log(
      `[GameRoom] created code=${code} map=${mapId} region=${region} visibility=${visibility} roomId=${this.roomId} auth=1`,
    );
  }

  onAuth(_client: Client, options: GameRoomOptions) {
    // Prefer clear message over Colyseus default full-room rejection.
    if (this.clients.length >= this.maxClients) {
      throw new Error("Sala cheia");
    }
    if (options?.code) {
      const code = normalizeRoomCode(options.code);
      if (!isValidRoomCode(code) || code !== this.state.code) {
        throw new Error("Invalid room code");
      }
    }
    return true;
  }

  onJoin(client: Client, options: GameRoomOptions = {}) {
    // Client already counted in this.clients; reject if over max (race/safety).
    if (this.clients.length > this.maxClients) {
      throw new Error("Sala cheia");
    }

    const name =
      (typeof options.name === "string" && options.name.trim()) ||
      `Player ${this.clients.length}`;

    const botKey = this.findBotKey();
    if (botKey) {
      this.state.players.delete(botKey);
      this.extras.delete(botKey);
      this.inputs.delete(botKey);
    }

    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = name.slice(0, 24);
    player.team = this.nextTeam();
    player.isBot = false;
    player.hp = 100;
    player.armor = 0;
    player.alive = true;
    player.kills = 0;
    player.deaths = 0;
    this.applySpawn(player);
    const ammo = this.applyHumanLoadout(player);

    this.state.players.set(client.sessionId, player);
    this.extras.set(client.sessionId, {
      fireCd: 0,
      aimX: player.x,
      aimZ: player.z,
      ammo,
      heHeld: false,
      jumpHeld: false,
    });
    this.syncBots();

    console.log(
      `[GameRoom] join ${client.sessionId} name=${player.name} team=${player.team}`,
    );
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.extras.delete(client.sessionId);
    this.syncBots();
  }

  onDispose() {
    console.log(`[GameRoom] dispose code=${this.state.code}`);
  }

  private handleBuy(client: Client, itemId: unknown) {
    if (typeof itemId !== "string" || !itemId) return;
    if (!canBuyInPhase(this.phase.phase)) return;

    const p = this.state.players.get(client.sessionId);
    if (!p || p.isBot || !p.alive) return;

    const ex = this.ensureExtra(p.id, p);
    const result = tryBuy(
      {
        money: p.money,
        armor: p.armor,
        primaryId: p.primaryId,
        secondaryId: p.secondaryId,
        activeSlot: p.activeSlot,
        mag: p.mag,
        reserve: p.reserve,
        heCount: p.heCount,
      },
      itemId,
      ex.ammo,
    );

    if (!result.ok || !result.player) return;

    p.money = result.player.money;
    p.armor = result.player.armor;
    p.primaryId = result.player.primaryId;
    p.secondaryId = result.player.secondaryId;
    p.activeSlot = result.player.activeSlot;
    p.mag = result.player.mag;
    p.reserve = result.player.reserve;
    p.heCount = result.player.heCount;
    if (result.ammo) ex.ammo = result.ammo;
  }

  private tick(dt: number) {
    const prev = this.phase.phase;
    const bombActive = isBombPlantedActive(this.bomb);

    // While bomb is planted, round clock does not CT-win on expiry (CS style).
    if (this.phase.phase === "live" && bombActive) {
      const tl = this.phase.timeLeft - dt;
      this.phase = { ...this.phase, timeLeft: Math.max(0, tl) };
    } else {
      this.phase = tickPhase(this.phase, dt);
    }
    this.applyPhaseToState();

    // Timer expired live → CT win (tickPhase already advanced phase)
    if (
      prev === "live" &&
      (this.phase.phase === "ended" || this.phase.phase === "match_over")
    ) {
      this.state.roundEndReason = "time";
      this.payoutRound("CT");
      this.heProjectiles = [];
      this.syncBombToState();
    }

    // Enter buy freezetime → spawn + bomb carrier
    if (this.phase.phase === "buy" && prev !== "buy") {
      this.respawnAll();
      this.assignBombCarrier();
      this.heProjectiles = [];
    }

    // Buy → live combat (no re-buy)
    if (this.phase.phase === "live" && prev === "buy") {
      this.heProjectiles = [];
    }

    if (this.phase.phase === "match_over") {
      return;
    }

    // Decay fire cooldowns
    this.extras.forEach((ex) => {
      ex.fireCd = Math.max(0, ex.fireCd - dt);
    });

    // Humans
    this.state.players.forEach((p, key) => {
      if (p.isBot || !p.alive) return;
      // Move during warmup / buy / live; combat inputs still gated in tryFire
      if (
        this.phase.phase !== "live" &&
        this.phase.phase !== "warmup" &&
        this.phase.phase !== "buy"
      ) {
        return;
      }
      const input = this.inputs.get(key);
      const ex = this.ensureExtra(key, p);
      if (!input) return;

      // Jump edge + crouch hold + XZ walls (same motor as client)
      const jumpEdge = Boolean(input.jump) && !ex.jumpHeld;
      ex.jumpHeld = Boolean(input.jump);
      const next = tickMotor(
        {
          x: p.x,
          z: p.z,
          y: p.y,
          vy: p.vy,
          crouching: p.crouching,
          onGround: p.onGround,
        },
        {
          wishX: input.dx,
          wishZ: input.dz,
          jump: jumpEdge,
          crouch: Boolean(input.crouch),
          dt,
          standSpeed: PLAYER_SPEED,
          walls: this.walls,
        },
      );
      p.x = next.x;
      p.z = next.z;
      p.y = next.y;
      p.vy = next.vy;
      p.crouching = next.crouching;
      p.onGround = next.onGround;

      const adx = input.aimX - p.x;
      const adz = input.aimZ - p.z;
      if (adx !== 0 || adz !== 0) {
        p.rot = Math.atan2(adx, adz);
        ex.aimX = input.aimX;
        ex.aimZ = input.aimZ;
      }

      if (input.slot === 1 || input.slot === 2 || input.slot === 4) {
        this.tryEquipSlot(p, ex, input.slot);
      }

      if (input.reload) {
        this.tryReload(p, ex);
      }

      if (input.fire && ex.fireCd <= 0) {
        this.tryFire(p, ex);
      }

      // HE throw (edge on he:true)
      if (input.he && !ex.heHeld) {
        this.tryThrowHe(p, ex);
      }
      ex.heHeld = input.he;
    });

    // Bots
    if (this.phase.phase === "live" || this.phase.phase === "warmup") {
      this.tickBots(dt);
    }

    // HE fuse + blast
    if (this.phase.phase === "live" || this.phase.phase === "warmup") {
      this.tickHe(dt);
    }

    // C4 plant / defuse / explode (live only)
    if (this.phase.phase === "live") {
      this.tickBombSim(dt);
    }

    // Round wipe check (live only)
    if (this.phase.phase === "live") {
      this.checkWipe();
    }
  }

  private tickBots(dt: number) {
    const list: PlayerState[] = [];
    this.state.players.forEach((p) => list.push(p));
    // Warmup: bots idle / walk only — no shooting.
    // Infinite-death bug: 4 bots with AK/M4 + wallhack hitscan melted players on join.
    const canShoot = this.phase.phase === "live";

    for (const bot of list) {
      if (!bot.isBot || !bot.alive) continue;
      const ex = this.ensureExtra(bot.id, bot);

      let target: PlayerState | undefined;
      let best = Infinity;
      for (const e of list) {
        if (!e.alive || e.team === bot.team) continue;
        const d = (e.x - bot.x) ** 2 + (e.z - bot.z) ** 2;
        if (d < best) {
          best = d;
          target = e;
        }
      }
      if (!target) {
        // Warmup wander when no enemy (or still pick nothing)
        if (!canShoot) {
          const t = Date.now() * 0.001 + bot.id.length;
          const r = resolveCircleWalls(
            bot.x + Math.sin(t) * BOT_SPEED * 0.35 * dt,
            bot.z + Math.cos(t) * BOT_SPEED * 0.35 * dt,
            PLAYER_RADIUS,
            this.walls,
          );
          bot.x = r.x;
          bot.z = r.z;
        }
        continue;
      }

      const dx = target.x - bot.x;
      const dz = target.z - bot.z;
      const dist = Math.hypot(dx, dz) || 1;
      bot.rot = Math.atan2(dx, dz);
      ex.aimX = target.x;
      ex.aimZ = target.z;

      let mx = 0;
      let mz = 0;
      if (!canShoot) {
        // Warmup: light patrol only — stay near spawn, don't chase hard
        const t = Date.now() * 0.002 + bot.x;
        mx = Math.sin(t) * BOT_SPEED * 0.25 * dt;
        mz = Math.cos(t) * BOT_SPEED * 0.25 * dt;
      } else if (dist > 10) {
        mx = (dx / dist) * BOT_SPEED * dt;
        mz = (dz / dist) * BOT_SPEED * dt;
      } else if (dist < 5) {
        mx = (-dx / dist) * BOT_SPEED * 0.5 * dt;
        mz = (-dz / dist) * BOT_SPEED * 0.5 * dt;
      } else {
        mx = (-dz / dist) * BOT_SPEED * 0.6 * dt;
        mz = (dx / dist) * BOT_SPEED * 0.6 * dt;
      }
      const r = resolveCircleWalls(
        bot.x + mx,
        bot.z + mz,
        PLAYER_RADIUS,
        this.walls,
      );
      bot.x = r.x;
      bot.z = r.z;

      if (!canShoot) continue;

      // Prefer primary if owned and has ammo
      if (bot.primaryId && bot.activeSlot !== 1) {
        const primaryAmmo = ex.ammo[bot.primaryId];
        if (primaryAmmo && (primaryAmmo.mag > 0 || primaryAmmo.reserve > 0)) {
          this.tryEquipSlot(bot, ex, 1);
        }
      }

      const w = activeWeaponStats(bot.primaryId, bot.secondaryId, bot.activeSlot);
      const range = w?.range ?? 28;
      if (dist < range && ex.fireCd <= 0) {
        this.tryFire(bot, ex);
        // small jitter already via weapon cooldown
        if (ex.fireCd > 0) {
          ex.fireCd += Math.random() * 0.08;
        }
      }
    }
  }

  private tryEquipSlot(p: PlayerState, ex: RuntimeExtra, slot: number) {
    if (!ownsSlot(p.primaryId, p.secondaryId, slot)) return;
    if (p.activeSlot === slot) return;

    // Persist current firearm ammo
    this.persistActiveAmmo(p, ex);

    p.activeSlot = slot;
    this.syncActiveAmmo(p, ex);
  }

  private tryReload(p: PlayerState, ex: RuntimeExtra) {
    const w = activeWeaponStats(p.primaryId, p.secondaryId, p.activeSlot);
    if (!w || w.isMelee) return;
    if (p.mag >= w.magazine) return;
    if (p.reserve <= 0) return;

    const need = w.magazine - p.mag;
    const take = Math.min(need, p.reserve);
    p.mag += take;
    p.reserve -= take;
    ex.ammo[w.id] = { mag: p.mag, reserve: p.reserve };
  }

  private tryFire(p: PlayerState, ex: RuntimeExtra) {
    // No combat during buy freezetime (shop only)
    if (this.phase.phase === "buy" || this.phase.phase === "ended") return;
    const w = activeWeaponStats(p.primaryId, p.secondaryId, p.activeSlot);
    if (!w) return;

    if (w.isMelee) {
      ex.fireCd = cooldownSec(w);
      this.hitscan(p, w.damage, w.range);
      return;
    }

    if (p.mag <= 0) {
      // empty: try reload once, no shot
      this.tryReload(p, ex);
      return;
    }

    p.mag -= 1;
    ex.ammo[w.id] = { mag: p.mag, reserve: p.reserve };
    ex.fireCd = cooldownSec(w);
    this.hitscan(p, w.damage, w.range);
  }

  private hitscan(shooter: PlayerState, damage: number, maxRange: number) {
    // Bots never deal damage in warmup (belt + suspenders with tickBots).
    if (shooter.isBot && this.phase.phase !== "live") return;

    const dirX = Math.sin(shooter.rot);
    const dirZ = Math.cos(shooter.rot);
    let bestT = maxRange;
    let hit: PlayerState | undefined;

    this.state.players.forEach((other) => {
      if (!other.alive || other.id === shooter.id || other.team === shooter.team)
        return;
      const ox = other.x - shooter.x;
      const oz = other.z - shooter.z;
      const t = ox * dirX + oz * dirZ;
      if (t < 0 || t > maxRange) return;
      const cx = shooter.x + dirX * t;
      const cz = shooter.z + dirZ * t;
      const dist = Math.hypot(other.x - cx, other.z - cz);
      if (dist < HIT_RADIUS && t < bestT) {
        // Cover blocks bullets (was infinite LOS → spawn camp death loop)
        if (
          segmentBlockedByWalls(
            shooter.x,
            shooter.z,
            other.x,
            other.z,
            this.walls,
          )
        ) {
          return;
        }
        bestT = t;
        hit = other;
      }
    });

    if (!hit) return;
    const dmg = applyDamage(hit.hp, hit.armor, damage);
    hit.hp = dmg.hp;
    hit.armor = dmg.armor;
    if (hit.hp <= 0) {
      hit.hp = 0;
      hit.alive = false;
      hit.deaths += 1;
      shooter.kills += 1;
      if (this.phase.phase === "live") {
        shooter.money += KILL_REWARD;
      }

      if (this.phase.phase === "warmup") {
        const id = hit.id;
        this.clock.setTimeout(() => {
          const p = this.state.players.get(id);
          if (p && this.phase.phase === "warmup" && !p.alive) {
            this.respawnOne(p);
          }
        }, WARMUP_RESPAWN_MS);
      }
    }
  }

  private checkWipe() {
    // Bomb already resolved this round
    if (
      this.bomb.bombState === "exploded" ||
      this.bomb.bombState === "defused"
    ) {
      return;
    }
    let tr = 0;
    let ct = 0;
    this.state.players.forEach((p) => {
      if (!p.alive) return;
      if (p.team === "TR") tr += 1;
      else ct += 1;
    });
    // If bomb is planted and all CT dead → TR win (wipe); all TR dead → CT win
    // even while bomb planted (classic: CTs can still defuse if TRs dead — actually
    // in CS if all TRs die and bomb is planted, CTs must defuse). Spec: wipe still
    // works; if bomb planted and all CT dead → TR win.
    if (tr === 0 && ct > 0) {
      if (isBombPlantedActive(this.bomb)) {
        // CTs remain to defuse — do not end yet
        return;
      }
      this.finishRound("CT", "elimination");
    } else if (ct === 0 && tr > 0) {
      this.finishRound("TR", "elimination");
    }
  }

  /** End live round with reason (idempotent if already ended). */
  private finishRound(winner: Team, reason: RoundEndReason) {
    if (this.phase.phase !== "live") return;
    this.state.roundEndReason = reason;
    this.phase = onRoundWin(this.phase, winner);
    this.applyPhaseToState();
    this.payoutRound(winner);
    this.heProjectiles = [];
    this.syncBombToState();
  }

  private payoutRound(winner: Team) {
    this.state.players.forEach((p) => {
      p.money += p.team === winner ? ROUND_WIN_REWARD : ROUND_LOSS_REWARD;
    });
  }

  private assignBombCarrier() {
    const trIds: string[] = [];
    this.state.players.forEach((p) => {
      if (p.team === "TR" && p.alive) trIds.push(p.id);
    });
    const carrierId = pickBombCarrier(trIds);
    this.bomb = resetBombForRound(carrierId);
    this.state.roundEndReason = "";
    this.heProjectiles = [];
    this.syncBombToState();
  }

  private tickBombSim(dt: number) {
    if (
      this.bomb.bombState === "exploded" ||
      this.bomb.bombState === "defused"
    ) {
      return;
    }

    const sites = getBombSites(this.state.mapId);
    let bomb = this.bomb;

    // Carrier died while holding → reassign to living TR
    if (
      (bomb.bombState === "carried" || bomb.bombState === "planting") &&
      bomb.bombCarrierId
    ) {
      const carrier = this.state.players.get(bomb.bombCarrierId);
      if (!carrier || !carrier.alive || carrier.team !== "TR") {
        const trIds: string[] = [];
        this.state.players.forEach((p) => {
          if (p.team === "TR" && p.alive) trIds.push(p.id);
        });
        const next = pickBombCarrier(trIds);
        bomb = {
          ...bomb,
          bombState: "carried",
          bombCarrierId: next || null,
          plantProgress: 0,
        };
      }
    }

    // --- Plant ---
    if (bomb.bombState === "carried" || bomb.bombState === "planting") {
      const carrierId = bomb.bombCarrierId;
      const carrier = carrierId
        ? this.state.players.get(carrierId)
        : undefined;
      const input = carrierId ? this.inputs.get(carrierId) : undefined;
      const holding = Boolean(input?.plant);
      const stationary = !(
        input &&
        (Math.abs(input.dx) > 0.01 || Math.abs(input.dz) > 0.01)
      );
      const site =
        carrier != null
          ? findSiteAt(carrier.x, carrier.z, sites)
          : null;
      const plantOk =
        carrier != null &&
        canPlant({
          bomb,
          playerId: carrier.id,
          team: "TR",
          alive: carrier.alive,
          x: carrier.x,
          z: carrier.z,
          stationary,
          site,
        });

      bomb = tickPlant(bomb, dt, holding, plantOk);
      if (bomb.plantProgress >= 1 && bomb.bombState === "planting" && carrier) {
        bomb = onPlantComplete(bomb, carrier.x, carrier.z);
      }
      this.bomb = bomb;
      this.syncBombToState();
      return;
    }

    // --- Fuse ---
    bomb = tickBombTimer(bomb, dt);
    if (bomb.bombTimer <= 0) {
      bomb = explode(bomb);
      this.bomb = bomb;
      this.syncBombToState();
      this.finishRound("TR", "bomb_exploded");
      return;
    }

    // --- Defuse (CT humans + bots near bomb) ---
    let defuseHolding = false;
    let defuseOk = false;
    this.state.players.forEach((p) => {
      if (!p.alive || p.team !== "CT") return;
      if (
        !canDefuse({
          bomb,
          team: "CT",
          alive: true,
          x: p.x,
          z: p.z,
          radius: DEFUSE_RADIUS,
        })
      ) {
        return;
      }
      if (p.isBot) {
        defuseHolding = true;
        defuseOk = true;
        return;
      }
      const input = this.inputs.get(p.id);
      if (input?.plant) {
        defuseHolding = true;
        defuseOk = true;
      }
    });

    bomb = tickDefuse(bomb, dt, defuseHolding, defuseOk);
    if (bomb.defuseProgress >= 1 && bomb.bombState === "defusing") {
      bomb = onDefuseComplete(bomb);
      this.bomb = bomb;
      this.syncBombToState();
      this.finishRound("CT", "bomb_defused");
      return;
    }

    this.bomb = bomb;
    this.syncBombToState();
  }

  private tryThrowHe(p: PlayerState, ex: RuntimeExtra) {
    if (p.heCount <= 0) return;
    if (this.phase.phase !== "live" && this.phase.phase !== "warmup") return;

    p.heCount -= 1;
    const impact = heImpactPoint(p.x, p.z, ex.aimX, ex.aimZ, p.rot);
    this.heSeq += 1;
    const proj = createHeProjectile(
      `he_${this.heSeq}`,
      p.id,
      p.team,
      impact.x,
      impact.z,
    );
    this.heProjectiles.push(proj);
    // Optional client FX hook
    this.broadcast("he_throw", {
      id: proj.id,
      ownerId: p.id,
      x: proj.x,
      z: proj.z,
      fuse: proj.fuseLeft,
    });
  }

  private tickHe(dt: number) {
    if (this.heProjectiles.length === 0) return;
    const next: HeProjectile[] = [];
    for (const proj of this.heProjectiles) {
      const { proj: updated, exploded } = tickHeProjectile(proj, dt);
      if (!exploded) {
        next.push(updated);
        continue;
      }
      this.applyHeBlast(updated);
    }
    this.heProjectiles = next;
  }

  private applyHeBlast(proj: HeProjectile) {
    this.broadcast("he_explode", { id: proj.id, x: proj.x, z: proj.z });
    const victims: PlayerState[] = [];
    this.state.players.forEach((other) => {
      if (!other.alive || other.id === proj.ownerId) return;
      // Friendly fire off
      if (other.team === proj.team) return;
      const dist = Math.hypot(other.x - proj.x, other.z - proj.z);
      const raw = heDamageAtDistance(dist);
      if (raw <= 0) return;
      const dmg = applyDamage(other.hp, other.armor, raw);
      other.hp = dmg.hp;
      other.armor = dmg.armor;
      if (other.hp <= 0) {
        other.hp = 0;
        other.alive = false;
        other.deaths += 1;
        const killer = this.state.players.get(proj.ownerId);
        if (killer) {
          killer.kills += 1;
          if (this.phase.phase === "live") {
            killer.money += KILL_REWARD;
          }
        }
        victims.push(other);
        if (this.phase.phase === "warmup") {
          const id = other.id;
          this.clock.setTimeout(() => {
            const p = this.state.players.get(id);
            if (p && this.phase.phase === "warmup" && !p.alive) {
              this.respawnOne(p);
            }
          }, WARMUP_RESPAWN_MS);
        }
      }
    });
    void victims;
  }

  private syncBombToState() {
    this.state.bombState = this.bomb.bombState;
    this.state.bombX = this.bomb.bombX;
    this.state.bombZ = this.bomb.bombZ;
    this.state.bombTimer = this.bomb.bombTimer;
    this.state.bombCarrierId = this.bomb.bombCarrierId ?? "";
    this.state.plantProgress = this.bomb.plantProgress;
    this.state.defuseProgress = this.bomb.defuseProgress;
  }

  private respawnAll() {
    this.state.players.forEach((p) => this.respawnOne(p));
  }

  private respawnOne(p: PlayerState) {
    p.hp = 100;
    p.alive = true;
    p.armor = Math.max(0, p.armor);
    p.y = 0;
    p.vy = 0;
    p.crouching = false;
    p.onGround = true;
    this.applySpawn(p);
    const ex = this.ensureExtra(p.id, p);
    ex.fireCd = 0.25; // brief spawn protection vs accidental fire
    ex.heHeld = false;
    ex.jumpHeld = false;
    // Top off active mag so empty-gun death doesn't soft-lock shooting
    const w = activeWeaponStats(p.primaryId, p.secondaryId, p.activeSlot);
    if (w && !w.isMelee) {
      const pack = ex.ammo[w.id] ?? fullAmmo(w);
      if (pack.mag <= 0 && pack.reserve > 0) {
        const take = Math.min(w.magazine, pack.reserve);
        pack.mag = take;
        pack.reserve -= take;
      } else if (pack.mag <= 0) {
        const full = fullAmmo(w);
        pack.mag = full.mag;
        pack.reserve = full.reserve;
      }
      ex.ammo[w.id] = pack;
      p.mag = pack.mag;
      p.reserve = pack.reserve;
    }
  }

  private applyHumanLoadout(p: PlayerState): AmmoMap {
    const secondary = starterSecondary(p.team);
    const def = WEAPONS[secondary];
    const pack = fullAmmo(def);
    p.money = START_MONEY;
    p.primaryId = "";
    p.secondaryId = secondary;
    p.activeSlot = 2;
    p.mag = pack.mag;
    p.reserve = pack.reserve;
    p.armor = 0;
    p.heCount = 0;
    return { [secondary]: { ...pack } };
  }

  private applyBotLoadout(p: PlayerState): AmmoMap {
    const secondary = starterSecondary(p.team);
    const primary = botPrimary(p.team);
    const secDef = WEAPONS[secondary];
    const priDef = WEAPONS[primary];
    const secPack = fullAmmo(secDef);
    const priPack = fullAmmo(priDef);
    p.money = START_MONEY;
    p.primaryId = primary;
    p.secondaryId = secondary;
    p.activeSlot = 2;
    p.mag = secPack.mag;
    p.reserve = secPack.reserve;
    p.armor = p.team === "CT" ? 50 : 0;
    p.heCount = 0;
    return {
      [secondary]: { ...secPack },
      [primary]: { ...priPack },
    };
  }

  private persistActiveAmmo(p: PlayerState, ex: RuntimeExtra) {
    const w = activeWeaponStats(p.primaryId, p.secondaryId, p.activeSlot);
    if (!w || w.isMelee) return;
    ex.ammo[w.id] = { mag: p.mag, reserve: p.reserve };
  }

  private syncActiveAmmo(p: PlayerState, ex: RuntimeExtra) {
    const w = activeWeaponStats(p.primaryId, p.secondaryId, p.activeSlot);
    if (!w || w.isMelee) {
      p.mag = 0;
      p.reserve = 0;
      return;
    }
    const pack = ex.ammo[w.id] ?? fullAmmo(w);
    if (!ex.ammo[w.id]) ex.ammo[w.id] = { ...pack };
    p.mag = pack.mag;
    p.reserve = pack.reserve;
  }

  private ensureExtra(id: string, p: PlayerState): RuntimeExtra {
    let ex = this.extras.get(id);
    if (!ex) {
      const ammo: AmmoMap = {};
      if (p.secondaryId) {
        const w = getWeapon(p.secondaryId);
        if (w) ammo[p.secondaryId] = { mag: p.mag, reserve: p.reserve };
      }
      if (p.primaryId) {
        const w = getWeapon(p.primaryId);
        if (w) ammo[p.primaryId] = fullAmmo(w);
      }
      ex = {
        fireCd: 0,
        aimX: p.x,
        aimZ: p.z,
        ammo,
        heHeld: false,
        jumpHeld: false,
      };
      this.extras.set(id, ex);
    }
    return ex;
  }

  private resolveCode(raw?: string): string {
    if (raw) {
      const n = normalizeRoomCode(raw);
      if (isValidRoomCode(n)) return n;
    }
    return generateRoomCode();
  }

  private applyPhaseToState() {
    const prevPhase = this.state.phase;
    this.state.phase = this.phase.phase;
    this.state.round = this.phase.round;
    this.state.scoreTR = this.phase.scoreTR;
    this.state.scoreCT = this.phase.scoreCT;
    this.state.timeLeft = Math.max(0, this.phase.timeLeft);
    if (prevPhase !== this.phase.phase) {
      void this.setMetadata({ phase: this.phase.phase });
    }
  }

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
      p.name = `BOT ${BOT_NAMES[(this.botSeq - 1) % BOT_NAMES.length]}`;
      p.team = this.nextTeam();
      p.isBot = true;
      p.hp = 100;
      p.alive = true;
      this.applySpawn(p);
      const ammo = this.applyBotLoadout(p);
      this.state.players.set(id, p);
      this.extras.set(id, {
        fireCd: 0,
        aimX: p.x,
        aimZ: p.z,
        ammo,
        heHeld: false,
        jumpHeld: false,
      });
      bots += 1;
    }

    if (bots > targetBots) {
      const toRemove: string[] = [];
      this.state.players.forEach((p, key) => {
        if (p.isBot) toRemove.push(key);
      });
      toRemove.reverse();
      for (let i = 0; i < bots - targetBots; i++) {
        const key = toRemove[i];
        if (key) {
          this.state.players.delete(key);
          this.extras.delete(key);
        }
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
    const list = spawnsForTeam(this.state.mapId, team);
    const s = list[Math.floor(Math.random() * list.length)]!;
    p.x = s.x + (Math.random() - 0.5) * 1.5;
    p.z = s.z + (Math.random() - 0.5) * 1.5;
    const placed = resolveCircleWalls(p.x, p.z, PLAYER_RADIUS, this.walls);
    p.x = placed.x;
    p.z = placed.z;
    p.rot = team === "TR" ? Math.PI / 4 : (-3 * Math.PI) / 4;
  }
}
