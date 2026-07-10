import * as THREE from "three";

/** Close dispersion toward first-shot min in ~150ms. */
const DISPERSION_CLOSE_MS = 0.15;
/** Thin ring thickness in world units (≈1px at typical camera height). */
const RING_THICKNESS = 0.018;
const MIN_DISP_RADIUS = 0.04;
const MAX_DISP_RADIUS = 8;

/**
 * Ground-projected aim reticle (RUSH-B orange ring + cross)
 * plus world dispersion circle from real first-shot / current spread.
 * Client cosmetic only — no network.
 */
export class AimReticleSystem {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly ring: THREE.Mesh;
  private readonly crossH: THREE.Mesh;
  private readonly crossV: THREE.Mesh;
  private readonly dispersion: THREE.Mesh;
  private readonly dispersionMat: THREE.MeshBasicMaterial;
  private visible = true;
  private displayRadius = 0;
  private targetRadius = 0;

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

    // Thin 1px-ish dispersion circle ~60% opacity (gunfeel pack A)
    this.dispersionMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    // Unit ring; scale.x/z set to world radius each frame
    this.dispersion = new THREE.Mesh(
      new THREE.RingGeometry(1 - RING_THICKNESS, 1, 48),
      this.dispersionMat,
    );
    this.dispersion.rotation.x = -Math.PI / 2;
    this.dispersion.position.y = 0.01;
    this.dispersion.visible = false;
    this.root.add(this.dispersion);

    this.root.position.y = 0.06;
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.root.visible = on;
    if (!on) {
      this.dispersion.visible = false;
    }
  }

  /** Place reticle on ground at world XZ. */
  setPosition(x: number, z: number): void {
    if (!this.visible) return;
    this.root.position.x = x;
    this.root.position.z = z;
  }

  /**
   * Target world radius of the dispersion cone at the aim point.
   * Pass 0 (or near-min) to collapse when effective spread ≈ first-shot min.
   */
  setDispersionRadius(radius: number): void {
    if (!(radius > 0) || !Number.isFinite(radius)) {
      this.targetRadius = 0;
      return;
    }
    this.targetRadius = Math.min(MAX_DISP_RADIUS, Math.max(0, radius));
  }

  /** Smooth open/close — call once per frame with dt seconds. */
  update(dt: number): void {
    if (!this.visible) return;
    const d = dt > 0 && Number.isFinite(dt) ? dt : 0;
    if (d <= 0) return;

    // Open quickly on move/fire; close ~150ms when stopped / recovered.
    const opening = this.targetRadius > this.displayRadius;
    const tau = opening ? 0.06 : DISPERSION_CLOSE_MS;
    const k = 1 - Math.exp(-d / Math.max(1e-4, tau));
    this.displayRadius += (this.targetRadius - this.displayRadius) * k;

    if (this.displayRadius < MIN_DISP_RADIUS * 0.5) {
      this.dispersion.visible = false;
      return;
    }

    const r = Math.max(MIN_DISP_RADIUS, this.displayRadius);
    this.dispersion.scale.set(r, 1, r);
    this.dispersion.visible = true;
    // Fade slightly when collapsing toward minimum
    const t = Math.min(1, this.displayRadius / Math.max(0.12, this.targetRadius || 0.12));
    this.dispersionMat.opacity = 0.35 + 0.25 * t;
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
