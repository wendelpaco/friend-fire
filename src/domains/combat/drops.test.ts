import { describe, expect, it } from "vitest";
import {
  WEAPON_DROP_PICKUP_RADIUS,
  applyWeaponPickup,
  applyWeaponPickupServer,
  createDeathWeaponDrops,
  createDeathWeaponDropsFromIds,
  findNearestWeaponDrop,
  isDroppableWeaponId,
  squaredDistXZ,
  type WorldWeaponDrop,
} from "./drops";

describe("isDroppableWeaponId", () => {
  it("rejects knife and unknown", () => {
    expect(isDroppableWeaponId("knife")).toBe(false);
    expect(isDroppableWeaponId("")).toBe(false);
    expect(isDroppableWeaponId(null)).toBe(false);
    expect(isDroppableWeaponId("nope")).toBe(false);
  });

  it("accepts guns", () => {
    expect(isDroppableWeaponId("ak47")).toBe(true);
    expect(isDroppableWeaponId("glock")).toBe(true);
    expect(isDroppableWeaponId("awp")).toBe(true);
  });
});

describe("createDeathWeaponDrops", () => {
  it("drops primary and secondary with ammo, not knife", () => {
    let n = 0;
    const drops = createDeathWeaponDrops(
      {
        playerId: "p1",
        x: 10,
        z: 20,
        weapons: { 1: "ak47", 2: "glock", 4: "knife" },
        ammo: {
          ak47: { mag: 12, reserve: 40 },
          glock: { mag: 5, reserve: 80 },
        },
      },
      () => `d${++n}`,
    );
    expect(drops).toHaveLength(2);
    expect(drops.map((d) => d.weaponId).sort()).toEqual(["ak47", "glock"]);
    expect(drops.every((d) => d.fromPlayerId === "p1")).toBe(true);
    const ak = drops.find((d) => d.weaponId === "ak47")!;
    expect(ak.ammoMag).toBe(12);
    expect(ak.ammoReserve).toBe(40);
    // Offsets differ so entities do not share exact point
    expect(drops[0]!.x !== drops[1]!.x || drops[0]!.z !== drops[1]!.z).toBe(
      true,
    );
  });

  it("skips empty slots", () => {
    const drops = createDeathWeaponDrops(
      {
        playerId: "p2",
        x: 0,
        z: 0,
        weapons: { 2: "usp", 4: "knife" },
        ammo: { usp: { mag: 8, reserve: 24 } },
      },
      () => "only",
    );
    expect(drops).toHaveLength(1);
    expect(drops[0]!.weaponId).toBe("usp");
  });

  it("server id helper maps primary/secondary", () => {
    const drops = createDeathWeaponDropsFromIds(
      {
        playerId: "s1",
        x: 1,
        z: 2,
        primaryId: "mp5",
        secondaryId: "deagle",
        ammo: {
          mp5: { mag: 20, reserve: 60 },
          deagle: { mag: 3, reserve: 10 },
        },
      },
      () => "x",
    );
    expect(drops.map((d) => d.weaponId).sort()).toEqual(["deagle", "mp5"]);
  });
});

describe("findNearestWeaponDrop", () => {
  const drops: WorldWeaponDrop[] = [
    {
      id: "a",
      x: 0,
      z: 0,
      weaponId: "ak47",
      ammoMag: 1,
      ammoReserve: 0,
      fromPlayerId: "p",
    },
    {
      id: "b",
      x: 5,
      z: 0,
      weaponId: "glock",
      ammoMag: 1,
      ammoReserve: 0,
      fromPlayerId: "p",
    },
  ];

  it("returns null when out of range", () => {
    expect(findNearestWeaponDrop(drops, 10, 10, 1.2)).toBeNull();
  });

  it("picks nearest within radius", () => {
    expect(findNearestWeaponDrop(drops, 0.5, 0, WEAPON_DROP_PICKUP_RADIUS)?.id).toBe(
      "a",
    );
    expect(findNearestWeaponDrop(drops, 5.1, 0, WEAPON_DROP_PICKUP_RADIUS)?.id).toBe(
      "b",
    );
  });
});

