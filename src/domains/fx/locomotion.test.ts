import { describe, expect, it } from "vitest";
import {
  DEFAULT_RUN_THRESHOLD,
  bodyYawTarget,
  bodyYawTargetMoving,
  deltaAngle,
  horizontalSpeed,
  locomotionDirFromLocal,
  locomotionFromDelta,
  locomotionFromSpeed,
  locomotionWeights,
  moveInFacingSpace,
  movingHysteresis,
  MOVE_ENTER_SPEED,
  MOVE_EXIT_SPEED,
  smoothYaw,
  yawFromDirection,
} from "./locomotion";

describe("locomotionFromSpeed", () => {
  it("is idle below default threshold 0.3", () => {
    expect(DEFAULT_RUN_THRESHOLD).toBe(0.3);
    expect(locomotionFromSpeed(0)).toBe("idle");
    expect(locomotionFromSpeed(0.299)).toBe("idle");
  });

  it("is run at or above threshold", () => {
    expect(locomotionFromSpeed(0.3)).toBe("run");
    expect(locomotionFromSpeed(5)).toBe("run");
  });

  it("respects custom threshold", () => {
    expect(locomotionFromSpeed(0.5, 1)).toBe("idle");
    expect(locomotionFromSpeed(1, 1)).toBe("run");
  });

  it("treats non-finite speed as idle", () => {
    expect(locomotionFromSpeed(Number.NaN)).toBe("idle");
  });
});

describe("horizontalSpeed / locomotionFromDelta", () => {
  it("computes m/s from delta", () => {
    expect(horizontalSpeed(3, 4, 1)).toBe(5);
    expect(horizontalSpeed(3, 4, 0.5)).toBe(10);
  });

  it("returns 0 for non-positive dt", () => {
    expect(horizontalSpeed(1, 0, 0)).toBe(0);
    expect(horizontalSpeed(1, 0, -1)).toBe(0);
  });

  it("maps delta to idle/run", () => {
    expect(locomotionFromDelta(0.2, 0, 1)).toBe("idle");
    expect(locomotionFromDelta(0.4, 0, 1)).toBe("run");
  });
});

describe("yawFromDirection (orientation fix)", () => {
  it("faces +Z when dx=0, dz>0", () => {
    expect(yawFromDirection(0, 1)).toBeCloseTo(0);
  });

  it("faces +X when dx>0, dz=0", () => {
    expect(yawFromDirection(1, 0)).toBeCloseTo(Math.PI / 2);
  });

  it("faces −Z when dx=0, dz<0", () => {
    expect(yawFromDirection(0, -1)).toBeCloseTo(Math.PI);
  });

  it("returns 0 for zero vector", () => {
    expect(yawFromDirection(0, 0)).toBe(0);
  });
});

describe("bodyYawTarget — chest follows velocity when moving", () => {
  it("uses velocity yaw when moving", () => {
    // move +X, aim −Z
    const yaw = bodyYawTarget(5, 0, Math.PI);
    expect(yaw).toBeCloseTo(Math.PI / 2);
  });

  it("uses aim yaw when nearly stopped", () => {
    const aim = Math.PI / 4;
    expect(bodyYawTarget(0.01, 0, aim)).toBeCloseTo(aim);
    expect(bodyYawTarget(0, 0, aim)).toBeCloseTo(aim);
  });

  it("pressing “forward” (+Z) never faces opposite of move", () => {
    const moveYaw = bodyYawTarget(0, 4, Math.PI); // aim is opposite, still face move
    expect(moveYaw).toBeCloseTo(0);
    // local +Z after this yaw points +Z = move dir, not −Z (back)
  });
});

