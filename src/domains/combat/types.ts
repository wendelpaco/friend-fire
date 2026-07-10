export type WeaponId =
  | "knife"
  | "glock"
  | "deagle"
  | "usp"
  | "ak47"
  | "galil"
  | "mp5"
  | "awp";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  slot: number;
  damage: number;
  fireRate: number;
  magazine: number;
  reserve: number;
  /**
   * Base continuous-fire aim error (radians, half-angle).
   * Accuracy module derives first/bloom defaults from this when knobs omitted.
   */
  spread: number;
  speed: number;
  range: number;
  reloadTime: number;
  isMelee?: boolean;
  /** Shop price; undefined = not sold (starter knife) */
  price?: number;
  /** First bullet after recovery; default `spread * 0.25`. */
  firstShotSpread?: number;
  /** Extra radians per burst shot; default `spread * 0.15`. */
  bloomPerShot?: number;
  /** Ms idle before bloom resets to first shot; default by class §4.3. */
  recoveryMs?: number;
  /** Scales movement inaccuracy term; default 1 (AWP 1.8, SMG 0.7). */
  moveInaccuracyScale?: number;
  /** Cap bloom stacks; default 10. */
  maxBloomShots?: number;
  /**
   * Armor penetration 0–1 for HP soak.
   * 0 = normal half-armor formula; 1 = full pen to HP (still chips armor).
   * AWP uses 1.0 (§4.4).
   */
  armorPen?: number;
}

export type Ammo = { mag: number; reserve: number };