describe("applyWeaponPickup", () => {
  it("equips empty primary slot", () => {
    const drop: WorldWeaponDrop = {
      id: "d1",
      x: 0,
      z: 0,
      weaponId: "ak47",
      ammoMag: 15,
      ammoReserve: 30,
      fromPlayerId: "dead",
    };
    const result = applyWeaponPickup(
      {
        weapons: { 2: "glock", 4: "knife" },
        ammo: { glock: { mag: 10, reserve: 50 } },
        weaponSlot: 2,
      },
      drop,
      { x: 0, z: 0, id: "alive" },
    );
    expect(result).not.toBeNull();
    expect(result!.player.weapons[1]).toBe("ak47");
    expect(result!.player.weapons[2]).toBe("glock");
    expect(result!.player.ammo.ak47).toEqual({ mag: 15, reserve: 30 });
    expect(result!.player.weaponSlot).toBe(1);
    expect(result!.removeDropId).toBe("d1");
    expect(result!.swapDrop).toBeNull();
  });

  it("swaps existing primary onto the ground", () => {
    const drop: WorldWeaponDrop = {
      id: "d2",
      x: 1,
      z: 1,
      weaponId: "awp",
      ammoMag: 5,
      ammoReserve: 10,
      fromPlayerId: "dead",
    };
    const result = applyWeaponPickup(
      {
        weapons: { 1: "ak47", 2: "glock", 4: "knife" },
        ammo: {
          ak47: { mag: 20, reserve: 70 },
          glock: { mag: 12, reserve: 40 },
        },
        weaponSlot: 1,
      },
      drop,
      { x: 3, z: 4, id: "picker" },
    );
    expect(result!.player.weapons[1]).toBe("awp");
    expect(result!.swapDrop).toEqual({
      x: 3,
      z: 4,
      weaponId: "ak47",
      ammoMag: 20,
      ammoReserve: 70,
      fromPlayerId: "picker",
    });
    expect(result!.player.ammo.ak47).toBeUndefined();
    expect(result!.player.ammo.awp).toEqual({ mag: 5, reserve: 10 });
  });

  it("rejects knife drop", () => {
    const drop = {
      id: "k",
      x: 0,
      z: 0,
      weaponId: "knife" as const,
      ammoMag: 0,
      ammoReserve: 0,
      fromPlayerId: "p",
    };
    expect(
      applyWeaponPickup(
        { weapons: { 4: "knife" }, ammo: {}, weaponSlot: 4 },
        drop,
        { x: 0, z: 0 },
      ),
    ).toBeNull();
  });
});

describe("applyWeaponPickupServer", () => {
  it("writes primaryId / mag from drop", () => {
    const drop: WorldWeaponDrop = {
      id: "sd",
      x: 0,
      z: 0,
      weaponId: "galil",
      ammoMag: 22,
      ammoReserve: 55,
      fromPlayerId: "x",
    };
    const r = applyWeaponPickupServer(
      {
        id: "p",
        x: 0,
        z: 0,
        primaryId: "",
        secondaryId: "usp",
        activeSlot: 2,
        mag: 12,
        reserve: 100,
      },
      { usp: { mag: 12, reserve: 100 } },
      drop,
    );
    expect(r).not.toBeNull();
    expect(r!.primaryId).toBe("galil");
    expect(r!.secondaryId).toBe("usp");
    expect(r!.activeSlot).toBe(1);
    expect(r!.mag).toBe(22);
    expect(r!.reserve).toBe(55);
    expect(r!.ammo.galil).toEqual({ mag: 22, reserve: 55 });
  });
});

describe("squaredDistXZ", () => {
  it("matches hypot squared", () => {
    expect(squaredDistXZ(0, 0, 3, 4)).toBe(25);
  });
});
