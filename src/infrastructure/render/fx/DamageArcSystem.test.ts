import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  DamageArcSystem,
  damageArcRotationZ,
} from "./DamageArcSystem";

describe("damageArcRotationZ", () => {
  it("maps ring +X sector to attacker on XZ (not game-yaw +Z basis)", () => {
    // Attacker along +X → no extra spin (sector already faces +X)
    expect(damageArcRotationZ(1, 0)).toBeCloseTo(0, 6);
    // Attacker along +Z → −π/2 so +X swings toward +Z
    expect(damageArcRotationZ(0, 1)).toBeCloseTo(-Math.PI / 2, 6);
    // Attacker along −X
    expect(damageArcRotationZ(-1, 0)).toBeCloseTo(-Math.PI, 6);
    // Attacker along −Z
    expect(damageArcRotationZ(0, -1)).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe("DamageArcSystem orientation", () => {
  const cases: Array<{ fromX: number; fromZ: number; label: string }> = [
    { fromX: 0, fromZ: 5, label: "+Z" },
    { fromX: 5, fromZ: 0, label: "+X" },
    { fromX: 0, fromZ: -5, label: "−Z" },
    { fromX: -5, fromZ: 0, label: "−X" },
    { fromX: 3, fromZ: 4, label: "diagonal" },
  ];

  for (const c of cases) {
    it(`wedge faces attacker from ${c.label}`, () => {
      const scene = new THREE.Scene();
      const arc = new DamageArcSystem(scene);
      arc.spawn(0, 0, c.fromX, c.fromZ);
      expect(arc.isActive).toBe(true);

      const dir = arc.wedgeDirectionXZ();
      expect(dir).not.toBeNull();
      const len = Math.hypot(c.fromX, c.fromZ);
      const ex = c.fromX / len;
      const ez = c.fromZ / len;
      const dot = dir!.x * ex + dir!.z * ez;
      expect(dot).toBeGreaterThan(0.99);

      arc.dispose();
    });
  }

  it("ignores zero-length source vector", () => {
    const scene = new THREE.Scene();
    const arc = new DamageArcSystem(scene);
    arc.spawn(1, 2, 1, 2);
    expect(arc.isActive).toBe(false);
    arc.dispose();
  });
});
