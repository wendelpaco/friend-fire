import { describe, expect, it } from "vitest";
import {
  DEFAULT_RUN_THRESHOLD,
  horizontalSpeed,
  locomotionFromDelta,
  locomotionFromSpeed,
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
    // speed = 0.2 / 1 = 0.2 < 0.3
    expect(locomotionFromDelta(0.2, 0, 1)).toBe("idle");
    // speed = 0.4 / 1 = 0.4 >= 0.3
    expect(locomotionFromDelta(0.4, 0, 1)).toBe("run");
  });
});
