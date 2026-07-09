import * as THREE from "three";

/** Spec 5.3–5.4: cosmetic wall decals + temporary chunks. No collision change. */
const MAX_DECALS = 80;
const MAX_CHUNKS = 40;
const DECAL_LIFE = 10.0; // seconds (8–12s range; default 10)
const CHUNK_LIFE = 5.0;
const CHUNK_FADE = 0.4;
const DECAL_SIZE_MIN = 0.12;
const DECAL_SIZE_MAX = 0.22;
const NORMAL_BIAS = 0.02;

interface DecalSlot {
  mesh: THREE.Mesh;
  age: number;
  life: number;
  active: boolean;
}

interface ChunkSlot {
  group: THREE.Group;
  age: number;
  life: number;
  fade: number;
  active: boolean;
  materials: THREE.MeshStandardMaterial[];
}

/**
 * Cosmetic wall damage: scorch decal + temporary inset chunk meshes.
 * Caps: 80 decals / 40 chunks. Chunks expire ~5s; decals ~10s.
 */
export class WallDamageSystem {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly decals: DecalSlot[] = [];
  private readonly chunks: ChunkSlot[] = [];
  private readonly decalGeo: THREE.PlaneGeometry;
  private readonly decalTexture: THREE.CanvasTexture;
  private readonly chunkBoxGeo: THREE.BoxGeometry;
  private decalCursor = 0;
  private chunkCursor = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root.name = "WallDamageSystem";
    this.scene.add(this.root);

    this.decalTexture = makeScorchTexture();
    this.decalGeo = new THREE.PlaneGeometry(1, 1);
    this.chunkBoxGeo = new THREE.BoxGeometry(1, 1, 1);

    for (let i = 0; i < MAX_DECALS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.decalTexture,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const mesh = new THREE.Mesh(this.decalGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.root.add(mesh);
      this.decals.push({ mesh, age: 0, life: DECAL_LIFE, active: false });
    }

    for (let i = 0; i < MAX_CHUNKS; i++) {
      const group = new THREE.Group();
      group.visible = false;
      const materials: THREE.MeshStandardMaterial[] = [];
      // 2–4 irregular boxes; prebuild max 4
      for (let b = 0; b < 4; b++) {
        const mat = new THREE.MeshStandardMaterial({
          color: 0x4a3a2a,
          roughness: 0.95,
          metalness: 0.02,
          transparent: true,
          opacity: 1,
        });
        materials.push(mat);
        const box = new THREE.Mesh(this.chunkBoxGeo, mat);
        box.castShadow = false;
        box.receiveShadow = false;
        group.add(box);
      }
      this.root.add(group);
      this.chunks.push({
        group,
        age: 0,
        life: CHUNK_LIFE,
        fade: CHUNK_FADE,
        active: false,
        materials,
      });
    }
  }

  /** Spawn scorch decal + temporary wall chunk at impact (visual only). */
  spawn(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
  ): void {
    const nLen = Math.hypot(nx, ny, nz) || 1;
    const nnx = nx / nLen;
    const nny = ny / nLen;
    const nnz = nz / nLen;

    this.spawnDecal(x, y, z, nnx, nny, nnz);
    this.spawnChunk(x, y, z, nnx, nny, nnz);
  }

  update(dt: number): void {
    for (const d of this.decals) {
      if (!d.active) continue;
      d.age += dt;
      const t = d.age / d.life;
      if (t >= 1) {
        this.releaseDecal(d);
        continue;
      }
      const mat = d.mesh.material as THREE.MeshBasicMaterial;
      // Hold full opacity most of life, fade last 25%
      mat.opacity = t < 0.75 ? 0.9 : 0.9 * (1 - (t - 0.75) / 0.25);
    }

    for (const c of this.chunks) {
      if (!c.active) continue;
      c.age += dt;
      const total = c.life + c.fade;
      if (c.age >= total) {
        this.releaseChunk(c);
        continue;
      }
      if (c.age > c.life) {
        const ft = (c.age - c.life) / c.fade;
        const opacity = 1 - ft;
        for (const m of c.materials) m.opacity = opacity;
      }
    }
  }

