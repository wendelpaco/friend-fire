import { describe, expect, it } from "vitest";
import {
  SHOWCASE_MS,
  showcaseWeaponIds,
  suggestKits,
} from "./kitSuggest";
import { SHOP_CATALOG } from "./shop";

describe("SHOWCASE_MS", () => {
  it("is 4 seconds (leaves ≥5s of a 10s freezetime for buy)", () => {
    expect(SHOWCASE_MS).toBe(4000);
  });
});

describe("suggestKits", () => {
  it("ECO suggests armor when money is under 2000 but can afford vest", () => {
    const kits = suggestKits(800);
    const eco = kits.find((k) => k.tier === "ECO");
    expect(eco).toBeDefined();
    expect(eco!.label).toBe("ECO");
    expect(eco!.itemIds).toContain("armor");
    expect(eco!.totalPrice).toBe(650);
  });

  it("ECO suggests pistol when broke for armor", () => {
    const kits = suggestKits(500);
    const eco = kits.find((k) => k.tier === "ECO");
    expect(eco).toBeDefined();
    expect(eco!.itemIds.some((id) => ["glock", "usp", "deagle"].includes(id))).toBe(
      true,
    );
  });

  it("FORCE suggests SMG or Galil mid-buy with FORÇA label", () => {
    const kits = suggestKits(1600);
    const force = kits.find((k) => k.tier === "FORCE");
    expect(force).toBeDefined();
    expect(force!.label).toBe("FORÇA");
    expect(
      force!.itemIds.includes("mp5") || force!.itemIds.includes("galil"),
    ).toBe(true);
    expect(force!.totalPrice).toBeLessThanOrEqual(1600);
  });

  it("FORCE with more money prefers Galil + armor when affordable", () => {
    const kits = suggestKits(2800);
    const force = kits.find((k) => k.tier === "FORCE");
    expect(force).toBeDefined();
    expect(force!.itemIds).toContain("galil");
  });

  it("FULL suggests AK when can afford rifle but not AWP", () => {
    const kits = suggestKits(3400);
    const full = kits.find((k) => k.tier === "FULL");
    expect(full).toBeDefined();
    expect(full!.label).toBe("COMPLETO");
    expect(full!.itemIds).toContain("ak47");
    expect(full!.itemIds).not.toContain("awp");
    expect(full!.totalPrice).toBeLessThanOrEqual(3400);
  });

  it("offers three tiers when money is high", () => {
    const kits = suggestKits(6000);
    expect(kits.map((k) => k.tier).sort()).toEqual(
      ["ECO", "FORCE", "FULL"].sort(),
    );
  });

  it("FULL suggests AWP when money is high enough", () => {
    const kits = suggestKits(6000);
    const full = kits.find((k) => k.tier === "FULL");
    expect(full).toBeDefined();
    expect(full!.itemIds).toContain("awp");
    expect(full!.totalPrice).toBeLessThanOrEqual(6000);
  });

  it("does not suggest FULL when money is too low", () => {
    const kits = suggestKits(1500);
    expect(kits.find((k) => k.tier === "FULL")).toBeUndefined();
  });

  it("every suggestion total matches catalog prices", () => {
    for (const money of [200, 500, 800, 1500, 2000, 2700, 3400, 5000, 8000]) {
      for (const kit of suggestKits(money)) {
        let sum = 0;
        for (const id of kit.itemIds) {
          const it = SHOP_CATALOG.find((c) => c.id === id);
          expect(it, `unknown item ${id}`).toBeDefined();
          sum += it!.price;
        }
        expect(kit.totalPrice).toBe(sum);
        expect(kit.totalPrice).toBeLessThanOrEqual(money);
      }
    }
  });
});

describe("showcaseWeaponIds", () => {
  it("returns up to 6 catalog ids", () => {
    const ids = showcaseWeaponIds(10000);
    expect(ids.length).toBeLessThanOrEqual(6);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(SHOP_CATALOG.some((c) => c.id === id)).toBe(true);
    }
  });

  it("prefers affordable weapons when money is low", () => {
    const ids = showcaseWeaponIds(700);
    expect(ids).toContain("deagle");
    expect(ids).toContain("armor");
  });
});
