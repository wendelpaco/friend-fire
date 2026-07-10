import type { GameMap } from "../types";

/** Favela FF — colorful urban alleys + open pitch; denser mid, open bomb yards */
export const MAP_FAVELA: GameMap = {
  id: "favela",
  name: "de_favela_ff",
  displayName: "Favela FF",
  accent: "#e85a5a",
  blurb: "Vielas coloridas e campo aberto",
  size: { width: 48, depth: 48 },
  groundColor: 0xd4a574,
  groundAccent: 0xc4925a,
  skyColor: 0x5eb0e0,
  fogColor: 0x8ec8e8,
  walls: [
    // outer bounds
    { x: 0, z: -24, w: 48, d: 1.4, h: 3.6, color: 0xe8a0a0 },
    { x: 0, z: 24, w: 48, d: 1.4, h: 3.6, color: 0xa0c8e8 },
    { x: -24, z: 0, w: 1.4, d: 48, h: 3.6, color: 0xf0d080 },
    { x: 24, z: 0, w: 1.4, d: 48, h: 3.6, color: 0xa8d8a0 },

    // colorful alley blocks (mid)
    { x: -10, z: -8, w: 10, d: 1.4, h: 3.2, color: 0xe85a5a },
    { x: 8, z: -8, w: 12, d: 1.4, h: 3.0, color: 0x5a9ae8 },
    { x: -6, z: 0, w: 1.4, d: 12, h: 3.1, color: 0xf0c040 },
    { x: 6, z: 2, w: 1.4, d: 10, h: 3.0, color: 0x6ac86a },
    { x: -14, z: 8, w: 12, d: 1.4, h: 3.2, color: 0xd86ad0 },
    { x: 12, z: 8, w: 10, d: 1.4, h: 2.9, color: 0xe88840 },
    { x: -16, z: -4, w: 1.4, d: 10, h: 3.0, color: 0x50b8c8 },
    { x: 16, z: -4, w: 1.4, d: 10, h: 3.0, color: 0xc85080 },

    // pitch side walls (open center strip like a campo)
    { x: -4, z: 14, w: 1.2, d: 8, h: 2.4, color: 0xe8e0c0 },
    { x: 4, z: 14, w: 1.2, d: 8, h: 2.4, color: 0xe8e0c0 },
    { x: 0, z: 18.5, w: 6, d: 1.0, h: 1.8, color: 0xd0c8a8 },

    // low cover / steps
    { x: 0, z: -14, w: 4, d: 1.2, h: 1.4, color: 0xc88860 },
    { x: -8, z: 4, w: 2.5, d: 1.2, h: 1.5, color: 0xb07050 },
    { x: 10, z: -2, w: 2.2, d: 1.2, h: 1.4, color: 0xa86848 },
  ],
  props: [
    // crates / barrels along alleys
    { x: -12, z: -12, w: 1.5, d: 1.5, h: 1.3, color: 0xe85a5a, kind: "crate" },
    { x: -10.5, z: -10.8, w: 1.4, d: 1.4, h: 1.2, color: 0xf0c040, kind: "crate" },
    { x: 11, z: -12, w: 1.6, d: 1.4, h: 1.4, color: 0x5a9ae8, kind: "crate" },
    { x: 12, z: -10.5, w: 1.3, d: 1.3, h: 1.1, color: 0x6ac86a, kind: "crate" },
    { x: -8, z: 12, w: 1.5, d: 1.5, h: 1.3, color: 0xd86ad0, kind: "crate" },
    { x: 8, z: 12, w: 1.4, d: 1.4, h: 1.2, color: 0xe88840, kind: "crate" },
    { x: -18, z: 2, w: 0.9, d: 0.9, h: 1.35, color: 0x3d5c3a, kind: "barrel" },
    { x: -17, z: 3, w: 0.9, d: 0.9, h: 1.35, color: 0x5c3a3a, kind: "barrel" },
    { x: 18, z: -10, w: 0.85, d: 0.85, h: 1.3, color: 0x2f4f3a, kind: "barrel" },
    // cars / dumpsters
    { x: -18, z: -10, w: 3.0, d: 1.4, h: 1.15, color: 0xc41e3a, kind: "car" },
    { x: 17, z: 6, w: 2.8, d: 1.35, h: 1.1, color: 0x1e6fc4, kind: "car" },
    { x: 4, z: -18, w: 2.0, d: 1.3, h: 1.45, color: 0x3f6a3a, kind: "dumpster" },
    // pitch posts / debris
    { x: -3.5, z: 16, w: 0.2, d: 0.2, h: 2.2, color: 0xffffff, kind: "pole" },
    { x: 3.5, z: 16, w: 0.2, d: 0.2, h: 2.2, color: 0xffffff, kind: "pole" },
    { x: 0, z: 11, w: 0.6, d: 0.6, h: 0.35, color: 0x6a5a40, kind: "debris" },
    { x: -5, z: -6, w: 0.5, d: 0.5, h: 0.3, color: 0x5a4a30, kind: "debris" },
    { x: 9, z: 5, w: 0.55, d: 0.55, h: 0.35, color: 0x6b5535, kind: "debris" },
    // stacked colorful crates near B
    { x: -15, z: 14, w: 1.6, d: 1.6, h: 1.5, color: 0xf0c040, kind: "crate" },
    { x: 14, z: -16, w: 1.5, d: 1.5, h: 1.4, color: 0x50b8c8, kind: "crate" },
    { x: -2, z: 0, w: 1.4, d: 1.4, h: 1.2, color: 0xe85a5a, kind: "crate" },
    { x: -0.7, z: 0.9, w: 1.3, d: 1.3, h: 1.1, color: 0xf0c040, kind: "crate" },
    { x: -1.5, z: -1, w: 0.85, d: 0.85, h: 1.25, color: 0x3d5c3a, kind: "barrel" },
    { x: 5, z: 4, w: 1.4, d: 1.3, h: 1.2, color: 0x5a9ae8, kind: "crate" },
    { x: 6.2, z: 5, w: 1.2, d: 1.2, h: 1.1, color: 0x6ac86a, kind: "crate" },
    { x: 2, z: -6, w: 0.55, d: 0.55, h: 0.35, color: 0x6a5a40, kind: "debris" },
  ],
  spawns: [
    { team: "TR", x: -18, z: -18 },
    { team: "TR", x: -15, z: -18 },
    { team: "TR", x: -18, z: -15 },
    { team: "TR", x: -12, z: -17 },
    { team: "CT", x: 18, z: 18 },
    { team: "CT", x: 15, z: 18 },
    { team: "CT", x: 18, z: 15 },
    { team: "CT", x: 12, z: 17 },
  ],
  bombSites: [
    { id: "A", x: 16, z: -14, radius: 3.5 },
    { id: "B", x: -14, z: 14, radius: 3.5 },
  ],
  billboards: [
    {
      x: -20,
      z: 0,
      rotY: Math.PI / 2,
      width: 6,
      height: 3.2,
      adId: "amigo-bet",
      style: "tower",
    },
    {
      x: 20,
      z: 0,
      rotY: -Math.PI / 2,
      width: 6,
      height: 3.2,
      adId: "energy-rush",
      style: "tower",
    },
    {
      x: 0,
      z: -22,
      rotY: 0,
      width: 7,
      height: 3.4,
      adId: "himetrica",
      style: "tower",
    },
  ],
  wallPosters: [
    { x: -5.2, y: 1.6, z: 0, rotY: Math.PI / 2, w: 2.0, h: 1.5, adId: "tech-boot" },
    { x: 6.8, y: 1.5, z: 2, rotY: -Math.PI / 2, w: 1.9, h: 1.4, adId: "army-recruit" },
    { x: -14, y: 1.7, z: 7.2, rotY: 0, w: 2.2, h: 1.4, adId: "ff-sponsor" },
  ],
};
