import * as THREE from "three";

/** Max concurrent HE projectiles + explosion particle budget. Spec §2.4. */
const MAX_PROJECTILES = 8;
const MAX_PARTICLES = 96;
const MAX_DEBRIS = 16;
const PARTICLES_PER_EXPLOSION = 24;
const DEBRIS_PER_EXPLOSION = 12;
const PARTICLE_LIFE = 0.55;
const DEBRIS_LIFE = 0.85;
const GRAVITY = -6;
const DEBRIS_GRAVITY = -14;

const EXPLODE_COLORS = [0xff6622, 0xffaa33, 0xffee66, 0xff4411, 0xcc3300];

interface ProjectileSlot {
  mesh: THREE.Mesh;
  active: boolean;
}

interface ParticleSlot {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  active: boolean;
}

interface DebrisSlot {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinZ: number;
  age: number;
  life: number;
  active: boolean;
}

/**
 * Olive HE sphere in flight + warm explosion burst on detonate.
 * `spawn(x,y,z)` places/updates a projectile; `spawn(..., true)` explodes.
 */
export class HESystem {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly projectiles: ProjectileSlot[] = [];
  private readonly particles: ParticleSlot[] = [];
  private readonly debris: DebrisSlot[] = [];
  private readonly projGeo: THREE.BufferGeometry;
  private readonly partGeo: THREE.BufferGeometry;
  private readonly debrisGeo: THREE.BufferGeometry;
  private readonly projMat: THREE.MeshStandardMaterial;
  private readonly partMat: THREE.MeshBasicMaterial;
  private readonly debrisMat: THREE.MeshBasicMaterial;
  private projCursor = 0;
  private freeParticles: ParticleSlot[] = [];
  private freeDebris: DebrisSlot[] = [];
  /** Quality tier: low = flash only, medium/high = debris. */
  private debrisCount = DEBRIS_PER_EXPLOSION;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root.name = "HESystem";
    this.scene.add(this.root);

