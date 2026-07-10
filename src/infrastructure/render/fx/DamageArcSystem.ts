import * as THREE from "three";

/** Directional damage arc on local player — 300ms, max 1 (gunfeel pack B). */
const ARC_LIFE = 0.3;
const INNER_R = 0.55;
const OUTER_R = 0.95;
const ARC_SPAN = Math.PI * 0.55; // ~100° wedge toward damage source

/**
 * RingGeometry sector is centered on local +X. After mesh.rotation.x = −π/2
 * the wedge still faces world +X at rotation.z = 0. Map that center to (dx, dz)
 * on the ground plane (Euler XYZ: rot.z spins the flat ring in XZ).
 */
export function damageArcRotationZ(dx: number, dz: number): number {
  return -Math.atan2(dz, dx);
}

/**
 * World-space red damage direction indicator around the local player.
 * Only one arc at a time — newest hit replaces the previous.
 */
export class DamageArcSystem {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private age = 0;
  private life = ARC_LIFE;
  private active = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root.name = "DamageArc";
    this.scene.add(this.root);

    this.mat = new THREE.MeshBasicMaterial({
      color: 0xff3030,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });

    // Ring sector in XY; laid flat with rotation.x, aimed with rotation.z
    const geo = new THREE.RingGeometry(
      INNER_R,
      OUTER_R,
      24,
      1,
      -ARC_SPAN / 2,
      ARC_SPAN,
    );
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.08;
    this.mesh.visible = false;
    this.root.add(this.mesh);
  }

  /**
   * Show arc at player feet pointing toward damage source world XZ.
   * Replaces any existing arc (max 1).
   */
  spawn(
    playerX: number,
    playerZ: number,
    fromX: number,
    fromZ: number,
  ): void {
    const dx = fromX - playerX;
    const dz = fromZ - playerZ;
    if (dx * dx + dz * dz < 1e-8) return;

    this.root.position.set(playerX, 0, playerZ);
    // Sector center is +X; aim that axis at the attacker on XZ.
    this.mesh.rotation.z = damageArcRotationZ(dx, dz);

    this.age = 0;
    this.life = ARC_LIFE;
    this.active = true;
    this.mesh.visible = true;
    this.mat.opacity = 0.75;
  }

  /** True while an arc is visible (tests / debug). */
  get isActive(): boolean {
    return this.active;
  }

  /**
   * Horizontal unit direction of the wedge center in world XZ, or null if inactive.
   * Used by tests to assert orientation toward the damage source.
   */
  wedgeDirectionXZ(): { x: number; z: number } | null {
    if (!this.active) return null;
    this.root.updateMatrixWorld(true);
    const r = (INNER_R + OUTER_R) / 2;
    const p = new THREE.Vector3(r, 0, 0);
    this.mesh.localToWorld(p);
    const wx = p.x - this.root.position.x;
    const wz = p.z - this.root.position.z;
    const len = Math.hypot(wx, wz);
    if (len < 1e-8) return null;
    return { x: wx / len, z: wz / len };
  }

  /** Keep arc under moving player while alive. */
  setPosition(x: number, z: number): void {
    if (!this.active) return;
    this.root.position.x = x;
    this.root.position.z = z;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.age += dt;
    const t = this.age / this.life;
    if (t >= 1) {
      this.active = false;
      this.mesh.visible = false;
      return;
    }
    // Peak early, fade out
    const fall = 1 - t;
    this.mat.opacity = 0.75 * fall * fall;
  }

  dispose(): void {
    this.scene.remove(this.root);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
