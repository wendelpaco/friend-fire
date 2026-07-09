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
}

export class MatchState extends Schema {
  @type("string") phase: string = "warmup";
  @type("number") round: number = 0;
  @type("number") scoreTR: number = 0;
  @type("number") scoreCT: number = 0;
  @type("number") timeLeft: number = 20;
  @type("string") code: string = "";
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}

/** Client → server input message (processing stubbed in GameRoom). */
export interface InputMessage {
  dx: number;
  dz: number;
  aimX: number;
  aimZ: number;
  fire: boolean;
  reload: boolean;
  slot: number;
}
