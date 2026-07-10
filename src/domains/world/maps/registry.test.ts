import { describe, expect, it } from "vitest";
import { getMapById, listMaps, MAP_IDS } from "./registry";
import { MAP_DUST } from "./dust";
import { MAP_FAVELA } from "./favela";
import { MAP_YARD } from "./yard";

describe("listMaps", () => {
  it("returns exactly three maps", () => {
    expect(listMaps()).toHaveLength(3);
    expect(MAP_IDS).toHaveLength(3);
  });

  it("includes dust, favela, and yard in order", () => {
    const maps = listMaps();
    expect(maps.map((m) => m.id)).toEqual(["dust", "favela", "yard"]);
    expect(maps[0]).toBe(MAP_DUST);
    expect(maps[1]).toBe(MAP_FAVELA);
    expect(maps[2]).toBe(MAP_YARD);
  });
});

describe("getMapById", () => {
  it("returns each registered map", () => {
    expect(getMapById("dust")).toBe(MAP_DUST);
    expect(getMapById("favela")).toBe(MAP_FAVELA);
    expect(getMapById("yard")).toBe(MAP_YARD);
  });

  it("falls back to dust for unknown ids", () => {
    expect(getMapById("unknown")).toBe(MAP_DUST);
    expect(getMapById("")).toBe(MAP_DUST);
    expect(getMapById("de_dust_ff")).toBe(MAP_DUST);
  });

  it("maps have required layout fields", () => {
    for (const map of listMaps()) {
      expect(map.displayName.length).toBeGreaterThan(0);
      expect(map.spawns.filter((s) => s.team === "TR").length).toBeGreaterThan(0);
      expect(map.spawns.filter((s) => s.team === "CT").length).toBeGreaterThan(0);
      expect(map.bombSites.length).toBeGreaterThanOrEqual(2);
      expect(map.walls.length).toBeGreaterThan(0);
      expect(map.billboards.length).toBeGreaterThan(0);
      // CS-scale playable area
      expect(map.size.width).toBeGreaterThanOrEqual(64);
      expect(map.size.depth).toBeGreaterThanOrEqual(64);
    }
  });

  it("maps expose accent hex + blurb for UI chips", () => {
    for (const map of listMaps()) {
      expect(map.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect((map.blurb ?? "").length).toBeGreaterThan(0);
    }
    expect(getMapById("dust").accent).toBe("#c4a574");
    expect(getMapById("favela").accent).toBe("#e85a5a");
    expect(getMapById("yard").accent).toBe("#708090");
  });
});
