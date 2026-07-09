/**
 * CharacterController — orientation + locomotion for top-down soldiers.
 *
 * ## The “walks forward but shows their back” bug
 *
 * Two independent angles exist in a mouse-aim shooter:
 *
 * 1. **Aim yaw** — from player → cursor (`atan2(aimX - x, aimZ - z)`).
 *    Used for bullets / muzzle.
 * 2. **Move vector** — WASD in world XZ.
 *
 * If you set `mesh.rotation.y = aimYaw` only, pressing W while the mouse is
 * behind the soldier makes him **moonwalk**: feet go W, chest faces mouse.
 *
 * ## Fix (this controller)
 *
 * - Move vector is EMA-smoothed, then gated through **hysteresis**
 *   (enter high, exit low) so noisy snapshot deltas near the threshold
 *   don't flicker the facing target frame to frame.
 * - While moving: **body yaw → velocity direction** (chest follows feet).
 * - While idle: **body yaw → aim** (ready stance on crosshair).
 * - Body yaw turns are **rate-capped** — a 180° reversal pivots visibly
 *   instead of snapping instantly.
 * - **Torso twist** (clamped) toward aim so the gun still tracks the mouse.
 * - Locomotion blend from angle between move and body facing
 *   (forward / back / strafe L / R), smoothed per channel to kill pops.
 *
 * ## Yaw math (Three.js Y-up, model faces **+Z**)
 *
 * ```ts
 * const aimYaw  = Math.atan2(aimX - x, aimZ - z);
 * const moveYaw = Math.atan2(velX, velZ);       // same basis
 * // local +Z after rotation.y = yaw points world (sin yaw, cos yaw)
 * group.rotation.y = bodyYaw + MODEL_YAW_OFFSET;
 * ```
 *
 * Procedural rig: `MODEL_YAW_OFFSET = 0`.
 * GLTF facing −Z (Mixamo etc.): `MODEL_YAW_OFFSET = Math.PI`.
 */

import {
  MODEL_YAW_OFFSET_PROCEDURAL,
  bodyYawTargetMoving,
  deltaAngle,
  locomotionWeights,
  movingHysteresis,
  smoothWeights,
  smoothYaw,
  type LocomotionWeights,
} from "@/domains/fx";

export type CharacterControllerInput = {
  /** World-space horizontal velocity (or position delta / dt). */
  moveX: number;
  moveZ: number;
  /** Aim yaw from sim: `atan2(aimX - x, aimZ - z)`. */
  aimYaw: number;
  /** Seconds since last update. */
  dt: number;
};

export type CharacterControllerState = {
  /** Smoothed body yaw (without model offset). */
  bodyYaw: number;
  /** Applied to `group.rotation.y`. */
  visualYaw: number;
  /** Clamped torso twist toward aim (radians). */
  torsoTwist: number;
  /** Blend weights for animator. */
  weights: LocomotionWeights;
  speed: number;
};

/** Max upper-body twist toward aim while hips follow velocity. */
const MAX_TORSO_TWIST = 1.15; // ~66°
/** How fast body yaw catches velocity / aim. */
const TURN_LAMBDA = 9;
/** Hard cap on body turn speed — 180° reversals pivot, never snap. */
const MAX_TURN_RATE = 12.5; // rad/s ≈ 720°/s
/** How fast torso twist eases. */
const TWIST_LAMBDA = 16;
/** EMA on the raw move vector — snapshot deltas are noisy frame to frame. */
const VEL_LAMBDA = 20;
/** Locomotion blend settle ≈120 ms. */
const WEIGHT_LAMBDA = 14;

const IDLE_WEIGHTS: LocomotionWeights = {
  idle: 1,
  forward: 0,
  backward: 0,
  strafeLeft: 0,
  strafeRight: 0,
};

export class CharacterController {
  /**
   * Extra yaw added when applying to the mesh.
   * 0 for +Z procedural; Math.PI for −Z GLTF.
   */
  modelYawOffset: number;

  private bodyYaw = 0;
  private torsoTwist = 0;
  private initialized = false;
  private smoothX = 0;
  private smoothZ = 0;
  private moving = false;
  private weights: LocomotionWeights = { ...IDLE_WEIGHTS };

  constructor(modelYawOffset: number = MODEL_YAW_OFFSET_PROCEDURAL) {
    this.modelYawOffset = modelYawOffset;
  }

  /** Seed facing (spawn / respawn). */
  reset(aimYaw: number): void {
    this.bodyYaw = aimYaw;
    this.torsoTwist = 0;
    this.smoothX = 0;
    this.smoothZ = 0;
    this.moving = false;
    this.weights = { ...IDLE_WEIGHTS };
    this.initialized = true;
  }

  /**
   * Advance controller one frame.
   * Does **not** touch Three.js — caller applies `visualYaw` / `torsoTwist`.
   */
  update(input: CharacterControllerInput): CharacterControllerState {
    const { moveX, moveZ, aimYaw, dt } = input;

    if (!this.initialized) {
      this.bodyYaw = aimYaw;
      this.initialized = true;
    }

    // 0) EMA the move vector — raw snapshot deltas jitter around thresholds
    const velAlpha = 1 - Math.exp(-VEL_LAMBDA * Math.max(0, dt));
    const mx = Number.isFinite(moveX) ? moveX : 0;
    const mz = Number.isFinite(moveZ) ? moveZ : 0;
    this.smoothX += (mx - this.smoothX) * velAlpha;
    this.smoothZ += (mz - this.smoothZ) * velAlpha;
    const speed = Math.hypot(this.smoothX, this.smoothZ);

    // 1) Move/idle with hysteresis, then body yaw: velocity when moving,
    //    aim when idle — rate-capped so reversals pivot instead of snapping
    this.moving = movingHysteresis(this.moving, speed);
    const target = bodyYawTargetMoving(
      this.moving,
      this.smoothX,
      this.smoothZ,
      aimYaw,
    );
    this.bodyYaw = smoothYaw(this.bodyYaw, target, dt, TURN_LAMBDA, MAX_TURN_RATE);

    // 2) Torso twists toward aim (gun tracks mouse without moonwalking hips)
    const desiredTwist = clamp(
      deltaAngle(this.bodyYaw, aimYaw),
      -MAX_TORSO_TWIST,
      MAX_TORSO_TWIST,
    );
    const twistAlpha = 1 - Math.exp(-TWIST_LAMBDA * Math.max(0, dt));
    this.torsoTwist += (desiredTwist - this.torsoTwist) * twistAlpha;

    // 3) Locomotion weights in body space, smoothed per channel (kills pops)
    const rawWeights = this.moving
      ? locomotionWeights(this.smoothX, this.smoothZ, this.bodyYaw, 1e-4)
      : IDLE_WEIGHTS;
    this.weights = smoothWeights(this.weights, rawWeights, dt, WEIGHT_LAMBDA);

    return {
      bodyYaw: this.bodyYaw,
      visualYaw: this.bodyYaw + this.modelYawOffset,
      torsoTwist: this.torsoTwist,
      weights: { ...this.weights },
      speed,
    };
  }

  get yaw(): number {
    return this.bodyYaw;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
