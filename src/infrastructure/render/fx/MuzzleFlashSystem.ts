import * as THREE from "three";

/** Spec 5.1: muzzle flash 40–60 ms, additive yellow-white + optional light. */
const FLASH_DURATION_MIN = 0.04;
const FLASH_DURATION_MAX = 0.06;
const POOL_SIZE = 16;
const BARREL_OFFSET = 0.95;
const FLASH_HEIGHT = 1.0;
const LIGHT_INTENSITY = 2.8;
const LIGHT_DISTANCE = 4.5;

interface FlashSlot {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  age: number;
  life: number;
  active: boolean;
}

/**
 * Short additive muzzle flash with a brief point light.
 * Wire via spawn(x, z, rot) on local fire; call update(dt) each frame.
 */
export class MuzzleFlashSystem {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly pool: FlashSlot[] = [];
  private readonly sharedGeo: THREE.BufferGeometry;
  private readonly sharedMat: THREE.MeshBasicMaterial;
  private cursor = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root.name = "MuzzleFlashSystem";
    this.scene.add(this.root);

    this.sharedGeo = new THREE.SphereGeometry(0.18, 8, 8);
    this.sharedMat = new THREE.MeshBasicMaterial({
      color: 0xfff2a8,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(this.sharedGeo, this.sharedMat.clone());
      mesh.visible = false;
      mesh.frustumCulled = false;

      const light = new THREE.PointLight(0xffee99, 0, LIGHT_DISTANCE, 2);
      light.visible = false;

      this.root.add(mesh);
      this.root.add(light);
      this.pool.push({ mesh, light, age: 0, life: 0, active: false });
    }
  }

  /** Place flash at gun tip along facing (`sin(rot)`, `cos(rot)`). */
  spawn(x: number, z: number, rot: number): void {
    const slot = this.acquire();
    const ox = Math.sin(rot) * BARREL_OFFSET;
    const oz = Math.cos(rot) * BARREL_OFFSET;
    const px = x + ox;
    const py = FLASH_HEIGHT;
    const pz = z + oz;

    slot.mesh.position.set(px, py, pz);
    slot.mesh.scale.setScalar(1);
    slot.mesh.visible = true;
    const mat = slot.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.95;

    slot.light.position.set(px, py, pz);
    slot.light.intensity = LIGHT_INTENSITY;
    slot.light.visible = true;

    slot.age = 0;
    slot.life =
      FLASH_DURATION_MIN +
      Math.random() * (FLASH_DURATION_MAX - FLASH_DURATION_MIN);
    slot.active = true;
  }

  update(dt: number): void {
    for (const slot of this.pool) {
      if (!slot.active) continue;
      slot.age += dt;
      const t = slot.age / slot.life;
      if (t >= 1) {
        this.release(slot);
        continue;
      }
      // Peak early, then fall off to 0 within the same window.
      const fall = 1 - t;
      const intensity = fall * fall;
      const mat = slot.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.95 * intensity;
      slot.mesh.scale.setScalar(0.7 + 0.6 * (1 - t));
      slot.light.intensity = LIGHT_INTENSITY * intensity;
    }
  }

  dispose(): void {
    for (const slot of this.pool) {
      this.root.remove(slot.mesh);
      this.root.remove(slot.light);
      (slot.mesh.material as THREE.Material).dispose();
      slot.light.dispose();
    }
    this.pool.length = 0;
    this.sharedGeo.dispose();
    this.sharedMat.dispose();
    this.scene.remove(this.root);
  }

  private acquire(): FlashSlot {
    // Prefer inactive; otherwise overwrite oldest active (ring).
    for (let i = 0; i < this.pool.length; i++) {
      const idx = (this.cursor + i) % this.pool.length;
      if (!this.pool[idx].active) {
        this.cursor = (idx + 1) % this.pool.length;
        return this.pool[idx];
      }
    }
    const slot = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    return slot;
  }

  private release(slot: FlashSlot): void {
    slot.active = false;
    slot.mesh.visible = false;
    slot.light.visible = false;
    slot.light.intensity = 0;
  }
}
