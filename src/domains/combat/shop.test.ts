import { describe, expect, it } from "vitest";
import { canOpenBuyMenu, tryBuy } from "./shop";

describe("canOpenBuyMenu", () => {
  it("allows warmup and ended only", () => {
    expect(canOpenBuyMenu("warmup")).toBe(true);
    expect(canOpenBuyMenu("ended")).toBe(true);
    expect(canOpenBuyMenu("live")).toBe(false);
    expect(canOpenBuyMenu("match_over")).toBe(false);
  });
});

describe("tryBuy", () => {
  const base = {
    money: 3000,
    armor: 0,
    weapons: { 2: "glock" as const, 4: "knife" as const },
    ammo: { glock: { mag: 20, reserve: 100 } },
    weaponSlot: 2,
  };

  it("buys ak and equips slot 1", () => {
    const r = tryBuy(base, "ak47");
    expect(r.ok).toBe(true);
    if (!r.ok || !r.player) return;
    expect(r.player.money).toBe(3000 - 2700);
    expect(r.player.weapons[1]).toBe("ak47");
    expect(r.player.weaponSlot).toBe(1);
    expect(r.player.ammo.ak47?.mag).toBe(30);
  });

  it("rejects if broke", () => {
    const r = tryBuy({ ...base, money: 100 }, "ak47");
    expect(r.ok).toBe(false);
  });

  it("buys armor", () => {
    const r = tryBuy(base, "armor");
    expect(r.ok).toBe(true);
    if (!r.ok || !r.player) return;
    expect(r.player.armor).toBe(100);
  });
});
