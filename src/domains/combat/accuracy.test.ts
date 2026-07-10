import { describe, expect, it } from "vitest";
import {
  AIR_INACCURACY,
  applySpreadToYaw,
  CROUCH_INACCURACY,
  knobsForWeapon,
  movementFactor,
  nextShotsInBurst,
  shotSpreadRadians,
  STOP_SPEED_FRACTION,
} from "./accuracy";
import { applyDamage } from "./damage";
import { WEAPONS } from "./weapons";

const standSpeed = 6.5;

function akBase(partial: Partial<Parameters<typeof shotSpreadRadians>[0]> = {}) {
  return shotSpreadRadians({
    weaponId: "ak47",
    speed: 0,
    standSpeed,
    airborne: false,
    crouching: false,
    shotsInBurst: 0,
    msSinceLastShot: 10_000,
    ...partial,
  });
}

describe("movementFactor", () => {
  it("is 0 when stopped below threshold", () => {
    expect(movementFactor(0, standSpeed)).toBe(0);
    expect(
      movementFactor(standSpeed * STOP_SPEED_FRACTION * 0.99, standSpeed),
    ).toBe(0);
  });

  it("ramps to 1 at full stand speed", () => {
    expect(movementFactor(standSpeed * 0.5, standSpeed)).toBeCloseTo(0.5);
    expect(movementFactor(standSpeed, standSpeed)).toBe(1);
    expect(movementFactor(standSpeed * 2, standSpeed)).toBe(1);
  });
});

describe("shotSpreadRadians", () => {
  it("stop σ < walk σ < full run σ", () => {
    const stop = akBase({ speed: 0 });
    const walk = akBase({ speed: standSpeed * 0.4 });
    const run = akBase({ speed: standSpeed });
    expect(stop).toBeLessThan(walk);
    expect(walk).toBeLessThan(run);
  });

  it("air σ is ~3× grounded stop", () => {
    const ground = akBase({ speed: 0, airborne: false });
    const air = akBase({ speed: 0, airborne: true });
    expect(air).toBeCloseTo(ground * AIR_INACCURACY);
    expect(air).toBeGreaterThan(ground);
  });

  it("crouch σ < stand at same (stopped) speed", () => {
    const stand = akBase({ crouching: false, speed: 0 });
    const crouch = akBase({ crouching: true, speed: 0 });
    expect(crouch).toBeCloseTo(stand * CROUCH_INACCURACY);
    expect(crouch).toBeLessThan(stand);
  });

  it("crouch does not stack while airborne", () => {
    const airStand = akBase({ airborne: true, crouching: false });
    const airCrouch = akBase({ airborne: true, crouching: true });
    expect(airCrouch).toBeCloseTo(airStand);
  });

  it("first shot < burst shot N", () => {
    const first = akBase({ shotsInBurst: 0, msSinceLastShot: 10_000 });
    const burst5 = akBase({ shotsInBurst: 5, msSinceLastShot: 50 });
    expect(first).toBeLessThan(burst5);
  });

  it("recovery restores first-shot tightness", () => {
    const knobs = knobsForWeapon("ak47");
    const spray = akBase({ shotsInBurst: 6, msSinceLastShot: 40 });
    const recovered = akBase({
      shotsInBurst: 6,
      msSinceLastShot: knobs.recoveryMs,
    });
    const trueFirst = akBase({ shotsInBurst: 0, msSinceLastShot: 10_000 });
    expect(recovered).toBeCloseTo(trueFirst);
    expect(recovered).toBeLessThan(spray);
  });

  it("AWP move scale hurts more than AK when running", () => {
    const akRun = akBase({ weaponId: "ak47", speed: standSpeed });
    const akStop = akBase({ weaponId: "ak47", speed: 0 });
    const awpRun = akBase({ weaponId: "awp", speed: standSpeed });
    const awpStop = akBase({ weaponId: "awp", speed: 0 });
    const akRatio = akRun / akStop;
    const awpRatio = awpRun / awpStop;
    expect(awpRatio).toBeGreaterThan(akRatio);
  });

  it("knife / zero spread stays perfect", () => {
    expect(
      shotSpreadRadians({
        weaponId: "knife",
        speed: standSpeed,
        standSpeed,
        airborne: true,
        crouching: false,
        shotsInBurst: 3,
        msSinceLastShot: 0,
      }),
    ).toBe(0);
  });
});

describe("applySpreadToYaw", () => {
  it("returns yaw unchanged when spread is 0", () => {
    expect(applySpreadToYaw(1.2, 0, () => 0.9)).toBe(1.2);
  });

  it("offsets within ±spread", () => {
    const yaw = 0.5;
    const spread = 0.1;
    expect(applySpreadToYaw(yaw, spread, () => 0)).toBeCloseTo(yaw - spread);
    expect(applySpreadToYaw(yaw, spread, () => 1)).toBeCloseTo(yaw + spread);
    expect(applySpreadToYaw(yaw, spread, () => 0.5)).toBeCloseTo(yaw);
  });
});

describe("nextShotsInBurst", () => {
  it("resets to 1 after recovery window", () => {
    expect(nextShotsInBurst(7, 500, 280)).toBe(1);
  });

  it("increments within burst", () => {
    expect(nextShotsInBurst(3, 50, 280)).toBe(4);
  });
});

describe("AWP armor pen", () => {
  it("one-shots full-armor body (100 hp / 100 armor)", () => {
    const awp = WEAPONS.awp;
    expect(awp.armorPen).toBe(1);
    const r = applyDamage(
      { hp: 100, armor: 100 },
      awp.damage,
      { armorPen: awp.armorPen },
    );
    expect(r.hp).toBeLessThanOrEqual(0);
    // Still chips armor lightly
    expect(r.armor).toBeLessThan(100);
    expect(r.absorbed).toBeGreaterThan(0);
  });

  it("generic rifle does not one-shot full armor", () => {
    const ak = WEAPONS.ak47;
    const r = applyDamage({ hp: 100, armor: 100 }, ak.damage);
    expect(r.hp).toBeGreaterThan(0);
  });
});
