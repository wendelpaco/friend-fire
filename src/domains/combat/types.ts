export type WeaponId = "knife" | "glock" | "deagle" | "ak47" | "usp";

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
}

export type Ammo = { mag: number; reserve: number };
