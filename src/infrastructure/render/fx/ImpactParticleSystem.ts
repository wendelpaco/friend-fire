import * as THREE from "three";

/** Spec 5.2 impact particles — sparks + dust, pooled, max 40 bursts. */
export type ImpactSurface = "wall" | "ground" | "prop";

const MAX_BURSTS = 40;
/** Keep total pool ≤500 (spec §7 particle budget). */
const PARTICLES_PER_BURST = 12;
const POOL_PARTICLES = 480;
const GRAVITY = -9.5;

const SPARK_COLORS = [0xffaa33, 0xffcc44, 0xffee66, 0xff8833];
const DUST_COLORS = [0x8b7355, 0xa08060, 0x6b5344, 0xc4a574];

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  active: boolean;
  kind: "spark" | "dust";
}

/**
 * Warm sparks + brown dust at hit points. Caps concurrent bursts at 40.
 */
export class ImpactParticleSystem {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly particles: Particle[] = [];
  private readonly geo: THREE.BufferGeometry;
  private readonly sparkMat: THREE.MeshBasicMaterial;
  private readonly dustMat: THREE.MeshBasicMaterial;
  private activeBursts = 0;
  private free: Particle[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root.name = "ImpactParticleSystem";
    this.scene.add(this.root);

    this.geo = new THREE.SphereGeometry(0.04, 4, 4);
    this.sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.dustMat = new THREE.MeshBasicMaterial({
      color: 0x8b7355,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });

    for (let i = 0; i < POOL_PARTICLES; i++) {
      const mat = this.sparkMat.clone();
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      const p: Particle = {
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        life: 0,
        active: false,
        kind: "spark",
      };
      this.particles.push(p);
      this.free.push(p);
    }
  }

  spawn(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    surface: ImpactSurface,
  ): void {
    if (this.activeBursts >= MAX_BURSTS) {
      // Drop oldest burst by force-releasing a batch of oldest active particles.
      this.forceCullOneBurst();
    }

    const nLen = Math.hypot(nx, ny, nz) || 1;
    const nnx = nx / nLen;
    const nny = ny / nLen;
    const nnz = nz / nLen;

    // Ground: heavier dust; wall/prop: heavier sparks.
    const isGround = surface === "ground";
    const sparkCount = isGround
      ? 6 + Math.floor(Math.random() * 3)
      : 8 + Math.floor(Math.random() * 7); // 8–14
    const dustCount = isGround
      ? 6 + Math.floor(Math.random() * 5) // 6–10
      : 4 + Math.floor(Math.random() * 4); // 4–7

    let spawned = 0;
    for (let i = 0; i < sparkCount; i++) {
      const p = this.acquireParticle();
      if (!p) break;
      this.initSpark(p, x, y, z, nnx, nny, nnz);
      spawned++;
    }
    for (let i = 0; i < dustCount; i++) {
      const p = this.acquireParticle();
      if (!p) break;
      this.initDust(p, x, y, z, nnx, nny, nnz, isGround);
      spawned++;
    }

    if (spawned > 0) this.activeBursts++;
  }

  update(dt: number): void {
    let anyExpiredBurstHint = false;
    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        this.releaseParticle(p);
        anyExpiredBurstHint = true;
        continue;
      }

      if (p.kind === "dust") {
        p.vy += GRAVITY * dt;
      } else {
        p.vy += GRAVITY * 0.35 * dt;
      }

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      // Soft ground clamp for dust
      if (p.kind === "dust" && p.mesh.position.y < 0.02) {
        p.mesh.position.y = 0.02;
        p.vy *= -0.15;
        p.vx *= 0.85;
        p.vz *= 0.85;
      }

