import type { GameMap } from "../types";

/** Yard FF — industrial yard; shipping containers, crate stacks, grey steel */
export const MAP_YARD: GameMap = {
  id: "yard",
  name: "de_yard_ff",
  displayName: "Yard FF",
  accent: "#708090",
  blurb: "Pátio industrial com containers",
  size: { width: 48, depth: 48 },
  groundColor: 0x6b6b6b,
  groundAccent: 0x5a5a5a,
  skyColor: 0x708090,
  fogColor: 0x7a8894,
  walls: [
    // outer fence-like bounds
    { x: 0, z: -24, w: 48, d: 1.2, h: 2.8, color: 0x4a5568 },
    { x: 0, z: 24, w: 48, d: 1.2, h: 2.8, color: 0x4a5568 },
    { x: -24, z: 0, w: 1.2, d: 48, h: 2.8, color: 0x3d4654 },
    { x: 24, z: 0, w: 1.2, d: 48, h: 2.8, color: 0x3d4654 },

    // warehouse / shed shells
    { x: -12, z: -10, w: 14, d: 1.6, h: 3.4, color: 0x5c6570 },
    { x: 10, z: -8, w: 12, d: 1.6, h: 3.2, color: 0x66707c },
    { x: -8, z: 4, w: 1.6, d: 14, h: 3.3, color: 0x545c66 },
    { x: 8, z: 6, w: 1.6, d: 12, h: 3.1, color: 0x5c6570 },
    { x: -14, z: 12, w: 12, d: 1.6, h: 3.2, color: 0x66707c },
    { x: 14, z: 10, w: 10, d: 1.6, h: 3.0, color: 0x545c66 },
    { x: -18, z: -2, w: 1.5, d: 10, h: 3.0, color: 0x4a5568 },
    { x: 18, z: 0, w: 1.5, d: 10, h: 3.0, color: 0x4a5568 },

    // low industrial barriers
    { x: 0, z: -4, w: 6, d: 1.2, h: 1.5, color: 0x8b6914 },
    { x: -4, z: 14, w: 1.3, d: 6, h: 1.6, color: 0x6b5535 },
    { x: 12, z: -2, w: 4, d: 1.2, h: 1.4, color: 0x5a4a30 },
  ],
  props: [
    // shipping containers
    { x: -16, z: 16, w: 3.4, d: 1.6, h: 2.5, color: 0x1a5c4a, kind: "container" },
    { x: -16, z: 13.5, w: 3.4, d: 1.6, h: 2.5, color: 0x8b3a2a, kind: "container" },
    { x: 15, z: -16, w: 3.2, d: 1.5, h: 2.4, color: 0x1e4a8c, kind: "container" },
    { x: 15, z: -13.5, w: 3.2, d: 1.5, h: 2.4, color: 0xc4a000, kind: "container" },
    { x: 16, z: 14, w: 3.0, d: 1.5, h: 2.3, color: 0x8b3a2a, kind: "container" },
    { x: -14, z: -16, w: 3.0, d: 1.5, h: 2.3, color: 0x1a5c4a, kind: "container" },

    // crate stacks
    { x: -6, z: -14, w: 1.6, d: 1.6, h: 1.4, color: 0x8b6914, kind: "crate" },
    { x: -6.2, z: -12.6, w: 1.5, d: 1.5, h: 1.3, color: 0x7a5c12, kind: "crate" },
    { x: -4.5, z: -13.5, w: 1.4, d: 1.4, h: 1.2, color: 0x6e4f10, kind: "crate" },
    { x: 6, z: 14, w: 1.6, d: 1.6, h: 1.5, color: 0x8b6914, kind: "crate" },
    { x: 7.5, z: 13.2, w: 1.4, d: 1.4, h: 1.2, color: 0x7a5c12, kind: "crate" },
    { x: 0, z: 8, w: 1.5, d: 1.5, h: 1.3, color: 0x6e4f10, kind: "crate" },
    { x: 10, z: 2, w: 1.4, d: 1.4, h: 1.2, color: 0x8b6914, kind: "crate" },
    { x: -10, z: 0, w: 1.5, d: 1.5, h: 1.3, color: 0x7a5c12, kind: "crate" },

    // barrels
    { x: -18, z: 6, w: 0.9, d: 0.9, h: 1.35, color: 0x3d5c3a, kind: "barrel" },
    { x: -17, z: 6.8, w: 0.9, d: 0.9, h: 1.35, color: 0x4a3b1a, kind: "barrel" },
    { x: 18, z: -6, w: 0.9, d: 0.9, h: 1.35, color: 0x5c3a3a, kind: "barrel" },
    { x: 5, z: -14, w: 0.85, d: 0.85, h: 1.3, color: 0x2f4f3a, kind: "barrel" },

    // vehicles / dumpsters
    { x: -20, z: -8, w: 3.2, d: 1.5, h: 1.2, color: 0x2d3748, kind: "car" },
    { x: 18, z: 8, w: 3.0, d: 1.4, h: 1.15, color: 0x4a5568, kind: "car" },
    { x: 2, z: -18, w: 2.2, d: 1.3, h: 1.5, color: 0x3f4a3a, kind: "dumpster" },
    { x: -2, z: 18, w: 2.0, d: 1.3, h: 1.45, color: 0x4a3f3a, kind: "dumpster" },

    // poles / debris
    { x: -4, z: -6, w: 0.15, d: 0.15, h: 3.2, color: 0x333333, kind: "pole" },
    { x: 12, z: 6, w: 0.15, d: 0.15, h: 3.0, color: 0x333333, kind: "pole" },
    { x: 3, z: 0, w: 0.6, d: 0.6, h: 0.35, color: 0x4a4030, kind: "debris" },
    { x: -8, z: 10, w: 0.55, d: 0.55, h: 0.3, color: 0x5a4a30, kind: "debris" },
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
    { id: "A", x: 16, z: -12, radius: 3.5 },
    { id: "B", x: -14, z: 14, radius: 3.5 },
  ],
  billboards: [
    {
      x: -20,
      z: 4,
      rotY: Math.PI / 2,
      width: 6.5,
      height: 3.4,
      adId: "army-recruit",
      style: "tower",
    },
    {
      x: 20,
      z: -4,
      rotY: -Math.PI / 2,
      width: 6.5,
      height: 3.4,
      adId: "tech-boot",
      style: "tower",
    },
    {
      x: 0,
      z: 22,
      rotY: Math.PI,
      width: 7,
      height: 3.2,
      adId: "ff-sponsor",
      style: "tower",
    },
  ],
  wallPosters: [
    { x: -7.2, y: 1.6, z: 4, rotY: Math.PI / 2, w: 2.2, h: 1.5, adId: "himetrica" },
    { x: 8.8, y: 1.5, z: 6, rotY: -Math.PI / 2, w: 2.0, h: 1.4, adId: "energy-rush" },
    { x: -14, y: 1.7, z: 11.2, rotY: 0, w: 2.3, h: 1.4, adId: "amigo-bet" },
  ],
};
