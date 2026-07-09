import * as THREE from "three";
import { CharacterRig } from "./CharacterRig";
import { CharacterAnimator, type AnimatorInput } from "./CharacterAnimator";
import {
  CharacterController,
  type CharacterControllerInput,
} from "./CharacterController";
import { WeaponAttach, type WeaponCategory } from "./WeaponAttach";

export { CharacterRig, WEAPON_SLOT_NAME } from "./CharacterRig";
export type { CharacterBones } from "./CharacterRig";
export { CharacterAnimator } from "./CharacterAnimator";
export type { AnimatorInput, LocomotionState } from "./CharacterAnimator";
export { CharacterController } from "./CharacterController";
export type {
  CharacterControllerInput,
  CharacterControllerState,
} from "./CharacterController";
export { WeaponAttach, buildWeaponMesh } from "./WeaponAttach";
export type { WeaponCategory } from "./WeaponAttach";

export type CharacterHandle = {
  group: THREE.Group;
  animator: CharacterAnimator;
  controller: CharacterController;
  setWeapon: (category: WeaponCategory) => void;
  /**
   * Full frame update: orientation (velocity vs aim) + procedural anim.
   * Prefer this over raw `animator.update`.
   */
  update: (
    dt: number,
    input: {
      moveX: number;
      moveZ: number;
      /** Aim yaw from sim (`player.rot`). */
      aimYaw: number;
      /** World Y from motor (jump). */
      rootY?: number;
      crouching?: boolean;
      airborne?: boolean;
      shooting?: boolean;
      weaponCategory?: WeaponCategory;
    },
  ) => void;
  /** Seed body yaw on spawn/respawn. */
  resetFacing: (aimYaw: number) => void;
  dispose: () => void;
};

/**
 * Factory: low-poly hierarchical character with
 * orientation controller + directional animator + weapon slot.
 */
export function createCharacter(teamColor: number): CharacterHandle {
  const rig = new CharacterRig(teamColor);
  rig.applyRestPose();

  const animator = new CharacterAnimator(rig.bones);
  const controller = new CharacterController();
  const weapons = new WeaponAttach(rig.bones);
  weapons.setWeapon("rifle");

  let lastCategory: WeaponCategory = "rifle";

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
    update(dt, input) {
      const weaponCategory = input.weaponCategory ?? lastCategory;
      if (input.weaponCategory && input.weaponCategory !== lastCategory) {
        weapons.setWeapon(input.weaponCategory);
        lastCategory = input.weaponCategory;
      }

      const ctrlIn: CharacterControllerInput = {
        moveX: input.moveX,
        moveZ: input.moveZ,
        aimYaw: input.aimYaw,
        dt,
      };
      const state = controller.update(ctrlIn);

      // Apply body yaw — THIS is what fixes “de costas”
      rig.group.rotation.y = state.visualYaw;

      const animIn: AnimatorInput = {
        speed: state.speed,
        weights: state.weights,
        torsoTwist: state.torsoTwist,
        crouching: input.crouching,
        airborne: input.airborne,
        shooting: input.shooting,
        weaponCategory,
      };
      animator.update(dt, animIn);

      // Root height from motor (jump). Orientation uses XZ only.
      if (input.rootY != null && Number.isFinite(input.rootY)) {
        rig.group.position.y = input.rootY;
      }
    },
    dispose() {
      weapons.dispose();
      rig.dispose();
    },
  };
}
