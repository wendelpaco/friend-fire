import type { GameMap } from "../types";

/**
 * Favela FF — 72×72 urban alleys + open pitch (CS site dynamics).
 * TR SW · CT NE · A east of pitch · B west alleys · mid through color blocks.
 */
const S = 72;
const H = S / 2;

export const MAP_FAVELA: GameMap = {
  id: "favela",
  name: "de_favela_ff",
  displayName: "Favela FF",
  accent: "#e85a5a",
  blurb: "Vielas, mid e campo — mapa grande com rotação real",
  size: { width: S, depth: S },
  groundColor: 0xd4a574,
  groundAccent: 0xc4925a,
  skyColor: 0x5eb0e0,
  fogColor: 0x8ec8e8,
  walls: [
    // bounds
    { x: 0, z: -H, w: S, d: 1.5, h: 3.6, color: 0xe8a0a0 },
    { x: 0, z: H, w: S, d: 1.5, h: 3.6, color: 0xa0c8e8 },
    { x: -H, z: 0, w: 1.5, d: S, h: 3.6, color: 0xf0d080 },
    { x: H, z: 0, w: 1.5, d: S, h: 3.6, color: 0xa8d8a0 },

    // TR spawn yard
    { x: -24, z: -28, w: 16, d: 1.4, h: 3.2, color: 0xe85a5a },
    { x: -30, z: -20, w: 1.4, d: 14, h: 3.2, color: 0xf0c040 },

    // CT spawn yard
    { x: 24, z: 28, w: 16, d: 1.4, h: 3.2, color: 0x5a9ae8 },
    { x: 30, z: 20, w: 1.4, d: 14, h: 3.2, color: 0x6ac86a },

    // Color alley mid-west (B approach)
    { x: -16, z: -10, w: 14, d: 1.4, h: 3.2, color: 0xe85a5a },
    { x: -20, z: 0, w: 1.4, d: 16, h: 3.1, color: 0xf0c040 },
    { x: -12, z: 8, w: 12, d: 1.4, h: 3.2, color: 0xd86ad0 },
    { x: -24, z: 12, w: 1.4, d: 12, h: 3.0, color: 0x50b8c8 },
    { x: -18, z: 20, w: 14, d: 1.4, h: 3.1, color: 0xe88840 },

    // East alleys (A approach)
    { x: 14, z: -12, w: 14, d: 1.4, h: 3.1, color: 0x5a9ae8 },
    { x: 20, z: -2, w: 1.4, d: 16, h: 3.0, color: 0x6ac86a },
    { x: 12, z: 6, w: 12, d: 1.4, h: 3.0, color: 0xc85080 },
    { x: 24, z: 10, w: 1.4, d: 12, h: 3.1, color: 0xe85a5a },
    { x: 16, z: -22, w: 16, d: 1.4, h: 3.0, color: 0xf0c040 },

    // Central mid strip (broken walls = walkways)
    { x: -4, z: -6, w: 1.3, d: 14, h: 3.0, color: 0xf0d080 },
    { x: 4, z: 2, w: 1.3, d: 14, h: 3.0, color: 0xa8d8a0 },
    { x: 0, z: 12, w: 10, d: 1.3, h: 2.8, color: 0xe8a0a0 },
    { x: 0, z: -16, w: 12, d: 1.3, h: 2.8, color: 0xa0c8e8 },

    // Pitch / open campo (north) — site rotation space
    { x: -6, z: 22, w: 1.2, d: 10, h: 2.4, color: 0xe8e0c0 },
    { x: 6, z: 22, w: 1.2, d: 10, h: 2.4, color: 0xe8e0c0 },
    { x: 0, z: 28, w: 10, d: 1.0, h: 1.9, color: 0xd0c8a8 },

    // Low cover
    { x: -8, z: 2, w: 3, d: 1.3, h: 1.5, color: 0xc88860 },
    { x: 10, z: -4, w: 2.5, d: 1.3, h: 1.5, color: 0xb07050 },
    { x: 0, z: 6, w: 2.8, d: 2.8, h: 1.4, color: 0xa86848 },
    { x: -22, z: -4, w: 2.4, d: 1.3, h: 1.5, color: 0xc88860 },
    { x: 22, z: 4, w: 2.4, d: 1.3, h: 1.5, color: 0xb07050 },
  ],
  props: [
    { x: -22, z: -14, w: 1.5, d: 1.5, h: 1.3, color: 0xe85a5a, kind: "crate" },
    { x: -20, z: -12, w: 1.4, d: 1.4, h: 1.2, color: 0xf0c040, kind: "crate" },
    { x: 20, z: -16, w: 1.6, d: 1.4, h: 1.4, color: 0x5a9ae8, kind: "crate" },
    { x: 22, z: -14, w: 1.3, d: 1.3, h: 1.1, color: 0x6ac86a, kind: "crate" },
    { x: -20, z: 16, w: 1.5, d: 1.5, h: 1.3, color: 0xd86ad0, kind: "crate" },
    { x: -18, z: 18, w: 1.4, d: 1.4, h: 1.2, color: 0xe88840, kind: "crate" },
    { x: 18, z: 14, w: 1.5, d: 1.5, h: 1.3, color: 0x50b8c8, kind: "crate" },
    { x: 0, z: 0, w: 1.4, d: 1.4, h: 1.2, color: 0xe85a5a, kind: "crate" },
    { x: 2, z: 2, w: 1.3, d: 1.3, h: 1.1, color: 0xf0c040, kind: "crate" },
    { x: -26, z: 4, w: 0.9, d: 0.9, h: 1.35, color: 0x3d5c3a, kind: "barrel" },
    { x: -24, z: 6, w: 0.9, d: 0.9, h: 1.35, color: 0x5c3a3a, kind: "barrel" },
    { x: 26, z: -8, w: 0.85, d: 0.85, h: 1.3, color: 0x2f4f3a, kind: "barrel" },
    { x: 8, z: 8, w: 0.9, d: 0.9, h: 1.3, color: 0x4a3b1a, kind: "barrel" },
    // cars
    { x: -26, z: -18, w: 3.0, d: 1.4, h: 1.15, color: 0xc41e3a, kind: "car" },
    { x: 26, z: 16, w: 2.8, d: 1.35, h: 1.1, color: 0x1e6fc4, kind: "car" },
    { x: -10, z: -24, w: 2.9, d: 1.35, h: 1.1, color: 0xe8e0d0, kind: "car" },
    { x: 12, z: -26, w: 2.7, d: 1.3, h: 1.05, color: 0x6a7a88, kind: "car" },
    { x: -22, z: 8, w: 2.6, d: 1.25, h: 1.05, color: 0x2a4a6a, kind: "car" },
    { x: 20, z: 22, w: 2.8, d: 1.3, h: 1.1, color: 0xb8a090, kind: "car" },
    { x: 4, z: -28, w: 2.0, d: 1.3, h: 1.45, color: 0x3f6a3a, kind: "dumpster" },
    { x: -8, z: 14, w: 1.9, d: 1.2, h: 1.4, color: 0x3a5040, kind: "dumpster" },
    // pitch posts
    { x: -4, z: 24, w: 0.2, d: 0.2, h: 2.2, color: 0xffffff, kind: "pole" },
    { x: 4, z: 24, w: 0.2, d: 0.2, h: 2.2, color: 0xffffff, kind: "pole" },
    { x: 0, z: 18, w: 0.6, d: 0.6, h: 0.35, color: 0x6a5a40, kind: "debris" },
    { x: -6, z: -8, w: 0.5, d: 0.5, h: 0.3, color: 0x5a4a30, kind: "debris" },
    { x: 14, z: 4, w: 0.55, d: 0.55, h: 0.35, color: 0x6b5535, kind: "debris" },
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
    { id: "A", x: 22, z: -18, radius: 4.0 },
    { id: "B", x: -20, z: 16, radius: 4.0 },
  ],
  billboards: [
    {
      x: -32,
      z: 0,
      rotY: Math.PI / 2,
      width: 7,
      height: 3.5,
      adId: "army-recruit",
      style: "tower",
    },
    {
      x: 32,
      z: 0,
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
    {
      x: 8,
      z: 32,
      rotY: Math.PI,
      width: 7,
      height: 3.2,
      adId: "amigo-bet",
      style: "tower",
    },
  ],
  wallPosters: [
    { x: -3.2, y: 1.6, z: -6, rotY: Math.PI / 2, w: 2.2, h: 1.6, adId: "tech-boot" },
    { x: 4.8, y: 1.5, z: 2, rotY: -Math.PI / 2, w: 2, h: 1.5, adId: "himetrica" },
    { x: -20, y: 1.7, z: 0, rotY: Math.PI / 2, w: 2.4, h: 1.5, adId: "energy-rush" },
  ],
};
