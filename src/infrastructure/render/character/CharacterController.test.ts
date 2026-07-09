import { describe, expect, it } from "vitest";
import { deltaAngle } from "@/domains/fx";
import { CharacterController } from "./CharacterController";

const DT = 1 / 60;

function run(
  c: CharacterController,
  frames: number,
  input: { moveX: number; moveZ: number; aimYaw: number },
) {
  let state = c.update({ ...input, dt: DT });
  for (let i = 1; i < frames; i++) state = c.update({ ...input, dt: DT });
  return state;
}

describe("CharacterController — orientation polish", () => {
  it("ignores speed jitter below the enter threshold (keeps facing aim)", () => {
    const c = new CharacterController();
    c.reset(0);
    // Noisy sub-threshold speed toward +X (would be yaw π/2 if honored)
    for (let i = 0; i < 120; i++) {
      const s = i % 2 === 0 ? 0.25 : 0.45;
      c.update({ moveX: s, moveZ: 0, aimYaw: 0, dt: DT });
    }
    expect(Math.abs(deltaAngle(c.yaw, 0))).toBeLessThan(0.05);
  });

  it("faces velocity after clearing the enter threshold", () => {
    const c = new CharacterController();
    c.reset(0);
    const state = run(c, 120, { moveX: 2, moveZ: 0, aimYaw: 0 });
    expect(Math.abs(deltaAngle(c.yaw, Math.PI / 2))).toBeLessThan(0.05);
    expect(state.weights.idle).toBeLessThan(0.05);
  });

  it("caps turn rate on a 180° reversal (no snap flip)", () => {
    const c = new CharacterController();
    c.reset(0);
    run(c, 120, { moveX: 0, moveZ: 3, aimYaw: 0 }); // settle facing +Z (yaw 0)
    let prev = c.yaw;
    for (let i = 0; i < 90; i++) {
      c.update({ moveX: 0, moveZ: -3, aimYaw: 0, dt: DT });
      const step = Math.abs(deltaAngle(prev, c.yaw));
      expect(step).toBeLessThanOrEqual(12.5 * DT + 1e-6);
      prev = c.yaw;
    }
    // ended up facing −Z (yaw π)
    expect(Math.abs(deltaAngle(c.yaw, Math.PI))).toBeLessThan(0.05);
  });

  it("smooths weights: direction flip does not jump channels in one frame", () => {
    const c = new CharacterController();
    c.reset(0);
    run(c, 120, { moveX: 0, moveZ: 3, aimYaw: 0 }); // settled forward
    const before = c.update({ moveX: 3, moveZ: 0, aimYaw: 0, dt: DT });
    // one frame after a 90° direction change: strafe/forward must be mid-blend
    const sum =
      before.weights.idle +
      before.weights.forward +
      before.weights.backward +
      before.weights.strafeLeft +
      before.weights.strafeRight;
    expect(sum).toBeCloseTo(1, 5);
    expect(before.weights.forward).toBeGreaterThan(0.5); // still mostly forward
  });

  it("stops: returns to idle weights and faces aim again", () => {
    const c = new CharacterController();
    c.reset(0);
    run(c, 120, { moveX: 2, moveZ: 0, aimYaw: 1.0 });
    const state = run(c, 180, { moveX: 0, moveZ: 0, aimYaw: 1.0 });
    expect(state.weights.idle).toBeGreaterThan(0.95);
    expect(Math.abs(deltaAngle(c.yaw, 1.0))).toBeLessThan(0.05);
  });
});
