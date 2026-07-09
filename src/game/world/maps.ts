import type { Vec2 } from "../types";
import type { BillboardSlot } from "./billboards";

export interface WallRect {
  x: number;
  z: number;
  w: number;
  d: number;
  h?: number;
  /** slightly different tone for variety */
  color?: number;
}

export interface PropBox {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: number;
  kind?: "crate" | "barrel" | "car" | "dumpster";
}

export interface SpawnPoint {
  team: "TR" | "CT";
  x: number;
  z: number;
}

export interface GameMap {
  id: string;
  name: string;
  displayName: string;
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

/** Dust-like desert — richer props + ad inventory */
export const MAP_DUST: GameMap = {
  id: "dust",
  name: "de_dust_ff",
  displayName: "Dust FF",
  size: { width: 48, depth: 48 },
  groundColor: 0xc4a574,
  groundAccent: 0xb8955f,
  skyColor: 0x7eb6d9,
  fogColor: 0x8ebfd9,
  walls: [
    { x: 0, z: -24, w: 48, d: 1.4, h: 3.2, color: 0xb89a6e },
    { x: 0, z: 24, w: 48, d: 1.4, h: 3.2, color: 0xb89a6e },
    { x: -24, z: 0, w: 1.4, d: 48, h: 3.2, color: 0xb89a6e },
    { x: 24, z: 0, w: 1.4, d: 48, h: 3.2, color: 0xb89a6e },

    { x: -8, z: -6, w: 12, d: 1.5, h: 2.8, color: 0xc2a87a },
    { x: 6, z: -6, w: 10, d: 1.5, h: 2.8, color: 0xb89a6e },
    { x: -4, z: 2, w: 1.5, d: 14, h: 2.8, color: 0xae9068 },
    { x: 8, z: 4, w: 1.5, d: 12, h: 2.8, color: 0xc2a87a },
    { x: -12, z: 10, w: 14, d: 1.5, h: 2.8, color: 0xb89a6e },
    { x: 12, z: 10, w: 10, d: 1.5, h: 2.8, color: 0xae9068 },
    { x: -14, z: -12, w: 1.5, d: 10, h: 2.8, color: 0xc2a87a },
    { x: 14, z: -12, w: 1.5, d: 10, h: 2.8, color: 0xb89a6e },
    { x: 0, z: 16, w: 18, d: 1.5, h: 2.8, color: 0xae9068 },
    { x: -16, z: 0, w: 6, d: 1.5, h: 2.8, color: 0xc2a87a },
    { x: 16, z: 0, w: 6, d: 1.5, h: 2.8, color: 0xb89a6e },
    // cover blocks mid
    { x: 0, z: -12, w: 3.5, d: 1.4, h: 1.6, color: 0x9a7d55 },
    { x: 2, z: 8, w: 2.5, d: 2.5, h: 1.4, color: 0x9a7d55 },
  ],
  props: [
    { x: -10, z: -10, w: 1.6, d: 1.6, h: 1.4, color: 0x8b6914, kind: "crate" },
    { x: 10, z: -8, w: 1.8, d: 1.4, h: 1.5, color: 0x8b6914, kind: "crate" },
    { x: -6, z: 6, w: 1.5, d: 1.5, h: 1.3, color: 0x7a5c12, kind: "crate" },
    { x: 5, z: 14, w: 2, d: 1.5, h: 1.6, color: 0x8b6914, kind: "crate" },
    { x: 12, z: 4, w: 1.4, d: 1.4, h: 1.2, color: 0x6e4f10, kind: "crate" },
    { x: -18, z: 6, w: 1.8, d: 1.2, h: 1.4, color: 0x8b6914, kind: "crate" },
    { x: -8, z: 14, w: 0.9, d: 0.9, h: 1.35, color: 0x3d5c3a, kind: "barrel" },
    { x: -7, z: 14.8, w: 0.9, d: 0.9, h: 1.35, color: 0x4a3b1a, kind: "barrel" },
    { x: 18, z: -6, w: 0.9, d: 0.9, h: 1.35, color: 0x5c3a3a, kind: "barrel" },
    { x: -20, z: -8, w: 3.2, d: 1.5, h: 1.2, color: 0x4a5568, kind: "car" },
    { x: 17, z: 8, w: 3.0, d: 1.4, h: 1.15, color: 0x2d3748, kind: "car" },
    { x: 6, z: -18, w: 2.2, d: 1.3, h: 1.5, color: 0x3f4a3a, kind: "dumpster" },
    { x: -3, z: -16, w: 1.5, d: 1.5, h: 1.3, color: 0x8b6914, kind: "crate" },
  ],
  spawns: [
    { team: "TR", x: -18, z: -18 },
    { team: "TR", x: -15, z: -18 },
    { team: "TR", x: -18, z: -15 },
    { team: "TR", x: -12, z: -18 },
    { team: "CT", x: 18, z: 18 },
    { team: "CT", x: 15, z: 18 },
    { team: "CT", x: 18, z: 15 },
    { team: "CT", x: 12, z: 18 },
  ],
  bombSites: [
    { id: "A", x: 16, z: -14, radius: 3.5 },
    { id: "B", x: -14, z: 14, radius: 3.5 },
  ],
  billboards: [
    {
      x: -20,
      z: -2,
      rotY: Math.PI / 2,
      width: 6.5,
      height: 3.4,
      adId: "army-recruit",
      style: "tower",
    },
    {
      x: 20,
      z: 2,
      rotY: -Math.PI / 2,
      width: 6.5,
      height: 3.4,
      adId: "energy-rush",
      style: "tower",
    },
    {
      x: 0,
      z: -22,
      rotY: 0,
      width: 8,
      height: 3.6,
      adId: "himetrica",
      style: "tower",
    },
    {
      x: 8,
      z: 20,
      rotY: Math.PI,
      width: 7,
      height: 3.2,
      adId: "amigo-bet",
      style: "tower",
    },
    {
      x: -10,
      z: 20,
      rotY: Math.PI,
      width: 6,
      height: 3,
      adId: "ff-sponsor",
      style: "tower",
    },
  ],
  wallPosters: [
    { x: -3.2, y: 1.6, z: 2, rotY: Math.PI / 2, w: 2.2, h: 1.6, adId: "tech-boot" },
    { x: 8.8, y: 1.5, z: 4, rotY: -Math.PI / 2, w: 2, h: 1.5, adId: "himetrica" },
    { x: -12, y: 1.7, z: 9.2, rotY: 0, w: 2.4, h: 1.5, adId: "energy-rush" },
    { x: 10, y: 1.6, z: -5.2, rotY: Math.PI, w: 2.2, h: 1.4, adId: "army-recruit" },
  ],
};

export function circleHitsWall(
  x: number,
  z: number,
  radius: number,
  walls: WallRect[],
): boolean {
  for (const w of walls) {
    const halfW = w.w / 2;
    const halfD = w.d / 2;
    const nearestX = Math.max(w.x - halfW, Math.min(x, w.x + halfW));
    const nearestZ = Math.max(w.z - halfD, Math.min(z, w.z + halfD));
    const dx = x - nearestX;
    const dz = z - nearestZ;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

export function resolveCircleWalls(
  x: number,
  z: number,
  radius: number,
  walls: WallRect[],
): Vec2 {
  let nx = x;
  let nz = z;

  for (const w of walls) {
    const halfW = w.w / 2 + radius;
    const halfD = w.d / 2 + radius;
    const dx = nx - w.x;
    const dz = nz - w.z;

    if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
      const overlapX = halfW - Math.abs(dx);
      const overlapZ = halfD - Math.abs(dz);
      if (overlapX < overlapZ) {
        nx += dx > 0 ? overlapX : -overlapX;
      } else {
        nz += dz > 0 ? overlapZ : -overlapZ;
      }
    }
  }

  return { x: nx, z: nz };
}

/** Collision boxes for billboard poles / cars so they block movement */
export function mapCollisionWalls(map: GameMap): WallRect[] {
  const extra: WallRect[] = [];
  for (const p of map.props) {
    extra.push({ x: p.x, z: p.z, w: p.w, d: p.d, h: p.h });
  }
  for (const b of map.billboards) {
    if (b.style === "wall") continue;
    extra.push({ x: b.x, z: b.z, w: b.width * 0.85, d: 0.6, h: 1 });
  }
  return [...map.walls, ...extra];
}
