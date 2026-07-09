import { Room, Client } from "colyseus";
import {
  MatchState,
  PlayerState,
  type BuyMessage,
  type InputMessage,
} from "../schema/MatchState";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "../sim/codes";
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
import {
  applyDamage,
  BOT_SPEED,
  HIT_RADIUS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  resolveCircleWalls,
  SPAWNS,
} from "../sim/world";

const MATCH_SIZE = 6;
const TICK_MS = 50; // 20 Hz
const BOT_NAMES = ["Lucão", "Pedrão", "Enzo", "Davi", "Theo", "Rafa"];

export type GameRoomOptions = {
  code?: string;
  name?: string;
};

type RuntimeExtra = {
  fireCd: number;
  aimX: number;
  aimZ: number;
  /** Per-weapon ammo (primary/secondary ids). */
  ammo: AmmoMap;
};

/**
 * Authoritative private match: movement, hitscan fire, bots, rounds, shop.
 */
export class GameRoom extends Room<MatchState> {
  maxClients = MATCH_SIZE;

  private phase: MatchPhaseState = createMatchPhase();
  private botSeq = 0;
  private inputs = new Map<string, InputMessage>();
  private extras = new Map<string, RuntimeExtra>();
  async onCreate(options: GameRoomOptions = {}) {
    this.setState(new MatchState());
    this.state.authoritative = true;

    const code = this.resolveCode(options.code);
    this.state.code = code;
    (this.listing as { code?: string }).code = code;
    await this.setMetadata({ code });

    this.applyPhaseToState();
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
      });
    });

    this.onMessage("buy", (client, message: Partial<BuyMessage>) => {
      this.handleBuy(client, message?.itemId);
    });

    this.onMessage("ping", (client) => {
      client.send("pong", { t: Date.now() });
    });

    console.log(`[GameRoom] created code=${code} roomId=${this.roomId} auth=1`);
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
    if (result.ammo) ex.ammo = result.ammo;
  }

  private tick(dt: number) {
    const prev = this.phase.phase;
    this.phase = tickPhase(this.phase, dt);
    this.applyPhaseToState();

    if (
      this.phase.phase === "live" &&
      (prev === "warmup" || prev === "ended")
    ) {
      this.respawnAll();
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
      if (this.phase.phase !== "live" && this.phase.phase !== "warmup") return;
      const input = this.inputs.get(key);
      const ex = this.ensureExtra(key, p);
      if (!input) return;

      if (input.dx !== 0 || input.dz !== 0) {
        const nx = p.x + input.dx * PLAYER_SPEED * dt;
        const nz = p.z + input.dz * PLAYER_SPEED * dt;
        const r = resolveCircleWalls(nx, nz, PLAYER_RADIUS);
        p.x = r.x;
        p.z = r.z;
      }

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
    });

    // Bots
    if (this.phase.phase === "live" || this.phase.phase === "warmup") {
      this.tickBots(dt);
    }

    // Round wipe check (live only)
    if (this.phase.phase === "live") {
      this.checkWipe();
    }
  }

  private tickBots(dt: number) {
    const list: PlayerState[] = [];
    this.state.players.forEach((p) => list.push(p));

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
      if (!target) continue;

      const dx = target.x - bot.x;
      const dz = target.z - bot.z;
      const dist = Math.hypot(dx, dz) || 1;
      bot.rot = Math.atan2(dx, dz);
      ex.aimX = target.x;
      ex.aimZ = target.z;

      let mx = 0;
      let mz = 0;
      if (dist > 10) {
        mx = (dx / dist) * BOT_SPEED * dt;
        mz = (dz / dist) * BOT_SPEED * dt;
      } else if (dist < 5) {
        mx = (-dx / dist) * BOT_SPEED * 0.5 * dt;
        mz = (-dz / dist) * BOT_SPEED * 0.5 * dt;
      } else {
        mx = (-dz / dist) * BOT_SPEED * 0.6 * dt;
        mz = (dx / dist) * BOT_SPEED * 0.6 * dt;
      }
      const r = resolveCircleWalls(bot.x + mx, bot.z + mz, PLAYER_RADIUS);
      bot.x = r.x;
      bot.z = r.z;

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

      if (this.phase.phase === "warmup") {
        const id = hit.id;
        setTimeout(() => {
          const p = this.state.players.get(id);
          if (p && this.phase.phase === "warmup" && !p.alive) {
            this.respawnOne(p);
          }
        }, 2000);
      }
    }
  }

  private checkWipe() {
    let tr = 0;
    let ct = 0;
    this.state.players.forEach((p) => {
      if (!p.alive) return;
      if (p.team === "TR") tr += 1;
      else ct += 1;
    });
    if (tr === 0 && ct > 0) {
      this.phase = onRoundWin(this.phase, "CT");
      this.applyPhaseToState();
    } else if (ct === 0 && tr > 0) {
      this.phase = onRoundWin(this.phase, "TR");
      this.applyPhaseToState();
    }
  }

  private respawnAll() {
    this.state.players.forEach((p) => this.respawnOne(p));
  }

  private respawnOne(p: PlayerState) {
    p.hp = 100;
    p.alive = true;
    this.applySpawn(p);
    const ex = this.ensureExtra(p.id, p);
    ex.fireCd = 0;
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
      ex = { fireCd: 0, aimX: p.x, aimZ: p.z, ammo };
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
    this.state.phase = this.phase.phase;
    this.state.round = this.phase.round;
    this.state.scoreTR = this.phase.scoreTR;
    this.state.scoreCT = this.phase.scoreCT;
    this.state.timeLeft = Math.max(0, this.phase.timeLeft);
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
      this.extras.set(id, { fireCd: 0, aimX: p.x, aimZ: p.z, ammo });
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
    const list = SPAWNS[team];
    const s = list[Math.floor(Math.random() * list.length)]!;
    p.x = s.x + (Math.random() - 0.5);
    p.z = s.z + (Math.random() - 0.5);
    p.rot = team === "TR" ? Math.PI / 4 : (-3 * Math.PI) / 4;
  }
}
