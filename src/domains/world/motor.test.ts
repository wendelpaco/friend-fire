import { describe, expect, it } from "vitest";
import {
  GROUND_Y,
  JUMP_SPEED,
  STAND_RADIUS,
  createMotorState,
  motorRadius,
  motorSpeed,
  tickMotor,
} from "./motor";
import type { WallRect } from "./types";

const emptyWalls: WallRect[] = [];

describe("motor jump / ground", () => {
  it("stays grounded when idle", () => {
    const s = createMotorState(0, 0);
    const next = tickMotor(s, {
      wishX: 0,
      wishZ: 0,
      jump: false,
      dt: 1 / 60,
      walls: emptyWalls,
    });
    expect(next.onGround).toBe(true);
    expect(next.y).toBe(GROUND_Y);
    expect(next.vy).toBe(0);
  });

  it("jumps only when on ground", () => {
    let s = createMotorState(0, 0);
    s = tickMotor(s, {
      wishX: 0,
      wishZ: 0,
      jump: true,
      dt: 1 / 60,
      walls: emptyWalls,
    });
    expect(s.onGround).toBe(false);
    expect(s.vy).toBeCloseTo(JUMP_SPEED + (-28) * (1 / 60), 1);
    expect(s.y).toBeGreaterThan(GROUND_Y);

    // mid-air jump ignored
    const air = tickMotor(s, {
      wishX: 0,
      wishZ: 0,
      jump: true,
      dt: 1 / 60,
      walls: emptyWalls,
    });
    expect(air.vy).toBeLessThan(s.vy); // only gravity applied
  });

  it("lands and sticks to ground", () => {
    let s = createMotorState(0, 0);
    s = tickMotor(s, {
      wishX: 0,
      wishZ: 0,
      jump: true,
      dt: 1 / 60,
      walls: emptyWalls,
    });
    // simulate many frames
    for (let i = 0; i < 120; i++) {
      s = tickMotor(s, {
        wishX: 0,
        wishZ: 0,
        jump: false,
        dt: 1 / 60,
        walls: emptyWalls,
      });
    }
    expect(s.onGround).toBe(true);
    expect(s.y).toBe(GROUND_Y);
    expect(s.vy).toBe(0);
    expect(s.y).toBeGreaterThanOrEqual(GROUND_Y);
  });

  it("uses standing radius and full stand speed on ground", () => {
    expect(motorRadius()).toBe(STAND_RADIUS);
    expect(motorSpeed(true, 10)).toBe(10);
    expect(motorSpeed(false, 10)).toBeCloseTo(10 * 0.9);

    let s = createMotorState(0, 0);
    const stand = tickMotor(s, {
      wishX: 1,
      wishZ: 0,
      jump: false,
      dt: 1,
      standSpeed: 10,
      walls: emptyWalls,
    });
    expect(stand.x).toBeCloseTo(10);
  });

  it("does not pass through walls while moving", () => {
    const wall: WallRect = { x: 2, z: 0, w: 1, d: 4 };
    let s = createMotorState(0, 0);
    for (let i = 0; i < 30; i++) {
      s = tickMotor(s, {
        wishX: 1,
        wishZ: 0,
        jump: false,
        dt: 1 / 30,
        standSpeed: 10,
        walls: [wall],
      });
    }
    // circle radius 0.45 → stopped before wall face at x=1.5
    expect(s.x).toBeLessThan(1.6);
  });

  it("horizontal move while airborne does not break ground later", () => {
    let s = createMotorState(0, 0);
    s = tickMotor(s, {
      wishX: 0,
      wishZ: 0,
      jump: true,
      dt: 1 / 60,
      walls: emptyWalls,
    });
    for (let i = 0; i < 90; i++) {
      s = tickMotor(s, {
        wishX: 1,
        wishZ: 0,
        jump: false,
        dt: 1 / 60,
        walls: emptyWalls,
      });
    }
    expect(s.onGround).toBe(true);
    expect(s.y).toBe(GROUND_Y);
  });

  it("can land on standable crate top after jump", () => {
    const crate: WallRect = {
      x: 0,
      z: 0,
      w: 2,
      d: 2,
      h: 1.2,
      standable: true,
    };
    // Start above crate (simulating apex), fall onto top
    let s = createMotorState(0, 0);
    s = { ...s, y: 1.8, vy: -2, onGround: false };
    for (let i = 0; i < 40; i++) {
      s = tickMotor(s, {
        wishX: 0,
        wishZ: 0,
        jump: false,
        dt: 1 / 60,
        walls: [crate],
      });
    }
    expect(s.onGround).toBe(true);
    expect(s.y).toBeCloseTo(1.2, 1);
  });
});
