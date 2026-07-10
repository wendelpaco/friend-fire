import type { GameMap } from "../types";

/**
 * Yard FF — 72×72 industrial yard (CS-style: warehouse mid, A dock, B scrap).
 */
const S = 72;
const H = S / 2;

export const MAP_YARD: GameMap = {
  id: "yard",
  name: "de_yard_ff",
  displayName: "Yard FF",
  accent: "#708090",
  blurb: "Pátio industrial — mid warehouse, docks e scrap yard",
  size: { width: S, depth: S },
  groundColor: 0x6a7068,
  groundAccent: 0x5a6058,
  skyColor: 0x6a8498,
  fogColor: 0x7a8a98,
  walls: [
    { x: 0, z: -H, w: S, d: 1.4, h: 3.2, color: 0x4a5568 },
    { x: 0, z: H, w: S, d: 1.4, h: 3.2, color: 0x4a5568 },
    { x: -H, z: 0, w: 1.4, d: S, h: 3.2, color: 0x3d4654 },
    { x: H, z: 0, w: 1.4, d: S, h: 3.2, color: 0x3d4654 },

    // TR / CT spawn pens
    { x: -24, z: -28, w: 16, d: 1.3, h: 2.8, color: 0x4a5568 },
    { x: -30, z: -20, w: 1.3, d: 14, h: 2.8, color: 0x3d4654 },
    { x: 24, z: 28, w: 16, d: 1.3, h: 2.8, color: 0x4a5568 },
    { x: 30, z: 20, w: 1.3, d: 14, h: 2.8, color: 0x3d4654 },

    // Central warehouse (mid control)
    { x: -8, z: 0, w: 1.5, d: 18, h: 3.4, color: 0x5a6575 },
    { x: 8, z: 0, w: 1.5, d: 18, h: 3.4, color: 0x5a6575 },
    { x: 0, z: -10, w: 14, d: 1.5, h: 3.4, color: 0x4a5568 },
    { x: 0, z: 10, w: 14, d: 1.5, h: 3.4, color: 0x4a5568 },
    // warehouse doors (openings via missing segments) — side stubs
    { x: -4, z: -10, w: 4, d: 1.2, h: 1.4, color: 0x3d4654 },
    { x: 4, z: 10, w: 4, d: 1.2, h: 1.4, color: 0x3d4654 },

    // A dock (SE)
    { x: 20, z: -18, w: 1.5, d: 20, h: 3.0, color: 0x5a6575 },
    { x: 28, z: -12, w: 1.5, d: 16, h: 3.0, color: 0x4a5568 },
    { x: 22, z: -26, w: 14, d: 1.5, h: 2.9, color: 0x5a6575 },
    { x: 12, z: -16, w: 10, d: 1.4, h: 2.6, color: 0x3d4654 },

    // B scrap (NW)
    { x: -20, z: 12, w: 1.5, d: 18, h: 3.0, color: 0x4a5568 },
    { x: -28, z: 16, w: 1.5, d: 14, h: 3.0, color: 0x5a6575 },
    { x: -22, z: 24, w: 16, d: 1.5, h: 2.9, color: 0x4a5568 },
    { x: -12, z: 14, w: 1.4, d: 12, h: 2.7, color: 0x3d4654 },

    // Connectors
    { x: 14, z: 8, w: 12, d: 1.4, h: 2.8, color: 0x5a6575 },
    { x: -14, z: -6, w: 12, d: 1.4, h: 2.8, color: 0x4a5568 },
    { x: 6, z: 18, w: 1.4, d: 10, h: 2.7, color: 0x3d4654 },
    { x: -6, z: -18, w: 1.4, d: 10, h: 2.7, color: 0x5a6575 },

    // Cover
    { x: 0, z: 0, w: 3, d: 3, h: 1.6, color: 0x3d4654 },
    { x: 18, z: -8, w: 2.5, d: 1.3, h: 1.5, color: 0x4a5568 },
    { x: -18, z: 8, w: 2.5, d: 1.3, h: 1.5, color: 0x4a5568 },
    { x: 10, z: 4, w: 2.2, d: 2.2, h: 1.4, color: 0x3d4654 },
    { x: -10, z: -4, w: 2.2, d: 2.2, h: 1.4, color: 0x3d4654 },
  ],
  props: [
    { x: 22, z: -14, w: 1.6, d: 1.6, h: 1.4, color: 0x8b6914, kind: "crate" },
    { x: 24, z: -16, w: 1.4, d: 1.4, h: 1.2, color: 0x7a5c12, kind: "crate" },
    { x: -20, z: 18, w: 1.5, d: 1.5, h: 1.3, color: 0x6e4f10, kind: "crate" },
    { x: -22, z: 16, w: 1.4, d: 1.4, h: 1.2, color: 0x8b6914, kind: "crate" },
    { x: 2, z: 2, w: 1.5, d: 1.5, h: 1.3, color: 0x7a5c12, kind: "crate" },
    { x: -2, z: -2, w: 1.3, d: 1.3, h: 1.15, color: 0x6e4f10, kind: "crate" },
    { x: 16, z: -20, w: 3.2, d: 1.6, h: 2.4, color: 0x1a5c4a, kind: "container" },
    { x: -24, z: 10, w: 3.0, d: 1.5, h: 2.3, color: 0x8b3a2a, kind: "container" },
    { x: 0, z: 16, w: 3.1, d: 1.5, h: 2.3, color: 0x2a4a6a, kind: "container" },
    { x: -26, z: -22, w: 3.0, d: 1.4, h: 1.15, color: 0x4a5568, kind: "car" },
    { x: 26, z: 22, w: 2.9, d: 1.35, h: 1.1, color: 0x2d3748, kind: "car" },
    { x: 10, z: -26, w: 2.8, d: 1.3, h: 1.1, color: 0x5a4a40, kind: "car" },
    { x: 8, z: 12, w: 0.9, d: 0.9, h: 1.3, color: 0x3d5c3a, kind: "barrel" },
    { x: -8, z: -12, w: 0.9, d: 0.9, h: 1.3, color: 0x4a3b1a, kind: "barrel" },
    { x: 20, z: 6, w: 2.0, d: 1.3, h: 1.45, color: 0x3f4a3a, kind: "dumpster" },
    { x: -16, z: -8, w: 1.9, d: 1.2, h: 1.4, color: 0x3a5040, kind: "dumpster" },
    { x: 4, z: -8, w: 0.15, d: 0.15, h: 3.2, color: 0x333333, kind: "pole" },
    { x: -4, z: 8, w: 0.15, d: 0.15, h: 3.0, color: 0x333333, kind: "pole" },
  ],
  spawns: [
    { team: "TR", x: -28, z: -28 },
    { team: "TR", x: -24, z: -30 },
    { team: "TR", x: -30, z: -24 },
    { team: "TR", x: -22, z: -26 },
    { team: "CT", x: 28, z: 28 },
    { team: "CT", x: 24, z: 30 },
    { team: "CT", x: 30, z: 24 },
    { team: "CT", x: 22, z: 26 },
  ],
  bombSites: [
    { id: "A", x: 24, z: -18, radius: 4.0 },
    { id: "B", x: -22, z: 18, radius: 4.0 },
  ],
  billboards: [
    {
      x: -32,
      z: 4,
      rotY: Math.PI / 2,
      width: 7,
      height: 3.5,
      adId: "army-recruit",
      style: "tower",
    },
    {
      x: 32,
      z: -4,
      rotY: -Math.PI / 2,
      width: 7,
      height: 3.5,
      adId: "energy-rush",
      style: "tower",
    },
    {
      x: 0,
      z: -32,
      rotY: 0,
      width: 8,
      height: 3.6,
      adId: "himetrica",
      style: "tower",
    },
  ],
  wallPosters: [
    { x: -7.2, y: 1.6, z: 0, rotY: Math.PI / 2, w: 2.2, h: 1.6, adId: "tech-boot" },
    { x: 8.8, y: 1.5, z: 0, rotY: -Math.PI / 2, w: 2, h: 1.5, adId: "himetrica" },
  ],
};