  dispose(): void {
    for (const d of this.decals) {
      this.root.remove(d.mesh);
      (d.mesh.material as THREE.Material).dispose();
    }
    for (const c of this.chunks) {
      this.root.remove(c.group);
      for (const m of c.materials) m.dispose();
    }
    this.decals.length = 0;
    this.chunks.length = 0;
    this.decalGeo.dispose();
    this.chunkBoxGeo.dispose();
    this.decalTexture.dispose();
    this.scene.remove(this.root);
  }

  private spawnDecal(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
  ): void {
    const slot = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % MAX_DECALS;

    const size =
      DECAL_SIZE_MIN + Math.random() * (DECAL_SIZE_MAX - DECAL_SIZE_MIN);
    slot.mesh.scale.set(size, size, 1);
    slot.mesh.position.set(
      x + nx * NORMAL_BIAS,
      y + ny * NORMAL_BIAS,
      z + nz * NORMAL_BIAS,
    );
    // Orient plane so +Z faces outward along normal
    const look = new THREE.Vector3(x + nx, y + ny, z + nz);
    slot.mesh.lookAt(look);

    const mat = slot.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.9;
    slot.mesh.visible = true;
    slot.age = 0;
    slot.life = DECAL_LIFE;
    slot.active = true;
  }

  private spawnChunk(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
  ): void {
    const slot = this.chunks[this.chunkCursor];
    this.chunkCursor = (this.chunkCursor + 1) % MAX_CHUNKS;

    const boxCount = 2 + Math.floor(Math.random() * 3); // 2–4
    const children = slot.group.children as THREE.Mesh[];

    // Place group slightly inset into wall along -normal (crater look)
    const inset = 0.04 + Math.random() * 0.06;
    slot.group.position.set(x - nx * inset, y - ny * inset, z - nz * inset);
    // Align local +Z with wall normal for easier offsets
    slot.group.lookAt(x + nx, y + ny, z + nz);

    for (let i = 0; i < children.length; i++) {
      const mesh = children[i];
      if (i >= boxCount) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const sx = 0.08 + Math.random() * 0.18; // ~0.08–0.26 → overall 0.15–0.35 cluster
      const sy = 0.08 + Math.random() * 0.18;
      const sz = 0.04 + Math.random() * 0.1;
      mesh.scale.set(sx, sy, sz);
      mesh.position.set(
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.04,
      );
      mesh.rotation.set(
        Math.random() * 0.6,
        Math.random() * 0.6,
        Math.random() * 0.6,
      );
      const mat = slot.materials[i];
      mat.opacity = 1;
      // Slight color variance, darker than typical wall sand
      const shade = 0.22 + Math.random() * 0.12;
      mat.color.setRGB(shade * 1.1, shade * 0.9, shade * 0.65);
      mat.roughness = 0.92 + Math.random() * 0.06;
    }

    slot.group.visible = true;
    slot.age = 0;
    slot.life = CHUNK_LIFE;
    slot.fade = CHUNK_FADE;
    slot.active = true;
  }

  private releaseDecal(d: DecalSlot): void {
    d.active = false;
    d.mesh.visible = false;
  }

  private releaseChunk(c: ChunkSlot): void {
    c.active = false;
    c.group.visible = false;
  }
}

function makeScorchTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Outer soft scorch
  const outer = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.48);
  outer.addColorStop(0, "rgba(20, 12, 8, 0.95)");
  outer.addColorStop(0.35, "rgba(40, 28, 18, 0.75)");
  outer.addColorStop(0.7, "rgba(30, 22, 14, 0.35)");
  outer.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = outer;
  ctx.fillRect(0, 0, size, size);

  // Inner “hole”
  const hole = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.18);
  hole.addColorStop(0, "rgba(5, 4, 3, 0.98)");
  hole.addColorStop(0.7, "rgba(12, 10, 8, 0.85)");
  hole.addColorStop(1, "rgba(20, 14, 10, 0)");
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Irregular rim noise
  ctx.globalCompositeOperation = "source-atop";
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = size * (0.12 + Math.random() * 0.28);
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    ctx.fillStyle = `rgba(10, 8, 6, ${0.15 + Math.random() * 0.35})`;
    ctx.beginPath();
    ctx.arc(px, py, 1 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
