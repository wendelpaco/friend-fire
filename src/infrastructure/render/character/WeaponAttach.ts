import * as THREE from "three";
import type { CharacterBones } from "./CharacterRig";

export type WeaponCategory = "knife" | "pistol" | "rifle";

const METAL = () =>
  new THREE.MeshStandardMaterial({
    color: 0x1c1c1c,
    metalness: 0.55,
    roughness: 0.35,
  });

const DARK = () =>
  new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.55,
    metalness: 0.2,
  });

const BLADE = () =>
  new THREE.MeshStandardMaterial({
    color: 0xc0c8d0,
    metalness: 0.75,
    roughness: 0.25,
  });

function mesh(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}

/**
 * Build a low-poly weapon group oriented along **+Z** (barrel forward).
 * Matches procedural character facing (+Z vest / yawFromDirection).
 * (Older −Z weapons made the gun point opposite the chest.)
 */
export function buildWeaponMesh(category: WeaponCategory): THREE.Group {
  const g = new THREE.Group();
  g.name = `weapon_${category}`;

  if (category === "knife") {
    // short blade; handle at origin, blade +Z
    const handle = mesh(0.06, 0.08, 0.12, DARK());
    handle.position.set(0, 0, -0.02);
    g.add(handle);
    const guard = mesh(0.12, 0.04, 0.04, METAL());
    guard.position.set(0, 0, 0.05);
    g.add(guard);
    const blade = mesh(0.04, 0.02, 0.28, BLADE());
    blade.position.set(0, 0.01, 0.2);
    g.add(blade);
    return g;
  }

  if (category === "pistol") {
    // compact gun: grip down, barrel +Z
    const body = mesh(0.08, 0.12, 0.28, METAL());
    body.position.set(0, 0.02, 0.1);
    g.add(body);
    const grip = mesh(0.07, 0.16, 0.1, DARK());
    grip.position.set(0, -0.08, -0.02);
    g.add(grip);
    const slide = mesh(0.07, 0.06, 0.22, METAL());
    slide.position.set(0, 0.08, 0.12);
    g.add(slide);
    const barrel = mesh(0.04, 0.04, 0.1, METAL());
    barrel.position.set(0, 0.04, 0.28);
    g.add(barrel);
    return g;
  }

  // rifle — longer silhouette, barrel +Z
  const receiver = mesh(0.1, 0.12, 0.55, METAL());
  receiver.position.set(0, 0.02, 0.2);
  g.add(receiver);
  const stock = mesh(0.08, 0.14, 0.22, DARK());
  stock.position.set(0, 0.0, -0.18);
  g.add(stock);
  const barrel = mesh(0.05, 0.05, 0.4, METAL());
  barrel.position.set(0, 0.04, 0.55);
  g.add(barrel);
  const mag = mesh(0.06, 0.16, 0.1, DARK());
  mag.position.set(0, -0.1, 0.08);
  g.add(mag);
  const handguard = mesh(0.09, 0.08, 0.28, DARK());
  handguard.position.set(0, 0.0, 0.42);
  g.add(handguard);
  return g;
}

/**
 * Manages weapon mesh on `bones.weaponSlot`.
 * Swap is synchronous (within 1 frame).
 */
export class WeaponAttach {
  private readonly slot: THREE.Object3D;
  private current: WeaponCategory | null = null;
  private mesh: THREE.Group | null = null;

  constructor(bones: CharacterBones) {
    this.slot = bones.weaponSlot;
  }

  get category(): WeaponCategory | null {
    return this.current;
  }

  setWeapon(category: WeaponCategory): void {
    if (this.current === category && this.mesh) return;
    this.clearMesh();
    this.mesh = buildWeaponMesh(category);
    this.slot.add(this.mesh);
    this.current = category;
  }

  private clearMesh(): void {
    if (!this.mesh) return;
    this.slot.remove(this.mesh);
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
    this.mesh = null;
    this.current = null;
  }

  dispose(): void {
    this.clearMesh();
  }
}
