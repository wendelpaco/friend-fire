import type { Team } from "@/shared/types/team";

export interface Vec2 {
  x: number;
  z: number;
}

/**
 * Axis-aligned box on XZ. Optional height drives CS-style cover / platforms:
 * - tall (h ≥ ~2) full wall — blocks standing shots
 * - low cover (h ≈ 1.4–1.6) — blocks crouch shots, stand can shoot over
 * - standable props (crates/cars) — walk/jump on top when `standable`
 */
export interface WallRect {
  x: number;
  z: number;
  w: number;
  d: number;
  h?: number;
  /** slightly different tone for variety */
  color?: number;
  /** Can stand / land on the top face (crates, cars, containers…). */
  standable?: boolean;
}

export interface PropBox {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: number;
  kind?: "crate" | "barrel" | "car" | "dumpster" | "container" | "debris" | "pole";
}

export interface SpawnPoint {
  team: Team;
  x: number;
  z: number;
}

export interface BillboardSlot {
  x: number;
  z: number;
  /** rotation around Y in radians (0 = faces +Z) */
  rotY: number;
  width: number;
  height: number;
  /** ad creative id from catalog */
  adId: string;
  /** freestanding poles vs wall-mounted poster */
  style?: "tower" | "wall";
}

export interface GameMap {
  id: string;
  name: string;
  displayName: string;
  /** UI chip / swatch color (CSS hex, e.g. "#c4a574"). */
  accent: string;
  /** Short lobby blurb for map pickers. */
  blurb?: string;
  size: { width: number; depth: number };
  groundColor: number;
  groundAccent: number;
  skyColor: number;
  fogColor: number;
  walls: WallRect[];
  props: PropBox[];
  spawns: SpawnPoint[];
  bombSites: Array<{ id: string; x: number; z: number; radius: number }>;
  billboards: BillboardSlot[];
  wallPosters: Array<{
    x: number;
    y: number;
    z: number;
    rotY: number;
    w: number;
    h: number;
    adId: string;
  }>;
}
