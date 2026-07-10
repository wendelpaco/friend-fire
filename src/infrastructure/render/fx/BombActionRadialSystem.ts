import * as THREE from "three";

export type BombActionMode = "plant" | "defuse" | "defuse_kit";

export type BombActionVisual = {
  x: number;
  z: number;
  /** 0–1 hold progress. */
  progress: number;
  mode: BombActionMode;
  /**
   * "SEGURE F" guidance for the local actor only.
   * Enemies/spectators still see the ring (fake plant/defuse pressure).
   */
  showLabel?: boolean;
};

/** Base world radius of the action ring (feet). */
const BASE_RADIUS = 0.72;
/** Minimum on-screen radius in CSS pixels so zoom-out stays legible. */
const MIN_SCREEN_PX = 48;
const RING_Y = 0.08;
const LABEL_Y = 1.55;

const MODE_COLOR: Record<BombActionMode, string> = {
  plant: "#f59e0b",
  defuse: "#38bdf8",
  defuse_kit: "#34d399",
};

/**
 * World-space plant/defuse radial around the acting character.
 * Visible to everyone (fake plant / defuse pressure). Client cosmetic.
 */
export class BombActionRadialSystem {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly ringMesh: THREE.Mesh;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly labelSprite: THREE.Sprite;
  private readonly labelMat: THREE.SpriteMaterial;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly ringTex: THREE.CanvasTexture;
  private active = false;
  private lastKey = "";
  private screenH = 720;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root.name = "BombActionRadialSystem";
    this.root.visible = false;
    this.scene.add(this.root);

    this.canvas = document.createElement("canvas");
    this.canvas.width = 256;
    this.canvas.height = 256;
    this.ctx = this.canvas.getContext("2d")!;
    this.ringTex = new THREE.CanvasTexture(this.canvas);
    this.ringTex.colorSpace = THREE.SRGBColorSpace;

    this.ringMat = new THREE.MeshBasicMaterial({
      map: this.ringTex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    this.ringMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.ringMat,
    );
    this.ringMesh.rotation.x = -Math.PI / 2;
    this.ringMesh.position.y = RING_Y;
    this.ringMesh.renderOrder = 12;
    this.root.add(this.ringMesh);

    this.labelMat = new THREE.SpriteMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      opacity: 0.95,
    });
    this.labelSprite = new THREE.Sprite(this.labelMat);
    this.labelSprite.position.y = LABEL_Y;
    this.labelSprite.scale.set(1.6, 0.42, 1);
    this.labelSprite.renderOrder = 13;
    this.root.add(this.labelSprite);

    this.bakeLabel();
  }

  /** Viewport height (px) for min on-screen radius. */
  setScreenHeight(h: number): void {
    if (h > 0 && Number.isFinite(h)) this.screenH = h;
  }

  /** Show radial at world XZ or hide when null. */
  setVisual(v: BombActionVisual | null): void {
    if (!v || v.progress <= 0) {
      this.active = false;
      this.root.visible = false;
      this.lastKey = "";
      return;
    }
    this.active = true;
    this.root.visible = true;
    this.root.position.set(v.x, 0, v.z);
    this.labelSprite.visible = v.showLabel === true;

    const key = `${v.mode}|${Math.round(v.progress * 48)}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.drawRing(v.progress, MODE_COLOR[v.mode]);
    }
  }

  /**
   * Scale ring so it never drops below MIN_SCREEN_PX on screen.
   * Call once per frame with the active camera.
   */
  update(_dt: number, camera?: THREE.Camera): void {
    if (!this.active) return;
    let r = BASE_RADIUS;
    if (camera) {
      const dist = camera.position.distanceTo(this.root.position);
      const persp = camera as THREE.PerspectiveCamera;
      const fov = (persp.fov ?? 46) * (Math.PI / 180);
      const worldPerPx =
        (2 * Math.max(0.5, dist) * Math.tan(fov / 2)) /
        Math.max(1, this.screenH);
      r = Math.max(BASE_RADIUS, MIN_SCREEN_PX * worldPerPx);
    }
    this.ringMesh.scale.set(r, r, 1);
    // Keep "SEGURE F" readable at the same min-px floor as the ring.
    if (this.labelSprite.visible) {
      const labelScale = Math.max(1, r / BASE_RADIUS);
      this.labelSprite.scale.set(1.6 * labelScale, 0.42 * labelScale, 1);
    }
  }

  dispose(): void {
    this.scene.remove(this.root);
    this.ringMesh.geometry.dispose();
    this.ringMat.dispose();
    this.ringTex.dispose();
    if (this.labelMat.map) this.labelMat.map.dispose();
    this.labelMat.dispose();
  }

  private drawRing(progress: number, color: string): void {
    const ctx = this.ctx;
    const size = this.canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outer = size * 0.42;
    const inner = size * 0.3;
    ctx.clearRect(0, 0, size, size);

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, (outer + inner) / 2, 0, Math.PI * 2);
    ctx.lineWidth = outer - inner;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, (outer + inner) / 2, 0, Math.PI * 2);
    ctx.lineWidth = (outer - inner) * 0.55;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();

    // Progress (from top, clockwise)
    const p = Math.max(0, Math.min(1, progress));
    if (p > 0.001) {
      const start = -Math.PI / 2;
      const end = start + p * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, (outer + inner) / 2, start, end);
      ctx.lineWidth = outer - inner;
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    this.ringTex.needsUpdate = true;
  }

  private bakeLabel(): void {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = "bold 28px system-ui, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 5;
    ctx.strokeText("SEGURE F", c.width / 2, c.height / 2);
    ctx.fillStyle = "#f8fafc";
    ctx.fillText("SEGURE F", c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (this.labelMat.map) this.labelMat.map.dispose();
    this.labelMat.map = tex;
    this.labelMat.needsUpdate = true;
  }
}
