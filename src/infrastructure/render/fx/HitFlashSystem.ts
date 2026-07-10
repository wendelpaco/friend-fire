import * as THREE from "three";

/** White hitflash on hit enemy mesh — ≤80ms (gunfeel pack B). */
const FLASH_LIFE = 0.08;
const MAX_ACTIVE = 12;
const FLASH_WHITE = 0xffffff;
const FLASH_EMISSIVE_INTENSITY = 0.85;

interface FlashOriginal {
  /** Base color only when we mutated it (MeshBasic / no emissive). */
  color: number | null;
  emissive: number | null;
  emissiveIntensity: number | null;
}

interface FlashEntry {
  group: THREE.Object3D;
  age: number;
  life: number;
  meshes: THREE.Mesh[];
  originals: FlashOriginal[];
  active: boolean;
}

type FlashMat = THREE.MeshStandardMaterial & {
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
};

/**
 * Brief white flash on a character group when hit.
 * Prefers emissive overlay so skin/operator recolors of base color are not
 * clobbered on restore. Max concurrent flashes capped; newest overwrites oldest.
 */
export class HitFlashSystem {
  private readonly entries: FlashEntry[] = [];

  /**
   * Flash all MeshBasic / MeshStandard materials under `group`.
   * Safe to call every hit; re-flashing an active target restarts the timer
   * and re-snapshots any materials that were externally recolored mid-flash.
   */
  flash(group: THREE.Object3D | null | undefined): void {
    if (!group) return;

    // Restart if already flashing this group
    for (const e of this.entries) {
      if (e.active && e.group === group) {
        this.resyncOriginalsIfExternallyChanged(e);
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
      const m = mat as FlashMat;
      if (!m.color) return;
      entry!.meshes.push(o);
      entry!.originals.push(this.snapshot(m));
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

  private snapshot(m: FlashMat): FlashOriginal {
    const hasEmissive = Boolean(m.emissive);
    return {
      // Prefer emissive-only flash when available — leave base color alone.
      color: hasEmissive ? null : m.color ? m.color.getHex() : null,
      emissive: hasEmissive && m.emissive ? m.emissive.getHex() : null,
      emissiveIntensity:
        hasEmissive && typeof m.emissiveIntensity === "number"
          ? m.emissiveIntensity
          : null,
    };
  }

  /**
   * If operator/skin patch recolored a mesh while flashing, capture the new
   * values so restore does not write pre-patch hex.
   */
  private resyncOriginalsIfExternallyChanged(e: FlashEntry): void {
    for (let i = 0; i < e.meshes.length; i++) {
      const mesh = e.meshes[i]!;
      const orig = e.originals[i];
      if (!orig) continue;
      const m = mesh.material as FlashMat;
      if (!m.color) continue;

      if (orig.color != null && m.color.getHex() !== FLASH_WHITE) {
        orig.color = m.color.getHex();
      }
      if (
        orig.emissive != null &&
        m.emissive &&
        m.emissive.getHex() !== FLASH_WHITE
      ) {
        orig.emissive = m.emissive.getHex();
        if (typeof m.emissiveIntensity === "number") {
          orig.emissiveIntensity = m.emissiveIntensity;
        }
      }
    }
  }

  private applyWhite(e: FlashEntry): void {
    for (let i = 0; i < e.meshes.length; i++) {
      const mesh = e.meshes[i]!;
      const orig = e.originals[i];
      if (!orig) continue;
      const m = mesh.material as FlashMat;
      // Emissive path (MeshStandard): keep albedo, boost glow
      if (orig.emissive != null && m.emissive) {
        m.emissive.setHex(FLASH_WHITE);
        m.emissiveIntensity = FLASH_EMISSIVE_INTENSITY;
        continue;
      }
      // MeshBasic / no emissive: temporary white albedo
      if (orig.color != null && m.color) {
        m.color.setHex(FLASH_WHITE);
      }
    }
  }

  private restore(e: FlashEntry): void {
    for (let i = 0; i < e.meshes.length; i++) {
      const mesh = e.meshes[i]!;
      const orig = e.originals[i];
      if (!orig) continue;
      const m = mesh.material as FlashMat;

      // Only restore channels we still own (still at flash white). If skin
      // recolor overwrote mid-flash, leave the external value alone.
      if (
        orig.color != null &&
        m.color &&
        m.color.getHex() === FLASH_WHITE
      ) {
        m.color.setHex(orig.color);
      }
      if (orig.emissive != null && m.emissive) {
        const stillFlash =
          m.emissive.getHex() === FLASH_WHITE &&
          (typeof m.emissiveIntensity !== "number" ||
            Math.abs(m.emissiveIntensity - FLASH_EMISSIVE_INTENSITY) < 1e-3);
        if (stillFlash) {
          m.emissive.setHex(orig.emissive);
          if (orig.emissiveIntensity != null) {
            m.emissiveIntensity = orig.emissiveIntensity;
          }
        }
      }
    }
    e.active = false;
    e.meshes = [];
    e.originals = [];
  }
}
