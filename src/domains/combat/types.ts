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
  spread: number;
  speed: number;
  range: number;
  reloadTime: number;
  isMelee?: boolean;
  /** Shop price; undefined = not sold (starter knife) */
  price?: number;
}

export type Ammo = { mag: number; reserve: number };
