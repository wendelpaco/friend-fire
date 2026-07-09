import * as THREE from "three";
import { CharacterRig } from "./CharacterRig";
import { CharacterAnimator, type AnimatorInput } from "./CharacterAnimator";
import { WeaponAttach, type WeaponCategory } from "./WeaponAttach";

export { CharacterRig, WEAPON_SLOT_NAME } from "./CharacterRig";
export type { CharacterBones } from "./CharacterRig";
export { CharacterAnimator } from "./CharacterAnimator";
export type { AnimatorInput, LocomotionState } from "./CharacterAnimator";
export { WeaponAttach, buildWeaponMesh } from "./WeaponAttach";
export type { WeaponCategory } from "./WeaponAttach";

export type CharacterHandle = {
  group: THREE.Group;
  animator: CharacterAnimator;
  setWeapon: (category: WeaponCategory) => void;
  update: (dt: number, input: AnimatorInput) => void;
  dispose: () => void;
};

/**
 * Factory: low-poly hierarchical character with animator + weapon slot.
 * Default weapon: rifle (matches prior box gun silhouette).
 */
export function createCharacter(teamColor: number): CharacterHandle {
  const rig = new CharacterRig(teamColor);
  rig.applyRestPose();

  const animator = new CharacterAnimator(rig.bones);
  const weapons = new WeaponAttach(rig.bones);
  weapons.setWeapon("rifle");

  let lastCategory: WeaponCategory = "rifle";

  return {
    group: rig.group,
    animator,
    setWeapon(category: WeaponCategory) {
      weapons.setWeapon(category);
      lastCategory = category;
    },
    update(dt: number, input: AnimatorInput) {
      const weaponCategory = input.weaponCategory ?? lastCategory;
      if (input.weaponCategory && input.weaponCategory !== lastCategory) {
        weapons.setWeapon(input.weaponCategory);
        lastCategory = input.weaponCategory;
      }
      animator.update(dt, { ...input, weaponCategory });
    },
    dispose() {
      weapons.dispose();
      rig.dispose();
    },
  };
}
