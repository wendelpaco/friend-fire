import * as THREE from "three";

/** Red blinking cylinder + ring at planted bomb world position. Spec §2.1. */
export class BombMarkerSystem {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly cylinder: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly cylMat: THREE.MeshBasicMaterial;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private active = false;
  private age = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root.name = "BombMarkerSystem";
    this.root.visible = false;
    this.scene.add(this.root);

    this.cylMat = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.32, 0.35, 16),
      this.cylMat,
    );
    this.cylinder.position.y = 0.18;
    this.root.add(this.cylinder);

    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.95, 32),
      this.ringMat,
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.05;
    this.root.add(this.ring);
  }

  /** Show marker at (x,z) or hide when pos is null. */
  setVisual(pos: { x: number; z: number } | null): void {
    if (!pos) {
      this.active = false;
      this.root.visible = false;
      return;
    }
    this.active = true;
    this.root.visible = true;
    this.root.position.set(pos.x, 0, pos.z);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.age += dt;
    // Blink ~2.5 Hz, soft pulse
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(this.age * Math.PI * 2.5));
    this.cylMat.opacity = 0.45 + 0.5 * pulse;
    this.ringMat.opacity = 0.25 + 0.45 * pulse;
    const s = 0.92 + 0.12 * pulse;
    this.ring.scale.set(s, s, s);
  }

  dispose(): void {
    this.root.remove(this.cylinder);
    this.root.remove(this.ring);
    this.cylinder.geometry.dispose();
    this.ring.geometry.dispose();
    this.cylMat.dispose();
    this.ringMat.dispose();
    this.scene.remove(this.root);
  }
}
