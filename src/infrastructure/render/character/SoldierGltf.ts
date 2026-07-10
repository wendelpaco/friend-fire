/**
 * Shared GLTF soldier asset (CC0 / Khronos sample pipeline).
 * Place a rigged humanoid at `/models/soldier.glb` (public/).
 * On failure → callers keep procedural rig.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export const SOLDIER_GLTF_URL = "/models/soldier.glb";

/** Target standing height in world units (matches procedural ~1.6–1.7). */
export const SOLDIER_TARGET_HEIGHT = 1.68;

export type SoldierGltfAsset = {
  template: THREE.Object3D;
  clips: THREE.AnimationClip[];
};

let shared: SoldierGltfAsset | null = null;
let loadPromise: Promise<SoldierGltfAsset | null> | null = null;
let loadFailed = false;

/** True after a successful load. */
export function isSoldierGltfReady(): boolean {
  return shared != null;
}

/** True if load finished with failure (do not retry every spawn). */
export function isSoldierGltfFailed(): boolean {
  return loadFailed;
}

/**
 * Load once. Safe to call many times. Resolves null on failure / SSR.
 */
export function loadSoldierGltf(
  url: string = SOLDIER_GLTF_URL,
): Promise<SoldierGltfAsset | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (shared) return Promise.resolve(shared);
  if (loadFailed) return Promise.resolve(null);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        try {
          // Normalize once on the template
          gltf.scene.updateMatrixWorld(true);
          shared = {
            template: gltf.scene,
            clips: gltf.animations ?? [],
          };
          loadFailed = false;
          resolve(shared);
        } catch (e) {
          console.warn("[soldier] GLTF normalize failed", e);
          loadFailed = true;
          shared = null;
          resolve(null);
        }
      },
      undefined,
      (err) => {
        console.warn(
          "[soldier] GLTF load failed — using procedural rig",
          err,
        );
        loadFailed = true;
        shared = null;
        resolve(null);
      },
    );
  });

  return loadPromise;
}

/** Kick off load early (GameClient / renderer boot). */
export function preloadSoldierGltf(): void {
  void loadSoldierGltf();
}

/**
 * Clone a skinned instance, scale feet-on-ground, return root + optional clips.
 */
export function instantiateSoldier(
  asset: SoldierGltfAsset,
  teamColor: number,
): {
  root: THREE.Object3D;
  clips: THREE.AnimationClip[];
  rightHand: THREE.Object3D | null;
  torso: THREE.Object3D | null;
} {
  const root = cloneSkinned(asset.template) as THREE.Object3D;
  root.name = "soldier_gltf";

  // Fit height
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = size.y > 1e-4 ? size.y : 1.5;
  const s = SOLDIER_TARGET_HEIGHT / h;
  root.scale.setScalar(s);
  // Feet on y=0
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;

  // Team tint (lerp materials toward team color)
  const team = new THREE.Color(teamColor);
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.SkinnedMesh)) {
      return;
    }
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (!m || !("color" in m)) continue;
      // Clone so instances don't share tint
      const cloned = (m as THREE.Material).clone() as THREE.MeshStandardMaterial;
      if (cloned.color) {
        cloned.color.lerp(team, 0.4);
      }
      if (Array.isArray(obj.material)) {
        obj.material[i] = cloned;
      } else {
        obj.material = cloned;
      }
    }
  });

  // Prefer right arm tip / hand for weapons
  let rightHand: THREE.Object3D | null = null;
  let torso: THREE.Object3D | null = null;
  root.traverse((obj) => {
    const n = obj.name.toLowerCase();
    if (
      !rightHand &&
      (n.includes("arm_joint_r__3") ||
        n.includes("hand_r") ||
        n.includes("righthand") ||
        n.endsWith("arm_joint_r"))
    ) {
      rightHand = obj;
    }
    if (
      !torso &&
      (n.includes("torso_joint_2") ||
        n.includes("spine") ||
        n.includes("torso_joint_1"))
    ) {
      torso = obj;
    }
  });
  // Fallback: deepest bone with "arm" and "r"
  if (!rightHand) {
    root.traverse((obj) => {
      const n = obj.name.toLowerCase();
      if (n.includes("arm") && n.includes("r") && obj.type === "Bone") {
        rightHand = obj;
      }
    });
  }

  return {
    root,
    clips: asset.clips,
    rightHand,
    torso,
  };
}