describe("moveInFacingSpace + locomotionDir", () => {
  it("forward when move aligns with facing", () => {
    const { forward, right } = moveInFacingSpace(0, 5, 0);
    expect(forward).toBeCloseTo(5);
    expect(right).toBeCloseTo(0);
    expect(locomotionDirFromLocal(forward, right)).toBe("forward");
  });

  it("backward when move opposes facing", () => {
    const { forward, right } = moveInFacingSpace(0, -5, 0);
    expect(forward).toBeCloseTo(-5);
    expect(locomotionDirFromLocal(forward, right)).toBe("backward");
  });

  it("strafe right when move is local +X", () => {
    // facing +Z, move +X
    const { forward, right } = moveInFacingSpace(5, 0, 0);
    expect(right).toBeCloseTo(5);
    expect(locomotionDirFromLocal(forward, right)).toBe("strafeRight");
  });

  it("strafe left when move is local −X", () => {
    const { forward, right } = moveInFacingSpace(-5, 0, 0);
    expect(right).toBeCloseTo(-5);
    expect(locomotionDirFromLocal(forward, right)).toBe("strafeLeft");
  });
});

describe("locomotionWeights", () => {
  it("idle when stopped", () => {
    const w = locomotionWeights(0, 0, 0);
    expect(w.idle).toBe(1);
    expect(w.forward).toBe(0);
  });

  it("pure forward", () => {
    const w = locomotionWeights(0, 4, 0);
    expect(w.forward).toBeCloseTo(1);
    expect(w.backward).toBeCloseTo(0);
  });

  it("diagonal mixes forward + strafe", () => {
    const w = locomotionWeights(3, 3, 0);
    expect(w.forward).toBeGreaterThan(0.3);
    expect(w.strafeRight).toBeGreaterThan(0.3);
    expect(w.idle).toBe(0);
  });
});

describe("deltaAngle / smoothYaw", () => {
  it("wraps shortest path across ±π", () => {
    expect(deltaAngle(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2, 1);
  });

  it("smoothYaw moves toward target", () => {
    const next = smoothYaw(0, Math.PI / 2, 1 / 60, 12);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(Math.PI / 2);
  });

  it("caps the per-frame step to maxRadPerSec", () => {
    const dt = 1 / 60;
    // lambda 100 wants ~the whole π in one frame; cap must clamp it
    const next = smoothYaw(0, Math.PI, dt, 100, 2);
    expect(Math.abs(next)).toBeLessThanOrEqual(2 * dt + 1e-9);
    expect(next).toBeGreaterThan(0); // still turns the right way
  });

  it("cap defaults to Infinity (behavior unchanged)", () => {
    const dt = 1 / 60;
    expect(smoothYaw(0, 1, dt, 12)).toBeCloseTo(
      smoothYaw(0, 1, dt, 12, Infinity),
      12,
    );
  });
});

describe("movingHysteresis", () => {
  it("enters at ≥ enter threshold, exits at ≤ exit threshold, holds between", () => {
    expect(movingHysteresis(false, 0.59)).toBe(false);
    expect(movingHysteresis(false, 0.6)).toBe(true);
    // between thresholds: keeps previous state
    expect(movingHysteresis(true, 0.45)).toBe(true);
    expect(movingHysteresis(false, 0.45)).toBe(false);
    expect(movingHysteresis(true, 0.3)).toBe(false);
  });

  it("is safe on non-finite speed", () => {
    expect(movingHysteresis(true, NaN)).toBe(false);
    expect(movingHysteresis(false, Infinity)).toBe(true);
  });

  it("exposes spec thresholds", () => {
    expect(MOVE_ENTER_SPEED).toBe(0.6);
    expect(MOVE_EXIT_SPEED).toBe(0.3);
  });
});

describe("bodyYawTargetMoving", () => {
  it("faces aim when not moving", () => {
    expect(bodyYawTargetMoving(false, 3, 0, 1.2)).toBeCloseTo(1.2);
  });

  it("faces velocity when moving (+X → π/2)", () => {
    expect(bodyYawTargetMoving(true, 3, 0, 1.2)).toBeCloseTo(Math.PI / 2);
  });

  it("falls back to aim on zero vector even while moving", () => {
    expect(bodyYawTargetMoving(true, 0, 0, 1.2)).toBeCloseTo(1.2);
  });
});
