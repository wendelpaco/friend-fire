import { describe, expect, it } from "vitest";
import { defaultPostDeathLoadout, teamPistol } from "./loadout";

describe("post-death loadout", () => {
  it("TR starts with glock + knife, no armor", () => {
    expect(teamPistol("TR")).toBe("glock");
    const d = defaultPostDeathLoadout("TR");
    expect(d.weapons[2]).toBe("glock");
    expect(d.weapons[4]).toBe("knife");
    expect(d.armor).toBe(0);
    expect(d.heCount).toBe(0);
    expect(d.ammo.glock?.mag).toBeGreaterThan(0);
  });

  it("CT starts with usp + knife", () => {
    expect(teamPistol("CT")).toBe("usp");
    const d = defaultPostDeathLoadout("CT");
    expect(d.weapons[2]).toBe("usp");
  });
});
