import { describe, expect, it } from "vitest";
import {
  BOMB_TIMER,
  DEFUSE_TIME,
  PLANT_TIME,
  canDefuse,
  canPlant,
  createBombState,
  explode,
  onDefuseComplete,
  onPlantComplete,
  tickBombTimer,
  tickDefuse,
  tickPlant,
  type BombMatchState,
} from "./bomb";

const site = { x: 0, z: 0, radius: 3.5 };

function plantedAt(x = 0, z = 0): BombMatchState {
  return onPlantComplete(createBombState("tr1"), x, z);
}

describe("bomb constants", () => {
  it("matches Wave 5 timings", () => {
    expect(PLANT_TIME).toBe(3.5);
    expect(DEFUSE_TIME).toBe(5);
    expect(BOMB_TIMER).toBe(40);
  });
});

describe("canPlant", () => {
  const base = {
    bomb: createBombState("tr1"),
    playerId: "tr1",
    team: "TR" as const,
    alive: true,
    x: 0,
    z: 0,
    stationary: true,
    site,
  };

  it("allows TR carrier stationary in site", () => {
    expect(canPlant(base)).toBe(true);
  });

  it("rejects CT, dead, moving, wrong carrier, outside site", () => {
    expect(canPlant({ ...base, team: "CT" })).toBe(false);
    expect(canPlant({ ...base, alive: false })).toBe(false);
    expect(canPlant({ ...base, stationary: false })).toBe(false);
    expect(canPlant({ ...base, playerId: "other" })).toBe(false);
    expect(canPlant({ ...base, x: 10, z: 10 })).toBe(false);
    expect(canPlant({ ...base, site: null })).toBe(false);
  });

  it("rejects after plant", () => {
    expect(canPlant({ ...base, bomb: plantedAt() })).toBe(false);
  });
});

describe("canDefuse", () => {
  const bomb = plantedAt(5, 5);
  const base = {
    bomb,
    team: "CT" as const,
    alive: true,
    x: 5,
    z: 5,
    radius: 2.5,
  };

  it("allows CT in defuse radius", () => {
    expect(canDefuse(base)).toBe(true);
  });

  it("rejects TR, dead, out of radius, not planted", () => {
    expect(canDefuse({ ...base, team: "TR" })).toBe(false);
    expect(canDefuse({ ...base, alive: false })).toBe(false);
    expect(canDefuse({ ...base, x: 20, z: 20 })).toBe(false);
    expect(canDefuse({ ...base, bomb: createBombState("tr1") })).toBe(false);
  });
});

describe("tickPlant / onPlantComplete", () => {
  it("advances progress and completes plant", () => {
    let b = createBombState("tr1");
    b = tickPlant(b, PLANT_TIME / 2, true, true);
    expect(b.bombState).toBe("planting");
    expect(b.plantProgress).toBeCloseTo(0.5);

    b = tickPlant(b, PLANT_TIME / 2, true, true);
    expect(b.plantProgress).toBe(1);

    b = onPlantComplete(b, 1, 2);
    expect(b.bombState).toBe("planted");
    expect(b.bombX).toBe(1);
    expect(b.bombZ).toBe(2);
    expect(b.bombTimer).toBe(BOMB_TIMER);
    expect(b.bombCarrierId).toBeNull();
  });

  it("cancels plant when not holding", () => {
    let b = createBombState("tr1");
    b = tickPlant(b, 1, true, true);
    b = tickPlant(b, 0.1, false, true);
    expect(b.bombState).toBe("carried");
    expect(b.plantProgress).toBe(0);
  });
});

describe("tickDefuse / onDefuseComplete", () => {
  it("advances defuse and completes", () => {
    let b = plantedAt();
    b = tickDefuse(b, DEFUSE_TIME / 2, true, true);
    expect(b.bombState).toBe("defusing");
    expect(b.defuseProgress).toBeCloseTo(0.5);

    b = tickDefuse(b, DEFUSE_TIME / 2, true, true);
    expect(b.defuseProgress).toBe(1);
    b = onDefuseComplete(b);
    expect(b.bombState).toBe("defused");
  });

  it("cancels defuse when interrupted", () => {
    let b = plantedAt();
    b = tickDefuse(b, 2, true, true);
    b = tickDefuse(b, 0.1, false, true);
    expect(b.bombState).toBe("planted");
    expect(b.defuseProgress).toBe(0);
  });
});

describe("tickBombTimer / explode", () => {
  it("counts down and explode ends round for TR", () => {
    let b = plantedAt();
    b = tickBombTimer(b, 10);
    expect(b.bombTimer).toBe(30);
    b = tickBombTimer(b, 40);
    expect(b.bombTimer).toBe(0);
    b = explode(b);
    expect(b.bombState).toBe("exploded");
  });

  it("does not tick while carried", () => {
    const b = createBombState("tr1");
    expect(tickBombTimer(b, 5)).toEqual(b);
  });
});
