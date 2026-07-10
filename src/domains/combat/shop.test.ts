import { describe, expect, it } from "vitest";
import {
  canOpenBuyMenu,
  snapshotRebuyItemIds,
  tryBuy,
  tryBuyKit,
  tryRebuy,
} from "./shop";

describe("canOpenBuyMenu", () => {
  it("allows warmup and buy only", () => {
    expect(canOpenBuyMenu("warmup")).toBe(true);
    expect(canOpenBuyMenu("buy")).toBe(true);
    expect(canOpenBuyMenu("ended")).toBe(false);
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

  it("rejects weapon already equipped", () => {
    const armed = {
      ...base,
      weapons: { 1: "ak47" as const, 2: "glock" as const, 4: "knife" as const },
      ammo: {
        glock: { mag: 20, reserve: 100 },
        ak47: { mag: 30, reserve: 90 },
      },
    };
    const r = tryBuy(armed, "ak47");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/já equipada/i);
  });

  it("buys HE grenade at 300 and stacks heCount", () => {
    const r = tryBuy(base, "he");
    expect(r.ok).toBe(true);
    if (!r.ok || !r.player) return;
    expect(r.player.money).toBe(3000 - 300);
    expect(r.player.heCount).toBe(1);

    const r2 = tryBuy({ ...r.player }, "he");
    expect(r2.ok).toBe(true);
    if (!r2.ok || !r2.player) return;
    expect(r2.player.heCount).toBe(2);
    expect(r2.player.money).toBe(3000 - 600);
  });
});

describe("tryBuyKit / tryRebuy", () => {
  const base = {
    money: 4000,
    armor: 0,
    weapons: { 2: "glock" as const, 4: "knife" as const },
    ammo: { glock: { mag: 20, reserve: 100 } },
    weaponSlot: 2,
  };

  it("FULL kit buys rifle when affordable", () => {
    const r = tryBuyKit(base, "FULL");
    expect(r.ok).toBe(true);
    if (!r.ok || !r.player) return;
    expect(r.bought.length).toBeGreaterThan(0);
    expect(r.player.money).toBeLessThan(base.money);
    expect(
      r.player.weapons[1] === "ak47" || r.player.weapons[1] === "awp",
    ).toBe(true);
  });

  it("rejects kit when broke", () => {
    const r = tryBuyKit({ ...base, money: 100 }, "FULL");
    expect(r.ok).toBe(false);
  });

  it("rebuy purchases prior loadout items", () => {
    const r = tryRebuy(base, ["ak47", "armor"]);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.player) return;
    expect(r.player.weapons[1]).toBe("ak47");
    expect(r.player.armor).toBe(100);
  });

  it("rebuy skips already-owned weapons and still buys missing gear", () => {
    const survivor = {
      ...base,
      money: 4000,
      armor: 0,
      weapons: {
        1: "ak47" as const,
        2: "glock" as const,
        4: "knife" as const,
      },
      ammo: {
        glock: { mag: 20, reserve: 100 },
        ak47: { mag: 10, reserve: 90 },
      },
    };
    const r = tryRebuy(survivor, ["ak47", "armor"]);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.player) return;
    expect(r.bought).toEqual(["armor"]);
    expect(r.player.weapons[1]).toBe("ak47");
    expect(r.player.armor).toBe(100);
    expect(r.player.money).toBe(4000 - 650);
  });

  it("snapshotRebuyItemIds captures primary + armor", () => {
    expect(
      snapshotRebuyItemIds({
        primaryId: "ak47",
        secondaryId: "glock",
        teamPistolId: "glock",
        armor: 100,
      }),
    ).toEqual(["ak47", "armor"]);
  });
});
