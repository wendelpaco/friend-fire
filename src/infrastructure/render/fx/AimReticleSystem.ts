import * as THREE from "three";

/**
 * Ground-projected aim reticle (RUSH-B orange ring + cross).
 * Client cosmetic only — no network.
 */
export class AimReticleSystem {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly ring: THREE.Mesh;
  private readonly crossH: THREE.Mesh;
  private readonly crossV: THREE.Mesh;
  private visible = true;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root.name = "AimReticle";
    this.scene.add(this.root);

    const mat = new THREE.MeshBasicMaterial({
      color: 0xf0a030,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });

    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.38, 32), mat);
    this.ring.rotation.x = -Math.PI / 2;
    this.root.add(this.ring);

    const barMat = mat.clone();
    this.crossH = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.04),
      barMat,
    );
    this.crossH.rotation.x = -Math.PI / 2;
    this.root.add(this.crossH);

    this.crossV = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 0.42),
      barMat,
    );
    this.crossV.rotation.x = -Math.PI / 2;
    this.root.add(this.crossV);

    this.root.position.y = 0.06;
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.root.visible = on;
  }

  /** Place reticle on ground at world XZ. */
  setPosition(x: number, z: number): void {
    if (!this.visible) return;
    this.root.position.x = x;
    this.root.position.z = z;
  }

  dispose(): void {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