    this.projGeo = new THREE.SphereGeometry(0.16, 10, 10);
    this.projMat = new THREE.MeshStandardMaterial({
      color: 0x4a5c28,
      roughness: 0.55,
      metalness: 0.25,
      emissive: 0x1a2208,
    });

    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const mesh = new THREE.Mesh(this.projGeo, this.projMat.clone());
      mesh.visible = false;
      mesh.castShadow = true;
      this.root.add(mesh);
      this.projectiles.push({ mesh, active: false });
    }

    this.partGeo = new THREE.SphereGeometry(0.07, 5, 5);
    this.partMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mesh = new THREE.Mesh(this.partGeo, this.partMat.clone());
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      const slot: ParticleSlot = {
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        life: 0,
        active: false,
      };
      this.particles.push(slot);
      this.freeParticles.push(slot);
    }

    // Crate-like debris cubes (RUSH-B explosion read) — no shadows
    this.debrisGeo = new THREE.BoxGeometry(0.18, 0.12, 0.16);
    this.debrisMat = new THREE.MeshBasicMaterial({
      color: 0x8b6914,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    });
    for (let i = 0; i < MAX_DEBRIS; i++) {
      const mesh = new THREE.Mesh(this.debrisGeo, this.debrisMat.clone());
      mesh.visible = false;
      mesh.castShadow = false;
      this.root.add(mesh);
      const slot: DebrisSlot = {
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        spinX: 0,
        spinZ: 0,
        age: 0,
        life: 0,
        active: false,
      };
      this.debris.push(slot);
      this.freeDebris.push(slot);
    }
  }

  /** 0 = flash particles only; higher = more flying crate chunks. */
  setDebrisBudget(count: number): void {
    this.debrisCount = Math.max(0, Math.min(MAX_DEBRIS, Math.floor(count)));
  }

  /**
   * Show HE projectile at world pos, or explode (hide nearest projectile + burst).
   * Optional `id` indexes a projectile slot (0..MAX-1) for multi-grenade.
   */
  spawn(
    x: number,
    y: number,
    z: number,
    explode = false,
    id = 0,
  ): void {
    if (explode) {
      this.explodeAt(x, y, z, id);
      return;
    }
    const idx = ((id % MAX_PROJECTILES) + MAX_PROJECTILES) % MAX_PROJECTILES;
    const slot = this.projectiles[idx];
    slot.active = true;
    slot.mesh.visible = true;
    slot.mesh.position.set(x, y, z);
    this.projCursor = (idx + 1) % MAX_PROJECTILES;
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        this.releaseParticle(p);
        continue;
      }
      p.vy += GRAVITY * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.04) {
        p.mesh.position.y = 0.04;
        p.vy *= -0.25;
        p.vx *= 0.8;
        p.vz *= 0.8;
      }
      const t = p.age / p.life;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 1 - t * t;
      p.mesh.scale.setScalar(1.2 + t * 1.8);
    }

    for (const d of this.debris) {
      if (!d.active) continue;
      d.age += dt;
      if (d.age >= d.life) {
        this.releaseDebris(d);
        continue;
      }
      d.vy += DEBRIS_GRAVITY * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.mesh.rotation.x += d.spinX * dt;
      d.mesh.rotation.z += d.spinZ * dt;
      if (d.mesh.position.y < 0.06) {
        d.mesh.position.y = 0.06;
        d.vy *= -0.2;
        d.vx *= 0.65;
        d.vz *= 0.65;
      }
      const t = d.age / d.life;
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t * t;
    }
  }

  dispose(): void {
    for (const s of this.projectiles) {
      this.root.remove(s.mesh);
      (s.mesh.material as THREE.Material).dispose();
    }
    for (const p of this.particles) {
      this.root.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    for (const d of this.debris) {
      this.root.remove(d.mesh);
      (d.mesh.material as THREE.Material).dispose();
    }
    this.projectiles.length = 0;
    this.particles.length = 0;
    this.debris.length = 0;
    this.freeParticles.length = 0;
    this.freeDebris.length = 0;
    this.projGeo.dispose();
    this.partGeo.dispose();
    this.debrisGeo.dispose();
    this.projMat.dispose();
    this.partMat.dispose();
    this.debrisMat.dispose();
    this.scene.remove(this.root);
  }

  private explodeAt(x: number, y: number, z: number, id: number): void {
    const idx = ((id % MAX_PROJECTILES) + MAX_PROJECTILES) % MAX_PROJECTILES;
    const slot = this.projectiles[idx];
    if (slot.active) {
      slot.active = false;
      slot.mesh.visible = false;
    }
    // Also hide any projectile very near the blast (id mismatch safety)
    for (const s of this.projectiles) {
      if (!s.active) continue;
      const d = Math.hypot(
        s.mesh.position.x - x,
        s.mesh.position.y - y,
        s.mesh.position.z - z,
      );
      if (d < 0.6) {
        s.active = false;
        s.mesh.visible = false;
      }
    }

    for (let i = 0; i < PARTICLES_PER_EXPLOSION; i++) {
      const p = this.acquireParticle();
      if (!p) break;
      p.active = true;
      p.age = 0;
      p.life = PARTICLE_LIFE * (0.7 + Math.random() * 0.5);
      const ang = Math.random() * Math.PI * 2;
      const elev = Math.random() * Math.PI * 0.55;
      const speed = 2.5 + Math.random() * 5.5;
      p.vx = Math.cos(ang) * Math.cos(elev) * speed;
      p.vy = Math.sin(elev) * speed + 1.2;
      p.vz = Math.sin(ang) * Math.cos(elev) * speed;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(
        EXPLODE_COLORS[Math.floor(Math.random() * EXPLODE_COLORS.length)],
      );
      mat.opacity = 1;
      p.mesh.position.set(
        x + (Math.random() - 0.5) * 0.15,
        y + (Math.random() - 0.5) * 0.15,
        z + (Math.random() - 0.5) * 0.15,
      );
      p.mesh.scale.setScalar(0.8 + Math.random() * 0.8);
      p.mesh.visible = true;
    }

    // Flying crate chunks (visual only)
    const nDebris = this.debrisCount;
    for (let i = 0; i < nDebris; i++) {
      const d = this.acquireDebris();
      if (!d) break;
      d.active = true;
      d.age = 0;
      d.life = DEBRIS_LIFE * (0.75 + Math.random() * 0.4);
      const ang = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      d.vx = Math.cos(ang) * speed;
      d.vy = 3.5 + Math.random() * 4;
      d.vz = Math.sin(ang) * speed;
      d.spinX = (Math.random() - 0.5) * 12;
      d.spinZ = (Math.random() - 0.5) * 12;
      const mat = d.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(
        [0x8b6914, 0x7a5c12, 0x6e4f10, 0x5a4820][
          Math.floor(Math.random() * 4)
        ]!,
      );
      mat.opacity = 1;
      d.mesh.position.set(
        x + (Math.random() - 0.5) * 0.4,
        y + 0.3 + Math.random() * 0.4,
        z + (Math.random() - 0.5) * 0.4,
      );
      d.mesh.scale.setScalar(0.7 + Math.random() * 0.9);
      d.mesh.rotation.set(Math.random(), Math.random(), Math.random());
      d.mesh.visible = true;
    }
  }

  private acquireDebris(): DebrisSlot | null {
    const d = this.freeDebris.pop();
    if (d) return d;
    let oldest: DebrisSlot | null = null;
    for (const q of this.debris) {
      if (!q.active) continue;
      if (!oldest || q.age > oldest.age) oldest = q;
    }
    if (!oldest) return null;
    this.releaseDebris(oldest);
    return this.freeDebris.pop() ?? null;
  }

  private releaseDebris(d: DebrisSlot): void {
    if (!d.active) return;
    d.active = false;
    d.mesh.visible = false;
    this.freeDebris.push(d);
  }

  private acquireParticle(): ParticleSlot | null {
    const p = this.freeParticles.pop();
    if (p) return p;
    let oldest: ParticleSlot | null = null;
    for (const q of this.particles) {
      if (!q.active) continue;
      if (!oldest || q.age > oldest.age) oldest = q;
    }
    if (!oldest) return null;
    this.releaseParticle(oldest);
    return this.freeParticles.pop() ?? null;
  }

  private releaseParticle(p: ParticleSlot): void {
    if (!p.active) return;
    p.active = false;
    p.mesh.visible = false;
    this.freeParticles.push(p);
  }
}
