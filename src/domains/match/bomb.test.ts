import { describe, expect, it } from "vitest";
import {
  BOMB_TIMER,
  DEFUSE_TIME,
  DEFUSE_TIME_KIT,
  PLANT_TIME,
  canDefuse,
  canPlant,
  createBombState,
  explode,
  isBombPlantedActive,
  onDefuseComplete,
  onPlantComplete,
  pickBombCarrier,
  shouldLiveTimerAwardCtWin,
  tickBombTimer,
  tickDefuse,
  tickPlant,
  type BombMatchState,
} from "./bomb";
import { createMatchPhase, tickPhase } from "./phases";

const site = { x: 0, z: 0, radius: 3.5 };

function plantedAt(x = 0, z = 0): BombMatchState {
  return onPlantComplete(createBombState("tr1"), x, z);
}

describe("bomb constants", () => {
  it("matches B2/F5 timings (no kit in catalog → DEFUSE_TIME_KIT reserved)", () => {
    expect(PLANT_TIME).toBe(3.5);
    expect(DEFUSE_TIME).toBe(5);
    expect(DEFUSE_TIME_KIT).toBe(3.5);
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

describe("isBombPlantedActive / shouldLiveTimerAwardCtWin", () => {
  it("is active for planted and defusing only", () => {
    expect(isBombPlantedActive(createBombState("tr1"))).toBe(false);
    expect(isBombPlantedActive(plantedAt())).toBe(true);
    const defusing = { ...plantedAt(), bombState: "defusing" as const };
    expect(isBombPlantedActive(defusing)).toBe(true);
    expect(isBombPlantedActive(explode(plantedAt()))).toBe(false);
    expect(isBombPlantedActive(onDefuseComplete(plantedAt()))).toBe(false);
  });

  it("planted + live timer must NOT award CT via bomb-aware path", () => {
    const bomb = plantedAt();
    expect(shouldLiveTimerAwardCtWin(bomb)).toBe(false);
    expect(shouldLiveTimerAwardCtWin({ ...bomb, bombState: "defusing" })).toBe(
      false,
    );

    // Mirror GameRoom / offline: when planted active, do not call tickPhase
    // for live→CT; only clamp the clock.
    let m = createMatchPhase({ roundTime: 1 });
    m = { ...m, phase: "live", round: 1, timeLeft: 0.5 };
    if (!shouldLiveTimerAwardCtWin(bomb)) {
      m = { ...m, timeLeft: Math.max(0, m.timeLeft - 1) };
    } else {
      m = tickPhase(m, 1);
    }
    expect(m.phase).toBe("live");
    expect(m.timeLeft).toBe(0);
    expect(m.scoreCT).toBe(0);
  });

  it("not planted → timer can still CT-win", () => {
    const bomb = createBombState("tr1");
    expect(shouldLiveTimerAwardCtWin(bomb)).toBe(true);

    let m = createMatchPhase({ roundTime: 1 });
    m = { ...m, phase: "live", round: 1, timeLeft: 0.5 };
    if (!shouldLiveTimerAwardCtWin(bomb)) {
      m = { ...m, timeLeft: Math.max(0, m.timeLeft - 1) };
    } else {
      m = tickPhase(m, 1);
    }
    expect(m.phase).toBe("ended");
    expect(m.scoreCT).toBe(1);
    expect(m.scoreTR).toBe(0);
  });
});

describe("pickBombCarrier", () => {
  it("prefers living non-bot TR over bots", () => {
    const id = pickBombCarrier(
      [
        { id: "bot1", isBot: true },
        { id: "human1", isBot: false },
        { id: "bot2", isBot: true },
      ],
      () => 0,
    );
    expect(id).toBe("human1");
  });

  it("falls back to bots when no human TR", () => {
    const id = pickBombCarrier(
      [
        { id: "bot1", isBot: true },
        { id: "bot2", isBot: true },
      ],
      () => 0.9,
    );
    expect(id).toBe("bot2");
  });

  it("returns empty string when no candidates", () => {
    expect(pickBombCarrier([])).toBe("");
  });
});
