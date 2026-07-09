import * as THREE from "three";

/** Spec §2.8 — floating “-XX” at hit pos, pool, life 0.6s. */
const POOL_SIZE = 24;
const LIFE = 0.6;
const RISE_SPEED = 1.35;
const SPRITE_W = 1.4;
const SPRITE_H = 0.55;

interface Slot {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  active: boolean;
  baseY: number;
}

/**
 * Pooled billboard damage numbers: float up and fade out.
 */
export class DamageNumberSystem {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly pool: Slot[] = [];
  private cursor = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root.name = "DamageNumberSystem";
    this.scene.add(this.root);

    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.SpriteMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.scale.set(SPRITE_W, SPRITE_H, 1);
      sprite.renderOrder = 20;
      this.root.add(sprite);
      this.pool.push({
        sprite,
        age: 0,
        life: LIFE,
        active: false,
        baseY: 0,
      });
    }
  }

  spawn(x: number, y: number, z: number, text: string): void {
    const slot = this.acquire();
    const tex = makeTextTexture(text);
    const mat = slot.sprite.material as THREE.SpriteMaterial;
    if (mat.map) mat.map.dispose();
    mat.map = tex;
    mat.opacity = 1;
    mat.needsUpdate = true;

    slot.sprite.position.set(x, y, z);
    slot.sprite.scale.set(SPRITE_W, SPRITE_H, 1);
    slot.sprite.visible = true;
    slot.baseY = y;
    slot.age = 0;
    slot.life = LIFE;
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
      slot.sprite.position.y = slot.baseY + t * RISE_SPEED;
      const mat = slot.sprite.material as THREE.SpriteMaterial;
      // Hold full opacity briefly, then fade
      mat.opacity = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
      const s = 1 + t * 0.15;
      slot.sprite.scale.set(SPRITE_W * s, SPRITE_H * s, 1);
    }
  }

  dispose(): void {
    for (const slot of this.pool) {
      this.root.remove(slot.sprite);
      const mat = slot.sprite.material as THREE.SpriteMaterial;
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
    this.pool.length = 0;
    this.scene.remove(this.root);
  }

  private acquire(): Slot {
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

  private release(slot: Slot): void {
    slot.active = false;
    slot.sprite.visible = false;
    const mat = slot.sprite.material as THREE.SpriteMaterial;
    mat.opacity = 0;
  }
}

function makeTextTexture(text: string): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.font = "bold 72px system-ui, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 10;
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = "#ff4444";
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
