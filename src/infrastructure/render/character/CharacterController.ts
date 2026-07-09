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
 * - While moving: **body yaw → velocity direction** (chest follows feet).
 * - While idle: **body yaw → aim** (ready stance on crosshair).
 * - **Torso twist** (clamped) toward aim so the gun still tracks the mouse.
 * - Locomotion blend from angle between move and body facing
 *   (forward / back / strafe L / R).
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
  DEFAULT_RUN_THRESHOLD,
  MODEL_YAW_OFFSET_PROCEDURAL,
  bodyYawTarget,
  deltaAngle,
  locomotionWeights,
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
const TURN_LAMBDA = 14;
/** How fast torso twist eases. */
const TWIST_LAMBDA = 16;

export class CharacterController {
  /**
   * Extra yaw added when applying to the mesh.
   * 0 for +Z procedural; Math.PI for −Z GLTF.
   */
  modelYawOffset: number;

  private bodyYaw = 0;
  private torsoTwist = 0;
  private initialized = false;

  constructor(modelYawOffset: number = MODEL_YAW_OFFSET_PROCEDURAL) {
    this.modelYawOffset = modelYawOffset;
  }

  /** Seed facing (spawn / respawn). */
  reset(aimYaw: number): void {
    this.bodyYaw = aimYaw;
    this.torsoTwist = 0;
    this.initialized = true;
  }

  /**
   * Advance controller one frame.
   * Does **not** touch Three.js — caller applies `visualYaw` / `torsoTwist`.
   */
  update(input: CharacterControllerInput): CharacterControllerState {
    const { moveX, moveZ, aimYaw, dt } = input;
    const speed = Math.hypot(moveX, moveZ);

    if (!this.initialized) {
      this.bodyYaw = aimYaw;
      this.initialized = true;
    }

    // 1) Target body yaw: velocity when walking, aim when idle
    const target = bodyYawTarget(
      moveX,
      moveZ,
      aimYaw,
      DEFAULT_RUN_THRESHOLD,
    );
    this.bodyYaw = smoothYaw(this.bodyYaw, target, dt, TURN_LAMBDA);

    // 2) Torso twists toward aim (gun tracks mouse without moonwalking hips)
    const desiredTwist = clamp(
      deltaAngle(this.bodyYaw, aimYaw),
      -MAX_TORSO_TWIST,
      MAX_TORSO_TWIST,
    );
    const twistAlpha = 1 - Math.exp(-TWIST_LAMBDA * Math.max(0, dt));
    this.torsoTwist += (desiredTwist - this.torsoTwist) * twistAlpha;

    // 3) Locomotion weights in **body** space (after hips face move → mostly forward)
    const weights = locomotionWeights(
      moveX,
      moveZ,
      this.bodyYaw,
      DEFAULT_RUN_THRESHOLD,
    );

    return {
      bodyYaw: this.bodyYaw,
      visualYaw: this.bodyYaw + this.modelYawOffset,
      torsoTwist: this.torsoTwist,
      weights,
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
