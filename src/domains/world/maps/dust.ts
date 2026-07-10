import type { GameMap } from "../types";

/**
 * Dust FF — larger CS-style layout (72×72).
 *
 * Coordinate legend (X east, Z south):
 * - TR spawn: southwest · CT spawn: northeast
 * - Site A: southeast (long A + short A)
 * - Site B: northwest (tunnels / cat)
 * - Mid: north–south corridor connecting both approaches
 *
 * Dynamics: multiple paths, chokes with cover, fair rotate distance.
 */
const S = 72; // playable size
const H = S / 2; // 36

export const MAP_DUST: GameMap = {
  id: "dust",
  name: "de_dust_ff",
  displayName: "Dust FF",
  accent: "#c4a574",
  blurb: "Long A, mid e tunnels — layout maior estilo CS",
  size: { width: S, depth: S },
  groundColor: 0xc4a574,
  groundAccent: 0xb8955f,
  skyColor: 0x6ba8d4,
  fogColor: 0x7eb6d0,
  walls: [
    // ── outer bounds ──────────────────────────────────────
    { x: 0, z: -H, w: S, d: 1.6, h: 3.6, color: 0xb89a6e },
    { x: 0, z: H, w: S, d: 1.6, h: 3.6, color: 0xb89a6e },
    { x: -H, z: 0, w: 1.6, d: S, h: 3.6, color: 0xb89a6e },
    { x: H, z: 0, w: 1.6, d: S, h: 3.6, color: 0xb89a6e },

    // ── TR spawn block (SW) — forces path into mid / long ──
    { x: -22, z: -28, w: 14, d: 1.5, h: 3.0, color: 0xc2a87a },
    { x: -28, z: -20, w: 1.5, d: 12, h: 3.0, color: 0xb89a6e },

    // ── CT spawn block (NE) ────────────────────────────────
    { x: 22, z: 28, w: 14, d: 1.5, h: 3.0, color: 0xc2a87a },
    { x: 28, z: 20, w: 1.5, d: 12, h: 3.0, color: 0xb89a6e },

    // ── Long A (east corridor TR→A) ───────────────────────
    { x: 18, z: -8, w: 1.5, d: 28, h: 3.1, color: 0xae9068 },
    { x: 26, z: -12, w: 1.5, d: 20, h: 3.1, color: 0xc2a87a },
    // A site side walls
    { x: 22, z: -26, w: 16, d: 1.5, h: 3.0, color: 0xb89a6e },
    { x: 30, z: -18, w: 1.5, d: 10, h: 2.9, color: 0xae9068 },

    // ── Short A / mid-east (choke into A) ─────────────────
    { x: 10, z: -14, w: 12, d: 1.5, h: 2.9, color: 0xc2a87a },
    { x: 8, z: -8, w: 1.5, d: 10, h: 2.8, color: 0xb89a6e },
    { x: 12, z: -4, w: 8, d: 1.4, h: 1.6, color: 0x9a7d55 }, // low cover

    // ── Mid (central N–S lane) ────────────────────────────
    { x: -2, z: -4, w: 1.5, d: 18, h: 3.0, color: 0xae9068 },
    { x: 4, z: 2, w: 1.5, d: 16, h: 3.0, color: 0xc2a87a },
    { x: 0, z: 12, w: 14, d: 1.5, h: 2.9, color: 0xb89a6e },
    { x: 1, z: -16, w: 10, d: 1.5, h: 2.9, color: 0xae9068 },
    // mid doors / gaps created by broken segments
    { x: -6, z: 4, w: 6, d: 1.4, h: 1.5, color: 0x9a7d55 },

    // ── B tunnels (west) ──────────────────────────────────
    { x: -18, z: 4, w: 1.5, d: 22, h: 3.0, color: 0xc2a87a },
    { x: -26, z: 8, w: 1.5, d: 18, h: 3.0, color: 0xb89a6e },
    { x: -22, z: 20, w: 14, d: 1.5, h: 3.0, color: 0xae9068 },
    { x: -14, z: 14, w: 1.5, d: 10, h: 2.9, color: 0xc2a87a },
    // tunnel underpass feel
    { x: -20, z: -6, w: 12, d: 1.5, h: 2.6, color: 0x8a7858 },
    { x: -12, z: -10, w: 1.5, d: 12, h: 2.8, color: 0xb89a6e },

    // ── CT mid connector ──────────────────────────────────
    { x: 14, z: 14, w: 12, d: 1.5, h: 2.9, color: 0xc2a87a },
    { x: 16, z: 8, w: 1.5, d: 10, h: 2.8, color: 0xae9068 },

    // ── Cover blocks (playable low walls) ─────────────────
    { x: -8, z: -2, w: 3.0, d: 1.4, h: 1.5, color: 0xa88858 },
    { x: 6, z: 6, w: 2.5, d: 2.5, h: 1.5, color: 0x9a7d55 },
    { x: 20, z: -10, w: 2.2, d: 1.4, h: 1.5, color: 0xa88858 },
    { x: -22, z: 12, w: 2.4, d: 1.4, h: 1.5, color: 0x9a7d55 },
    { x: 0, z: 22, w: 4, d: 1.4, h: 1.6, color: 0xa88858 },
    { x: -4, z: -22, w: 3.5, d: 1.4, h: 1.5, color: 0x9a7d55 },
  ],
  props: [
    // Long A crates
    { x: 22, z: -8, w: 1.5, d: 1.5, h: 1.3, color: 0x8b6914, kind: "crate" },
    { x: 23.2, z: -6.8, w: 1.4, d: 1.4, h: 1.2, color: 0x7a5c12, kind: "crate" },
    { x: 20, z: -18, w: 1.6, d: 1.5, h: 1.4, color: 0x8b6914, kind: "crate" },
    { x: 24, z: -20, w: 1.3, d: 1.3, h: 1.2, color: 0x6e4f10, kind: "crate" },
    // Mid
    { x: 0, z: 0, w: 1.5, d: 1.5, h: 1.3, color: 0x7a5c12, kind: "crate" },
    { x: 2, z: 2, w: 1.3, d: 1.3, h: 1.15, color: 0x8b6914, kind: "crate" },
    { x: -1, z: 8, w: 0.9, d: 0.9, h: 1.3, color: 0x3d5c3a, kind: "barrel" },
    { x: 5, z: -2, w: 0.9, d: 0.9, h: 1.25, color: 0x4a3b1a, kind: "barrel" },
    // B site
    { x: -20, z: 16, w: 1.6, d: 1.6, h: 1.4, color: 0x8b6914, kind: "crate" },
    { x: -18, z: 18, w: 1.4, d: 1.4, h: 1.2, color: 0x7a5c12, kind: "crate" },
    { x: -24, z: 14, w: 1.5, d: 1.5, h: 1.3, color: 0x6e4f10, kind: "crate" },
    { x: -16, z: 22, w: 0.9, d: 0.9, h: 1.3, color: 0x3d5c3a, kind: "barrel" },
    // containers as landmark
    { x: 12, z: 20, w: 3.2, d: 1.6, h: 2.4, color: 0x1a5c4a, kind: "container" },
    { x: -28, z: 0, w: 3.0, d: 1.5, h: 2.3, color: 0x8b3a2a, kind: "container" },
    // cars near spawns
    { x: -24, z: -24, w: 3.0, d: 1.4, h: 1.15, color: 0x4a5568, kind: "car" },
    { x: 24, z: 24, w: 2.9, d: 1.35, h: 1.1, color: 0x2d3748, kind: "car" },
    { x: 8, z: -24, w: 2.8, d: 1.3, h: 1.1, color: 0x3d4654, kind: "car" },
    { x: -8, z: 26, w: 2.7, d: 1.3, h: 1.05, color: 0x5a4a40, kind: "car" },
    // dumpsters / poles
    { x: 16, z: 2, w: 2.0, d: 1.3, h: 1.45, color: 0x3f4a3a, kind: "dumpster" },
    { x: -10, z: 8, w: 1.9, d: 1.2, h: 1.4, color: 0x3a5040, kind: "dumpster" },
    { x: 4, z: -20, w: 0.15, d: 0.15, h: 3.2, color: 0x333333, kind: "pole" },
    { x: -16, z: -4, w: 0.15, d: 0.15, h: 3.0, color: 0x333333, kind: "pole" },
    { x: 20, z: 10, w: 0.15, d: 0.15, h: 3.1, color: 0x333333, kind: "pole" },
    // debris
    { x: 2, z: 16, w: 0.6, d: 0.6, h: 0.35, color: 0x6a5a40, kind: "debris" },
    { x: -6, z: -12, w: 0.55, d: 0.5, h: 0.3, color: 0x5a4a30, kind: "debris" },
    { x: 14, z: -2, w: 0.5, d: 0.55, h: 0.35, color: 0x6b5535, kind: "debris" },
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
    { id: "A", x: 24, z: -20, radius: 4.2 },
    { id: "B", x: -20, z: 18, radius: 4.2 },
  ],
  billboards: [
    {
      x: -30,
      z: -8,
      rotY: Math.PI / 2,
      width: 7,
      height: 3.6,
      adId: "army-recruit",
      style: "tower",
    },
    {
      x: 30,
      z: 6,
      rotY: -Math.PI / 2,
      width: 7,
      height: 3.6,
      adId: "energy-rush",
      style: "tower",
    },
    {
      x: 0,
      z: -32,
      rotY: 0,
      width: 9,
      height: 3.8,
      adId: "himetrica",
      style: "tower",
    },
    {
      x: 10,
      z: 32,
      rotY: Math.PI,
      width: 7.5,
      height: 3.4,
      adId: "amigo-bet",
      style: "tower",
    },
    {
      x: -12,
      z: 32,
      rotY: Math.PI,
      width: 6.5,
      height: 3.2,
      adId: "ff-sponsor",
      style: "tower",
    },
  ],
  wallPosters: [
    { x: -1.2, y: 1.6, z: -4, rotY: Math.PI / 2, w: 2.2, h: 1.6, adId: "tech-boot" },
    { x: 4.8, y: 1.5, z: 2, rotY: -Math.PI / 2, w: 2, h: 1.5, adId: "himetrica" },
    { x: -18, y: 1.7, z: 3.2, rotY: Math.PI / 2, w: 2.4, h: 1.5, adId: "energy-rush" },
    { x: 18.8, y: 1.6, z: -8, rotY: -Math.PI / 2, w: 2.2, h: 1.4, adId: "army-recruit" },
  ],
};
