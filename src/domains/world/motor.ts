/**
 * Player motor — CS-like jump / platforms on top-down XZ maps.
 *
 * Pure functions (no Three.js). Horizontal collision via
 * {@link resolveCircleWalls}; vertical ground via {@link sampleGroundY}
 * so crates/containers are standable high-ground.
 *
 * Orientation note: yaw must use **only** horizontal velocity (moveX, moveZ).
 * Never mix `y` into facing math or the moonwalk bug returns.
 *
 * Crouch removed (F4 / Sprint 1 gunfeel pack) — single standing radius.
 */

import type { Vec2, WallRect } from "./types";
import {
  resolveCircleWalls,
  sampleGroundY,
  SURFACE_EPS,
} from "./collision";

/** m/s² — snappy, not floaty (CS-ish on ~2m characters). */
export const GRAVITY = -28;
/** Initial upward speed when jumping from ground. */
export const JUMP_SPEED = 9.5;
/** World floor plane. */
export const GROUND_Y = 0;
/** Snap / grounded tolerance. */
export const GROUND_EPS = 0.05;
/** Slight air steer (still controllable mid-jump). */
export const AIR_CONTROL = 0.9;
export const STAND_RADIUS = 0.45;
/** Stand run speed (matches game PLAYER_SPEED). */
export const DEFAULT_STAND_SPEED = 6.5;

export type MotorState = {
  x: number;
  z: number;
  /** Vertical position (0 = floor). */
  y: number;
  /** Vertical velocity. */
  vy: number;
  onGround: boolean;
};

export type MotorInput = {
  /** Desired horizontal direction (unit or zero). */
  wishX: number;
  wishZ: number;
  /** Edge: jump this frame. */
  jump: boolean;
  dt: number;
  /** Stand speed m/s. */
  standSpeed?: number;
  walls: WallRect[];
};

/** Collision radius (standing only). */
export function motorRadius(): number {
  return STAND_RADIUS;
}

/**
 * Horizontal speed cap for ground / air.
 */
export function motorSpeed(
  onGround: boolean,
  standSpeed: number = DEFAULT_STAND_SPEED,
): number {
  let s = standSpeed;
  if (!onGround) s *= AIR_CONTROL;
  return s;
}

/**
 * Create grounded motor state at a world XZ.
 */
export function createMotorState(x = 0, z = 0): MotorState {
  return {
    x,
    z,
    y: GROUND_Y,
    vy: 0,
    onGround: true,
  };
}

/**
 * One simulation step: wish move + walls (feet-aware) → jump →
 * gravity → snap to floor or standable prop tops.
 */
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

  // Horizontal integrate + lateral collision (skip solids we're on top of)
  let x = state.x + wx * speed * dt;
  let z = state.z + wz * speed * dt;
  const feetForCol = state.y;
  const resolved: Vec2 = resolveCircleWalls(
    x,
    z,
    radius,
    input.walls,
    feetForCol,
  );
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

  // Highest surface under us after horizontal move (floor or crate top)
  const groundY = sampleGroundY(x, z, radius, input.walls);

  if (y <= groundY + GROUND_EPS && vy <= 0) {
    y = groundY;
    vy = 0;
    onGround = true;
  } else if (y > groundY + GROUND_EPS) {
    onGround = false;
  }

  // Never below world floor
  if (y < GROUND_Y) {
    y = GROUND_Y;
    vy = 0;
    onGround = true;
  }

  // If standing on a surface, re-resolve once so crate edges don't nibble
  if (onGround && y > GROUND_Y + SURFACE_EPS) {
    const r2 = resolveCircleWalls(x, z, radius, input.walls, y);
    x = r2.x;
    z = r2.z;
    const g2 = sampleGroundY(x, z, radius, input.walls);
    if (g2 + GROUND_EPS < y && vy <= 0) {
      // walked off edge — start falling next frames
      onGround = false;
    } else if (g2 > GROUND_Y) {
      y = g2;
    }
  }

  return { x, z, y, vy, onGround };
}
