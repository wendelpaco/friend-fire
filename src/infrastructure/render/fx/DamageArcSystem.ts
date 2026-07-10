import * as THREE from "three";

/** Directional damage arc on local player — 300ms, max 1 (gunfeel pack B). */
const ARC_LIFE = 0.3;
const INNER_R = 0.55;
const OUTER_R = 0.95;
const ARC_SPAN = Math.PI * 0.55; // ~100° wedge toward damage source

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

    // Ring sector in XZ; rotation.y aims the wedge
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

    // Yaw so wedge faces the attacker (RingGeometry spans around +X by default
    // in XY; after rot.x=-90, local +Y of ring → world −Z… use atan2 for XZ).
    const yaw = Math.atan2(dx, dz);
    this.root.position.set(playerX, 0, playerZ);
    // Mesh is flat on XZ; rotate around Y so arc center points at attacker.
    this.mesh.rotation.z = -yaw;

    this.age = 0;
    this.life = ARC_LIFE;
    this.active = true;
    this.mesh.visible = true;
    this.mat.opacity = 0.75;
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
