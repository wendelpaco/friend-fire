import { describe, expect, it } from "vitest";
import {
  CROUCH_SPEED_MULT,
  GROUND_Y,
  JUMP_SPEED,
  createMotorState,
  motorRadius,
  motorSpeed,
  tickMotor,
} from "./motor";
import type { WallRect } from "./types";

const emptyWalls: WallRect[] = [];

describe("motor jump / crouch / ground", () => {
  it("stays grounded when idle", () => {
    const s = createMotorState(0, 0);
    const next = tickMotor(s, {
      wishX: 0,
      wishZ: 0,
      jump: false,
      crouch: false,
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
      crouch: false,
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
      crouch: false,
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
      crouch: false,
      dt: 1 / 60,
      walls: emptyWalls,
    });
    // simulate many frames
    for (let i = 0; i < 120; i++) {
      s = tickMotor(s, {
        wishX: 0,
        wishZ: 0,
        jump: false,
        crouch: false,
        dt: 1 / 60,
        walls: emptyWalls,
      });
    }
    expect(s.onGround).toBe(true);
    expect(s.y).toBe(GROUND_Y);
    expect(s.vy).toBe(0);
    expect(s.y).toBeGreaterThanOrEqual(GROUND_Y);
  });

  it("crouch slows movement and shrinks radius", () => {
    expect(motorRadius(true)).toBeLessThan(motorRadius(false));
    expect(motorSpeed(true, true, 10)).toBeCloseTo(10 * CROUCH_SPEED_MULT);

    let s = createMotorState(0, 0);
    const stand = tickMotor(s, {
      wishX: 1,
      wishZ: 0,
      jump: false,
      crouch: false,
      dt: 1,
      standSpeed: 10,
      walls: emptyWalls,
    });
    s = createMotorState(0, 0);
    const crouch = tickMotor(s, {
      wishX: 1,
      wishZ: 0,
      jump: false,
      crouch: true,
      dt: 1,
      standSpeed: 10,
      walls: emptyWalls,
    });
    expect(Math.abs(crouch.x)).toBeLessThan(Math.abs(stand.x));
    expect(crouch.crouching).toBe(true);
  });

  it("motor crouch input is state (not edge): true stays crouched", () => {
    let s = createMotorState(0, 0);
    s = tickMotor(s, { wishX: 0, wishZ: 0, jump: false, crouch: true, dt: 1/60, walls: emptyWalls });
    expect(s.crouching).toBe(true);
    s = tickMotor(s, { wishX: 0, wishZ: 0, jump: false, crouch: true, dt: 1/60, walls: emptyWalls });
    expect(s.crouching).toBe(true);
    s = tickMotor(s, { wishX: 0, wishZ: 0, jump: false, crouch: false, dt: 1/60, walls: emptyWalls });
    expect(s.crouching).toBe(false);
  });

  it("does not pass through walls while moving", () => {
    const wall: WallRect = { x: 2, z: 0, w: 1, d: 4 };
    let s = createMotorState(0, 0);
    for (let i = 0; i < 30; i++) {
      s = tickMotor(s, {
        wishX: 1,
        wishZ: 0,
        jump: false,
        crouch: false,
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
      crouch: false,
      dt: 1 / 60,
      walls: emptyWalls,
    });
    for (let i = 0; i < 90; i++) {
      s = tickMotor(s, {
        wishX: 1,
        wishZ: 0,
        jump: false,
        crouch: false,
        dt: 1 / 60,
        walls: emptyWalls,
      });
    }
    expect(s.onGround).toBe(true);
    expect(s.y).toBe(GROUND_Y);
  });
});
