import { describe, expect, it } from "vitest";
import { applyDamage, isDead } from "./damage";

describe("applyDamage", () => {
  it("reduces armor then hp", () => {
    const r = applyDamage({ hp: 100, armor: 50 }, 40);
    expect(r.hp).toBeLessThan(100);
    expect(r.armor).toBeLessThan(50);
  });

  it("applies known armor formula", () => {
    // absorbed = min(50, 40*0.5) = 20; armor = 30; dmg = 40 - 10 = 30; hp = 70
    const r = applyDamage({ hp: 100, armor: 50 }, 40);
    expect(r.absorbed).toBe(20);
    expect(r.armor).toBe(30);
    expect(r.hp).toBe(70);
  });

  it("passes full damage when no armor", () => {
    const r = applyDamage({ hp: 100, armor: 0 }, 40);
    expect(r.absorbed).toBe(0);
    expect(r.armor).toBe(0);
    expect(r.hp).toBe(60);
  });

  it("kills at 0 hp", () => {
    const r = applyDamage({ hp: 10, armor: 0 }, 50);
    expect(isDead(r.hp)).toBe(true);
  });
});
