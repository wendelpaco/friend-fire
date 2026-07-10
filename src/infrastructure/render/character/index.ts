import * as THREE from "three";
import { MODEL_YAW_OFFSET_PROCEDURAL } from "@/domains/fx";
import { CharacterRig, type CharacterSkinTint } from "./CharacterRig";
import {
  CharacterAnimator,
  type AnimatorInput,
  type FootPlant,
} from "./CharacterAnimator";
import {
  CharacterController,
  type CharacterControllerInput,
} from "./CharacterController";
import { WeaponAttach, type WeaponCategory } from "./WeaponAttach";

export { CharacterRig, WEAPON_SLOT_NAME } from "./CharacterRig";
export type { CharacterBones, CharacterSkinTint } from "./CharacterRig";
export { CharacterAnimator } from "./CharacterAnimator";
export type {
  AnimatorInput,
  FootPlant,
  LocomotionState,
} from "./CharacterAnimator";
export { CharacterController } from "./CharacterController";
export type {
  CharacterControllerInput,
  CharacterControllerState,
} from "./CharacterController";
export { WeaponAttach, buildWeaponMesh } from "./WeaponAttach";
export type { WeaponCategory } from "./WeaponAttach";
// GLTF loader kept for future military assets only — not auto-applied.
export {
  loadSoldierGltf,
  preloadSoldierGltf,
  isSoldierGltfReady,
  SOLDIER_GLTF_URL,
} from "./SoldierGltf";

/**
 * Animation budget vs distance from camera/local player.
 * - full: orientation + procedural bones every frame
 * - mid: orientation every frame; bones every other frame
 * - far: orientation only (frozen last pose) — for distant/culled bots
 */
export type CharacterLod = "full" | "mid" | "far";

export type CharacterHandle = {
  group: THREE.Group;
  animator: CharacterAnimator;
  controller: CharacterController;
  setWeapon: (category: WeaponCategory) => void;
  /**
   * Full frame update: orientation (velocity vs aim) + procedural anim.
   * Returns foot plant for SFX sync (null if none this frame / LOD skip).
   */
  update: (
    dt: number,
    input: {
      moveX: number;
      moveZ: number;
      aimYaw: number;
      rootY?: number;
      crouching?: boolean;
      airborne?: boolean;
      reloading?: boolean;
      shooting?: boolean;
      weaponCategory?: WeaponCategory;
      lod?: CharacterLod;
    },
  ) => FootPlant;
  resetFacing: (aimYaw: number) => void;
  /** Always false — GLTF auto-swap disabled (RUSH-B tactical procedural only). */
  isGltf: () => boolean;
  dispose: () => void;
};

/**
 * Low-poly **tactical** soldier (RUSH-B direction): box-rig with gear silhouette.
 * Orientation from {@link CharacterController}. No CesiumMan / sample GLTF.
 * Optional `skin` tints vest (primary) and fatigues (secondary) from operator catalog.
 */
export function createCharacter(
  teamColor: number,
  skin?: CharacterSkinTint,
): CharacterHandle {
  const rig = new CharacterRig(teamColor, skin);
  rig.applyRestPose();

  const animator = new CharacterAnimator(rig.bones);
  const controller = new CharacterController(MODEL_YAW_OFFSET_PROCEDURAL);
  const weapons = new WeaponAttach(rig.bones);
  weapons.setWeapon("rifle");

  let lastCategory: WeaponCategory = "rifle";
  let midAnimAccum = 0;
  let midFrame = 0;

  return {
    group: rig.group,
    animator,
    controller,
    setWeapon(category: WeaponCategory) {
      weapons.setWeapon(category);
      lastCategory = category;
    },
    resetFacing(aimYaw: number) {
      controller.reset(aimYaw);
    },
    isGltf: () => false,
    update(dt, input) {
      const weaponCategory = input.weaponCategory ?? lastCategory;
      if (input.weaponCategory && input.weaponCategory !== lastCategory) {
        weapons.setWeapon(input.weaponCategory);
        lastCategory = input.weaponCategory;
      }

      const lod: CharacterLod = input.lod ?? "full";

      if (input.rootY != null && Number.isFinite(input.rootY)) {
        rig.group.position.y = input.rootY;
      }

      // Far: frozen last pose — skip orientation + bones (W2 CPU).
      if (lod === "far") {
        midAnimAccum = 0;
        midFrame = 0;
        return null;
      }

      const ctrlIn: CharacterControllerInput = {
        moveX: input.moveX,
        moveZ: input.moveZ,
        aimYaw: input.aimYaw,
        dt,
      };
      const state = controller.update(ctrlIn);

      // Body faces velocity when moving — anti-moonwalk
      rig.group.rotation.y = state.visualYaw;

      const animIn: AnimatorInput = {
        speed: state.speed,
        weights: state.weights,
        torsoTwist: state.torsoTwist,
        crouching: input.crouching,
        airborne: input.airborne,
        reloading: input.reloading,
        shooting: input.shooting,
        weaponCategory,
      };

      if (lod === "mid") {
        midAnimAccum += dt;
        midFrame += 1;
        if (midFrame % 2 !== 0) return null;
        const step = midAnimAccum;
        midAnimAccum = 0;
        animator.update(step, animIn);
        return animator.takeFootPlant();
      }

      midAnimAccum = 0;
      midFrame = 0;
      animator.update(dt, animIn);
      return animator.takeFootPlant();
    },
    dispose() {
      weapons.dispose();
      rig.dispose();
    },
  };
}
