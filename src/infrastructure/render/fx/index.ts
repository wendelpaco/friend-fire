export { MuzzleFlashSystem } from "./MuzzleFlashSystem";
export {
  ImpactParticleSystem,
  type ImpactSurface,
} from "./ImpactParticleSystem";
export { WallDamageSystem } from "./WallDamageSystem";
export { BombMarkerSystem } from "./BombMarkerSystem";
export { HESystem } from "./HESystem";
export { DamageNumberSystem } from "./DamageNumberSystem";
export { TracerSystem } from "./TracerSystem";
export { AimReticleSystem } from "./AimReticleSystem";

/** Local FX event shapes (wire agent maps sim → these). Matches design §4.2. */
export type FxEvent =
  | { type: "muzzle"; x: number; z: number; rot: number; weaponId: string }
  | {
      type: "impact";
      x: number;
      y: number;
      z: number;
      nx: number;
      ny: number;
      nz: number;
      surface: "wall" | "ground" | "prop";
    }
  | { type: "footstep"; x: number; z: number }
  | { type: "he"; x: number; y: number; z: number; explode?: boolean }
  | { type: "damageNumber"; x: number; y: number; z: number; text: string };
