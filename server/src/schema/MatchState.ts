import { Schema, type, MapSchema } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") team: string = "TR";
  @type("number") x: number = 0;
  @type("number") z: number = 0;
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
  /** Server combat authority active */
  @type("boolean") authoritative: boolean = true;
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
}

/** Client → server buy message */
export interface BuyMessage {
  itemId: string;
}
