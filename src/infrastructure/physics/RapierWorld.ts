/**
 * Rapier-backed map physics for the top-down character controller.
 *
 * - Static cuboids for walls / props
 * - Floor plane at y = 0
 * - Kinematic capsule + CharacterController per player
 * - Grounded flag from controller + optional down-ray
 *
 * Y-up, same as Three.js. Horizontal plane is XZ.
 */

import RAPIER from "@dimforge/rapier3d-compat";
import type { GameMap, WallRect } from "@/domains/world";
import {
  AIR_CONTROL,
  CROUCH_RADIUS,
  CROUCH_SPEED_MULT,
  DEFAULT_STAND_SPEED,
  GRAVITY,
  JUMP_SPEED,
  STAND_RADIUS,
} from "@/domains/world/motor";
import { mapCollisionWalls } from "@/domains/world";

export type PhysicsPose = {
  x: number;
  y: number;
  z: number;
  vy: number;
  crouching: boolean;
  onGround: boolean;
};

export type PhysicsStepInput = {
  wishX: number;
  wishZ: number;
  /** Edge jump this frame. */
  jump: boolean;
  crouching: boolean;
  dt: number;
  standSpeed?: number;
};

type BodyHandle = {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  crouching: boolean;
  vy: number;
  standHalfH: number;
  crouchHalfH: number;
};

const STAND_HALF_H = 0.9;
const CROUCH_HALF_H = 0.55;
const CAPSULE_RADIUS_STAND = STAND_RADIUS;
const CAPSULE_RADIUS_CROUCH = CROUCH_RADIUS;

let rapierInit: Promise<void> | null = null;

function ensureRapier(): Promise<void> {
  if (!rapierInit) {
    rapierInit = RAPIER.init();
  }
  return rapierInit;
}

/**
 * Build static colliders + per-player kinematic controllers.
 */
export class RapierWorld {
  readonly world: RAPIER.World;
  private readonly bodies = new Map<string, BodyHandle>();
  private disposed = false;

  private constructor(world: RAPIER.World) {
    this.world = world;
  }

  static async create(map: GameMap): Promise<RapierWorld> {
    await ensureRapier();
    // Gravity applied manually for jump feel; world gravity 0 on XZ characters.
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const phys = new RapierWorld(world);
    phys.buildMap(map);
    return phys;
  }

