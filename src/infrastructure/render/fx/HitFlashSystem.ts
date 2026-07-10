import * as THREE from "three";

/** White hitflash on hit enemy mesh — ≤80ms (gunfeel pack B). */
const FLASH_LIFE = 0.08;
const MAX_ACTIVE = 12;

interface FlashEntry {
  group: THREE.Object3D;
  age: number;
  life: number;
  meshes: THREE.Mesh[];
  originals: Array<{ color: number; emissive: number; emissiveIntensity: number }>;
  active: boolean;
}

/**
 * Brief white flash on a character group when hit.
 * Mutates mesh materials in place and restores after ≤80ms.
 * Max concurrent flashes capped; newest overwrites oldest if full.
 */
export class HitFlashSystem {
  private readonly entries: FlashEntry[] = [];

  /**
   * Flash all MeshBasic / MeshStandard materials under `group`.
   * Safe to call every hit; re-flashing an active target restarts the timer.
   */
  flash(group: THREE.Object3D | null | undefined): void {
    if (!group) return;

    // Restart if already flashing this group
    for (const e of this.entries) {
      if (e.active && e.group === group) {
        this.applyWhite(e);
        e.age = 0;
        e.life = FLASH_LIFE;
        return;
      }
    }

    let entry = this.entries.find((e) => !e.active);
    if (!entry) {
      if (this.entries.length >= MAX_ACTIVE) {
        entry = this.entries[0]!;
        this.restore(entry);
      } else {
        entry = {
          group,
          age: 0,
          life: FLASH_LIFE,
          meshes: [],
          originals: [],
          active: false,
        };
        this.entries.push(entry);
      }
    }

    entry.group = group;
    entry.meshes = [];
    entry.originals = [];
    group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mat = o.material;
      if (!mat || Array.isArray(mat)) return;
      const m = mat as THREE.MeshStandardMaterial & {
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      };
      if (!m.color) return;
      entry!.meshes.push(o);
      entry!.originals.push({
        color: m.color.getHex(),
        emissive: m.emissive ? m.emissive.getHex() : 0,
        emissiveIntensity:
          typeof m.emissiveIntensity === "number" ? m.emissiveIntensity : 0,
      });
    });

    if (entry.meshes.length === 0) return;
    this.applyWhite(entry);
    entry.age = 0;
    entry.life = FLASH_LIFE;
    entry.active = true;
  }

  update(dt: number): void {
    for (const e of this.entries) {
      if (!e.active) continue;
      e.age += dt;
      if (e.age >= e.life) {
        this.restore(e);
      }
    }
  }

  dispose(): void {
    for (const e of this.entries) {
      if (e.active) this.restore(e);
    }
    this.entries.length = 0;
  }

  private applyWhite(e: FlashEntry): void {
    for (const mesh of e.meshes) {
      const m = mesh.material as THREE.MeshStandardMaterial & {
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      };
      if (m.color) m.color.setHex(0xffffff);
      if (m.emissive) {
        m.emissive.setHex(0xffffff);
        m.emissiveIntensity = 0.85;
      }
    }
  }

  private restore(e: FlashEntry): void {
    for (let i = 0; i < e.meshes.length; i++) {
      const mesh = e.meshes[i]!;
      const orig = e.originals[i];
      if (!orig) continue;
      const m = mesh.material as THREE.MeshStandardMaterial & {
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      };
      if (m.color) m.color.setHex(orig.color);
      if (m.emissive) {
        m.emissive.setHex(orig.emissive);
        m.emissiveIntensity = orig.emissiveIntensity;
      }
    }
    e.active = false;
    e.meshes = [];
    e.originals = [];
  }
}
