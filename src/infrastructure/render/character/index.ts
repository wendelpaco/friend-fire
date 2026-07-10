import * as THREE from "three";
import {
  MODEL_YAW_OFFSET_GLTF_NEG_Z,
  MODEL_YAW_OFFSET_PROCEDURAL,
} from "@/domains/fx";
import { CharacterRig } from "./CharacterRig";
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
import {
  instantiateSoldier,
  loadSoldierGltf,
  preloadSoldierGltf,
} from "./SoldierGltf";

export { CharacterRig, WEAPON_SLOT_NAME } from "./CharacterRig";
export type { CharacterBones } from "./CharacterRig";
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
      /** Aim yaw from sim (`player.rot`). */
      aimYaw: number;
      /** World Y from motor (jump). */
      rootY?: number;
      crouching?: boolean;
      airborne?: boolean;
      reloading?: boolean;
      shooting?: boolean;
      weaponCategory?: WeaponCategory;
      /** Default full (local player). */
      lod?: CharacterLod;
    },
  ) => FootPlant;
  /** Seed body yaw on spawn/respawn. */
  resetFacing: (aimYaw: number) => void;
  /** True after GLTF hot-swap succeeded. */
  isGltf: () => boolean;
  dispose: () => void;
};

/**
 * Factory: starts as procedural rig, hot-swaps to GLTF when
 * `/models/soldier.glb` is available. Orientation always from
 * {@link CharacterController}.
 */
export function createCharacter(teamColor: number): CharacterHandle {
  const root = new THREE.Group();
  root.name = "character_root";

  const rig = new CharacterRig(teamColor);
  rig.applyRestPose();
  root.add(rig.group);

  const animator = new CharacterAnimator(rig.bones);
  const controller = new CharacterController(MODEL_YAW_OFFSET_PROCEDURAL);
  let weaponBind = new WeaponAttach(rig.bones);
  weaponBind.setWeapon("rifle");

  let lastCategory: WeaponCategory = "rifle";
  let midAnimAccum = 0;
  let midFrame = 0;
  let disposed = false;
  let usingGltf = false;

  let mixer: THREE.AnimationMixer | null = null;
  let walkAction: THREE.AnimationAction | null = null;
  let gltfTorso: THREE.Object3D | null = null;
  let gltfBaseTorsoY = 0;

  // Kick shared load; hot-swap when ready
  void loadSoldierGltf().then((asset) => {
    if (!asset || disposed) return;
    try {
      const inst = instantiateSoldier(asset, teamColor);
      // Swap visual
      root.remove(rig.group);
      root.add(inst.root);
      usingGltf = true;
      // CesiumMan / most glTF humanoids face −Z → offset yaw
      controller.modelYawOffset = MODEL_YAW_OFFSET_GLTF_NEG_Z;

      // Weapon on right hand bone if found
      if (inst.rightHand) {
        weaponBind.dispose();
        const slot = new THREE.Object3D();
        slot.name = "weaponSlot";
        slot.position.set(0.05, -0.05, 0.12);
        inst.rightHand.add(slot);
        weaponBind = new WeaponAttach({
          ...rig.bones,
          weaponSlot: slot,
        });
        weaponBind.setWeapon(lastCategory);
      }

      if (inst.clips.length > 0) {
        mixer = new THREE.AnimationMixer(inst.root);
        walkAction = mixer.clipAction(inst.clips[0]!);
        walkAction.play();
        walkAction.setEffectiveWeight(0);
        walkAction.setEffectiveTimeScale(1);
      }

      gltfTorso = inst.torso;
      if (gltfTorso) gltfBaseTorsoY = gltfTorso.rotation.y;
    } catch (e) {
      console.warn("[soldier] hot-swap failed, staying procedural", e);
      usingGltf = false;
      if (!root.children.includes(rig.group)) {
        root.add(rig.group);
      }
      controller.modelYawOffset = MODEL_YAW_OFFSET_PROCEDURAL;
    }
  });

  return {
    group: root,
    animator,
    controller,
    setWeapon(category: WeaponCategory) {
      weaponBind.setWeapon(category);
      lastCategory = category;
    },
    resetFacing(aimYaw: number) {
      controller.reset(aimYaw);
    },
    isGltf: () => usingGltf,
    update(dt, input) {
      const weaponCategory = input.weaponCategory ?? lastCategory;
      if (input.weaponCategory && input.weaponCategory !== lastCategory) {
        weaponBind.setWeapon(input.weaponCategory);
        lastCategory = input.weaponCategory;
      }

      const lod: CharacterLod = input.lod ?? "full";

      const ctrlIn: CharacterControllerInput = {
        moveX: input.moveX,
        moveZ: input.moveZ,
        aimYaw: input.aimYaw,
        dt,
      };
      const state = controller.update(ctrlIn);

      // Apply body yaw — THIS is what fixes “de costas”
      root.rotation.y = state.visualYaw;

      // Root height from motor (jump). Orientation uses XZ only.
      if (input.rootY != null && Number.isFinite(input.rootY)) {
        root.position.y = input.rootY;
      }

      // ── GLTF path ──────────────────────────────────────────
      if (usingGltf && mixer) {
        const moving = Math.max(0, 1 - state.weights.idle);
        if (walkAction) {
          if (lod === "far") {
            walkAction.setEffectiveWeight(0);
          } else {
            walkAction.setEffectiveWeight(THREE.MathUtils.clamp(moving, 0, 1));
            walkAction.setEffectiveTimeScale(
              0.75 + Math.min(Math.max(state.speed, 0), 8) * 0.12,
            );
          }
        }
        // Light torso twist toward aim (spine bone if present)
        if (gltfTorso && lod !== "far") {
          gltfTorso.rotation.y = gltfBaseTorsoY + state.torsoTwist * 0.35;
        }
        if (lod === "mid") {
          midFrame += 1;
          midAnimAccum += dt;
          if (midFrame % 2 === 0) {
            mixer.update(midAnimAccum);
            midAnimAccum = 0;
          }
        } else if (lod === "full") {
          midFrame = 0;
          midAnimAccum = 0;
          mixer.update(dt);
        } else {
          midFrame = 0;
          midAnimAccum = 0;
        }
        return null;
      }

      // ── Procedural path ────────────────────────────────────
      if (lod === "far") {
        midAnimAccum = 0;
        midFrame = 0;
        return null;
      }

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
      disposed = true;
      weaponBind.dispose();
      if (mixer) {
        mixer.stopAllAction();
        mixer = null;
      }
      walkAction = null;
      if (!usingGltf) {
        rig.dispose();
      } else {
        // Dispose gltf clone (materials cloned per instance)
        root.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
            obj.geometry?.dispose();
            const mat = obj.material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat?.dispose();
          }
        });
      }
      root.clear();
    },
  };
}

// Eager preload when module loads in browser (optional; also called from renderer)
if (typeof window !== "undefined") {
  preloadSoldierGltf();
}