  private buildMap(map: GameMap): void {
    // Floor scales with map (72 → half 36 → cuboid extent ~48)
    const half = Math.max(map.size.width, map.size.depth) / 2;
    const floorExtent = half + 12;
    const floorBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.25, 0),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(floorExtent, 0.25, floorExtent).setFriction(
        0.9,
      ),
      floorBody,
    );

    const walls = mapCollisionWalls(map);
    for (const w of walls) {
      this.addWall(w);
    }
  }

  private addWall(w: WallRect): void {
    const h = Math.max(0.5, w.h ?? 2.5);
    // Standable props: solid top so CharacterController can land (CS high-ground).
    // Non-standable full walls: same cuboid. Low cover is shorter cuboid.
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(w.x, h / 2, w.z),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(w.w / 2, h / 2, w.d / 2).setFriction(
        w.standable ? 0.95 : 0.6,
      ),
      body,
    );
  }

  /**
   * Spawn or reposition a player capsule at world XZ (feet near y=0).
   */
  ensureCharacter(id: string, x: number, z: number, y = 0): void {
    if (this.disposed) return;
    let h = this.bodies.get(id);
    if (h) {
      const half = h.crouching ? h.crouchHalfH : h.standHalfH;
      h.body.setNextKinematicTranslation({
        x,
        y: y + half,
        z,
      });
      return;
    }

    const half = STAND_HALF_H;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        x,
        y + half,
        z,
      ),
    );
    // capsule(halfHeight of cylinder, radius) — total height ≈ 2*(half+rad)
    const cylHalf = Math.max(0.2, half - CAPSULE_RADIUS_STAND);
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(cylHalf, CAPSULE_RADIUS_STAND).setFriction(0.8),
      body,
    );
    const controller = this.world.createCharacterController(0.08);
    controller.setApplyImpulsesToDynamicBodies(false);
    // Step onto low ledges; crates (~1.2) still need jump — CS box play.
    controller.enableAutostep(0.5, 0.28, true);
    controller.enableSnapToGround(0.45);
    controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((40 * Math.PI) / 180);

    this.bodies.set(id, {
      body,
      collider,
      controller,
      crouching: false,
      vy: 0,
      standHalfH: STAND_HALF_H,
      crouchHalfH: CROUCH_HALF_H,
    });
  }

  removeCharacter(id: string): void {
    const h = this.bodies.get(id);
    if (!h) return;
    this.world.removeCollider(h.collider, true);
    this.world.removeRigidBody(h.body);
    this.world.removeCharacterController(h.controller);
    this.bodies.delete(id);
  }

  private setCrouchShape(h: BodyHandle, crouching: boolean): void {
    if (h.crouching === crouching) return;
    const t = h.body.translation();
    const oldHalf = h.crouching ? h.crouchHalfH : h.standHalfH;
    const feetY = t.y - oldHalf;
    h.crouching = crouching;
    const half = crouching ? h.crouchHalfH : h.standHalfH;
    const rad = crouching ? CAPSULE_RADIUS_CROUCH : CAPSULE_RADIUS_STAND;
    this.world.removeCollider(h.collider, true);
    h.collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(Math.max(0.15, half - rad), rad).setFriction(
        0.8,
      ),
      h.body,
    );
    h.body.setNextKinematicTranslation({
      x: t.x,
      y: feetY + half,
      z: t.z,
    });
  }

  /**
   * Step one character: wish dir, jump edge, crouch state.
   * Returns world feet pose (y = bottom of capsule ≈ ground contact).
   */
  stepCharacter(id: string, input: PhysicsStepInput): PhysicsPose | null {
    if (this.disposed) return null;
    const h = this.bodies.get(id);
    if (!h) return null;

    const dt = input.dt > 0 ? input.dt : 0;
    if (dt <= 0) {
      return this.readPose(id);
    }

    this.setCrouchShape(h, input.crouching);

    const half = h.crouching ? h.crouchHalfH : h.standHalfH;
    const standSpeed = input.standSpeed ?? DEFAULT_STAND_SPEED;
    let speed = standSpeed;
    if (h.crouching) speed *= CROUCH_SPEED_MULT;

    // Grounded from previous frame controller result + low feet
    let onGround = h.controller.computedGrounded();
    const t0 = h.body.translation();
    const feetBefore = t0.y - half;
    if (feetBefore <= 0.08 && h.vy <= 0.05) onGround = true;

    // Down-ray ground check (reliable on flat maps + prop tops)
    const rayOrigin = { x: t0.x, y: t0.y, z: t0.z };
    const rayDir = { x: 0, y: -1, z: 0 };
    const ray = new RAPIER.Ray(rayOrigin, rayDir);
    const hit = this.world.castRay(
      ray,
      half + 0.2,
      true,
      undefined,
      undefined,
      h.collider,
    );
    if (hit && hit.timeOfImpact <= half + 0.12 && h.vy <= 0.1) {
      onGround = true;
    }

    if (input.jump && onGround) {
      h.vy = JUMP_SPEED;
      onGround = false;
    }

    // Gravity
    if (!onGround || h.vy > 0) {
      h.vy += GRAVITY * dt;
    } else {
      h.vy = 0;
    }

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
    if (!onGround) speed *= AIR_CONTROL;

    const desired = {
      x: wx * speed * dt,
      y: h.vy * dt,
      z: wz * speed * dt,
    };

    h.controller.computeColliderMovement(h.collider, desired);
    const mov = h.controller.computedMovement();
    const grounded = h.controller.computedGrounded();

    const next = {
      x: t0.x + mov.x,
      y: t0.y + mov.y,
      z: t0.z + mov.z,
    };

    // Soft world-floor clamp only (elevated platforms use controller grounded).
    const minCenterY = half + 0.001;
    if (next.y < minCenterY) {
      next.y = minCenterY;
      h.vy = 0;
    }
    if (grounded && h.vy < 0) h.vy = 0;

    h.body.setNextKinematicTranslation(next);
    this.world.step();

    const feetY = Math.max(0, next.y - half);
    const onG =
      grounded ||
      (feetY <= 0.08 && h.vy <= 0.05) ||
      (grounded && feetY > 0.08);
    return {
      x: next.x,
      y: feetY,
      z: next.z,
      vy: h.vy,
      crouching: h.crouching,
      onGround: onG,
    };
  }

  readPose(id: string): PhysicsPose | null {
    const h = this.bodies.get(id);
    if (!h) return null;
    const t = h.body.translation();
    const half = h.crouching ? h.crouchHalfH : h.standHalfH;
    const feetY = Math.max(0, t.y - half);
    return {
      x: t.x,
      y: feetY,
      z: t.z,
      vy: h.vy,
      crouching: h.crouching,
      onGround: h.controller.computedGrounded() || feetY <= 0.08,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const id of [...this.bodies.keys()]) {
      this.removeCharacter(id);
    }
    this.world.free();
  }
}
