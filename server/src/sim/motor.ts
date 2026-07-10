/**
 * Player motor — CS-like jump / platforms (server authority).
 * Keep in sync with src/domains/world/motor.ts
 * Crouch removed (F4 / Sprint 1 gunfeel pack).
 */

import type { WallRect } from "./world";
import {
  resolveCircleWalls,
  sampleGroundY,
  SURFACE_EPS,
} from "./world";

export const GRAVITY = -28;
export const JUMP_SPEED = 9.5;
export const GROUND_Y = 0;
export const GROUND_EPS = 0.05;
export const AIR_CONTROL = 0.9;
export const STAND_RADIUS = 0.45;
export const DEFAULT_STAND_SPEED = 6.5;

export type MotorState = {
  x: number;
  z: number;
  y: number;
  vy: number;
  onGround: boolean;
};

export type MotorInput = {
  wishX: number;
  wishZ: number;
  jump: boolean;
  dt: number;
  standSpeed?: number;
  walls: WallRect[];
};

export function motorRadius(): number {
  return STAND_RADIUS;
}

export function motorSpeed(
  onGround: boolean,
  standSpeed: number = DEFAULT_STAND_SPEED,
): number {
  let s = standSpeed;
  if (!onGround) s *= AIR_CONTROL;
  return s;
}

export function createMotorState(x = 0, z = 0): MotorState {
  return {
    x,
    z,
    y: GROUND_Y,
    vy: 0,
    onGround: true,
  };
}

export function tickMotor(state: MotorState, input: MotorInput): MotorState {
  const dt = input.dt > 0 && Number.isFinite(input.dt) ? input.dt : 0;
  if (dt <= 0) return state;

  const standSpeed = input.standSpeed ?? DEFAULT_STAND_SPEED;
  const radius = motorRadius();
  const speed = motorSpeed(state.onGround, standSpeed);

  let wx = input.wishX;
  let wz = input.wishZ;
  const wLen = Math.hypot(wx, wz);
  if (wLen > 1e-6) {
    wx /= wLen;
    wz /= wLen;
  } else {
    wx = 0;
    wz = 0;
  }

  let x = state.x + wx * speed * dt;
  let z = state.z + wz * speed * dt;
  const resolved = resolveCircleWalls(x, z, radius, input.walls, state.y);
  x = resolved.x;
  z = resolved.z;

  let vy = state.vy;
  let y = state.y;
  let onGround = state.onGround;

  if (input.jump && onGround) {
    vy = JUMP_SPEED;
    onGround = false;
  }

  if (!onGround || vy > 0) {
    vy += GRAVITY * dt;
    y += vy * dt;
  }

  const groundY = sampleGroundY(x, z, radius, input.walls);

  if (y <= groundY + GROUND_EPS && vy <= 0) {
    y = groundY;
    vy = 0;
    onGround = true;
  } else if (y > groundY + GROUND_EPS) {
    onGround = false;
  }

  if (y < GROUND_Y) {
    y = GROUND_Y;
    vy = 0;
    onGround = true;
  }

  if (onGround && y > GROUND_Y + SURFACE_EPS) {
    const r2 = resolveCircleWalls(x, z, radius, input.walls, y);
    x = r2.x;
    z = r2.z;
    const g2 = sampleGroundY(x, z, radius, input.walls);
    if (g2 + GROUND_EPS < y && vy <= 0) {
      onGround = false;
    } else if (g2 > GROUND_Y) {
      y = g2;
    }
  }

  return { x, z, y, vy, onGround };
}
