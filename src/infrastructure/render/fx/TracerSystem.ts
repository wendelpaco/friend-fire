import * as THREE from "three";

const MAX_TRACERS = 16;
const LIFE = 0.08;

interface Slot {
  line: THREE.Line;
  age: number;
  life: number;
  active: boolean;
}

/**
 * Short-lived bullet tracers (muzzle → impact). Pooled lines, no shadows.
 * Disabled / thinner feel is controlled by caller via `enabled`.
 */
export class TracerSystem {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly slots: Slot[] = [];
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.LineBasicMaterial;
  private enabled = true;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root.name = "TracerSystem";
    this.scene.add(this.root);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(6), 3),
    );
    this.mat = new THREE.LineBasicMaterial({
      color: 0xffe088,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      toneMapped: false,
    });

    for (let i = 0; i < MAX_TRACERS; i++) {
      const geo = this.geo.clone();
      const mat = this.mat.clone();
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      this.root.add(line);
      this.slots.push({ line, age: 0, life: LIFE, active: false });
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      for (const s of this.slots) {
        s.active = false;
        s.line.visible = false;
      }
    }
  }

  /**
   * Spawn tracer from (x0,y0,z0) to (x1,y1,z1).
   */
  spawn(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
  ): void {
    if (!this.enabled) return;
    const slot = this.acquire();
    if (!slot) return;
    const pos = slot.line.geometry.attributes
      .position as THREE.BufferAttribute;
    pos.setXYZ(0, x0, y0, z0);
    pos.setXYZ(1, x1, y1, z1);
    pos.needsUpdate = true;
    slot.line.geometry.computeBoundingSphere();
    slot.age = 0;
    slot.life = LIFE * (0.85 + Math.random() * 0.3);
    slot.active = true;
    slot.line.visible = true;
    const mat = slot.line.material as THREE.LineBasicMaterial;
    mat.opacity = 0.95;
  }

  update(dt: number): void {
    for (const s of this.slots) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.life) {
        s.active = false;
        s.line.visible = false;
        continue;
      }
      const t = s.age / s.life;
      (s.line.material as THREE.LineBasicMaterial).opacity = 0.95 * (1 - t);
    }
  }

  dispose(): void {
    for (const s of this.slots) {
      this.root.remove(s.line);
      s.line.geometry.dispose();
      (s.line.material as THREE.Material).dispose();
    }
    this.slots.length = 0;
    this.geo.dispose();
    this.mat.dispose();
    this.scene.remove(this.root);
  }

  private acquire(): Slot | null {
    for (const s of this.slots) {
      if (!s.active) return s;
    }
    // Steal oldest
    let oldest = this.slots[0];
    if (!oldest) return null;
    for (const s of this.slots) {
      if (s.age > oldest.age) oldest = s;
    }
    return oldest;
  }
}
