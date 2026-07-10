import { Schema, type, MapSchema } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") team: string = "TR";
  @type("number") x: number = 0;
  @type("number") z: number = 0;
  /** Vertical position (jump). */
  @type("number") y: number = 0;
  /** Vertical velocity. */
  @type("number") vy: number = 0;
  /** Toggle crouch posture (Control edge; not hold-to-crouch). */
  @type("boolean") crouching: boolean = false;
  /** Feet on floor. */
  @type("boolean") onGround: boolean = true;
  @type("number") rot: number = 0;
  @type("number") hp: number = 100;
  @type("number") armor: number = 0;
  @type("boolean") alive: boolean = true;
  @type("boolean") isBot: boolean = false;
  @type("number") kills: number = 0;
  @type("number") deaths: number = 0;
  /** Economy */
  @type("number") money: number = 800;
  /** Primary weapon id (slot 1), empty if none */
  @type("string") primaryId: string = "";
  /** Secondary weapon id (slot 2) */
  @type("string") secondaryId: string = "";
  /** Active slot: 1 primary | 2 secondary | 4 knife */
  @type("number") activeSlot: number = 2;
  /** Mag/reserve for currently active firearm (knife: unused) */
  @type("number") mag: number = 0;
  @type("number") reserve: number = 0;
  /** HE grenades carried (0–2) */
  @type("number") heCount: number = 0;
  /** Operator roster id (session meta skins); empty if unset. */
  @type("string") operatorId: string = "";
  /** Skin id under operator catalog; empty if unset. */
  @type("string") skinId: string = "";
}

export class MatchState extends Schema {
  @type("string") phase: string = "warmup";
  @type("number") round: number = 0;
  @type("number") scoreTR: number = 0;
  @type("number") scoreCT: number = 0;
  @type("number") timeLeft: number = 20;
  @type("string") code: string = "";
  /** Map id: dust | favela | yard */
  @type("string") mapId: string = "dust";
  /** Display name for the active map */
  @type("string") mapName: string = "Dust FF";
  /** Optional room nickname (empty if unset) */
  @type("string") roomName: string = "";
  /** Browser visibility: public | private */
  @type("string") visibility: string = "public";
  /** Room region tag: BR | US (metadata / list filter; not multi-DC) */
  @type("string") region: string = "BR";
  /** Server combat authority active */
  @type("boolean") authoritative: boolean = true;

  /**
   * C4: carried | planting | planted | defusing | exploded | defused
   * Empty string when inactive (pre-round).
   */
  @type("string") bombState: string = "";
  @type("number") bombX: number = 0;
  @type("number") bombZ: number = 0;
  /** Seconds to explode when planted (default 40). */
  @type("number") bombTimer: number = 40;
  /** TR session id holding C4 (empty if planted / none). */
  @type("string") bombCarrierId: string = "";
  @type("number") plantProgress: number = 0;
  @type("number") defuseProgress: number = 0;
  /**
   * Last round end reason for banners:
   * elimination | time | bomb_exploded | bomb_defused | ""
   */
  @type("string") roundEndReason: string = "";

  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}

/** Client → server input message */
export interface InputMessage {
  dx: number;
  dz: number;
  aimX: number;
  aimZ: number;
  fire: boolean;
  reload: boolean;
  slot: number;
  /** Hold F — plant (TR+carrier) or defuse (CT near bomb). */
  plant: boolean;
  /** Edge: throw HE if heCount > 0. */
  he: boolean;
  /** Edge: jump (Space) when on ground. */
  jump: boolean;
  /** Hold bit for crouch (Ctrl); server edge-detects to toggle posture. */
  crouch: boolean;
}

/** Client → server buy message */
export interface BuyMessage {
  itemId: string;
}