      const t = p.age / p.life;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      if (p.kind === "spark") {
        mat.opacity = 1 - t * t;
        p.mesh.scale.setScalar(1 - t * 0.6);
      } else {
        mat.opacity = 0.75 * (1 - t);
        p.mesh.scale.setScalar(0.8 + t * 1.4);
      }
    }

    if (anyExpiredBurstHint) {
      this.recountBursts();
    }
  }

  dispose(): void {
    for (const p of this.particles) {
      this.root.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles.length = 0;
    this.free.length = 0;
    this.geo.dispose();
    this.sparkMat.dispose();
    this.dustMat.dispose();
    this.scene.remove(this.root);
  }

  private initSpark(
    p: Particle,
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
  ): void {
    p.kind = "spark";
    p.age = 0;
    p.life = 0.15 + Math.random() * 0.2; // 150–350 ms
    p.active = true;

    const cone = randomCone(nx, ny, nz, 0.55);
    const speed = 2.5 + Math.random() * 4.5;
    p.vx = cone.x * speed;
    p.vy = cone.y * speed + 0.5;
    p.vz = cone.z * speed;

    const mat = p.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)]);
    mat.blending = THREE.AdditiveBlending;
    mat.opacity = 1;
    mat.toneMapped = false;

    p.mesh.position.set(x, y, z);
    p.mesh.scale.setScalar(0.7 + Math.random() * 0.6);
    p.mesh.visible = true;
  }

  private initDust(
    p: Particle,
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    isGround: boolean,
  ): void {
    p.kind = "dust";
    p.age = 0;
    p.life = 0.3 + Math.random() * 0.3; // 300–600 ms
    p.active = true;

    const cone = randomCone(nx, ny, nz, 0.85);
    const speed = (isGround ? 0.8 : 1.2) + Math.random() * 1.6;
    p.vx = cone.x * speed + (Math.random() - 0.5) * 0.4;
    p.vy = Math.max(0.2, cone.y * speed) + Math.random() * 0.8;
    p.vz = cone.z * speed + (Math.random() - 0.5) * 0.4;

    const mat = p.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)]);
    mat.blending = THREE.NormalBlending;
    mat.opacity = 0.75;
    mat.toneMapped = true;

    p.mesh.position.set(
      x + (Math.random() - 0.5) * 0.05,
      y + (Math.random() - 0.5) * 0.05,
      z + (Math.random() - 0.5) * 0.05,
    );
    p.mesh.scale.setScalar(1.1 + Math.random() * 0.9);
    p.mesh.visible = true;
  }

  private acquireParticle(): Particle | null {
    const p = this.free.pop();
    if (p) return p;
    // Steal oldest active
    let oldest: Particle | null = null;
    for (const q of this.particles) {
      if (!q.active) continue;
      if (!oldest || q.age > oldest.age) oldest = q;
    }
    if (!oldest) return null;
    this.releaseParticle(oldest);
    return this.free.pop() ?? null;
  }

  private releaseParticle(p: Particle): void {
    if (!p.active) return;
    p.active = false;
    p.mesh.visible = false;
    this.free.push(p);
  }

  private forceCullOneBurst(): void {
    // Release up to PARTICLES_PER_BURST oldest actives to free a burst slot.
    const actives = this.particles
      .filter((p) => p.active)
      .sort((a, b) => b.age - a.age);
    const n = Math.min(PARTICLES_PER_BURST, actives.length);
    for (let i = 0; i < n; i++) this.releaseParticle(actives[i]);
    this.activeBursts = Math.max(0, this.activeBursts - 1);
  }

  private recountBursts(): void {
    // Approximate: one burst ≈ particles that were co-spawned; keep under cap.
    const activeCount = this.particles.reduce((n, p) => n + (p.active ? 1 : 0), 0);
    // Average ~12 particles/burst → estimate
    this.activeBursts = Math.min(
      MAX_BURSTS,
      Math.ceil(activeCount / 12),
    );
  }
}

/** Unit vector in a cone around normal (spread in radians scale 0–1). */
function randomCone(
  nx: number,
  ny: number,
  nz: number,
  spread: number,
): THREE.Vector3 {
  // Build orthonormal basis
  const n = new THREE.Vector3(nx, ny, nz).normalize();
  const tmp =
    Math.abs(n.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
  const t = new THREE.Vector3().crossVectors(n, tmp).normalize();
  const b = new THREE.Vector3().crossVectors(n, t);

  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * spread;
  const out = new THREE.Vector3()
    .copy(n)
    .addScaledVector(t, Math.cos(angle) * r)
    .addScaledVector(b, Math.sin(angle) * r)
    .normalize();
  return out;
}
