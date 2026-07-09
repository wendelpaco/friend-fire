import { DEFAULT_RUN_THRESHOLD } from "@/domains/fx";
import type { CharacterBones } from "./CharacterRig";
import type { WeaponCategory } from "./WeaponAttach";

export type LocomotionState = "idle" | "run";

export type AnimatorInput = {
  /** Horizontal speed (world units / second). */
  speed: number;
  /** True on the frame(s) a shot is fired — triggers recoil overlay. */
  shooting?: boolean;
  weaponCategory?: WeaponCategory;
};

const IDLE_SPEED = DEFAULT_RUN_THRESHOLD;
const RUN_AMP = 0.55;
const ARM_AMP = 0.4;
const IDLE_BOB = 0.012;
const RUN_BOB = 0.035;
/** Shoot recoil duration (seconds). Spec: 80–120 ms. */
const RECOIL_MS = 0.1;
const RECOIL_ARM = 0.55;
const RECOIL_TORSO = 0.12;

/**
 * Procedural idle / run / shoot overlay for {@link CharacterBones}.
 * Sin-wave locomotion; no keyframes.
 */
export class CharacterAnimator {
  private readonly bones: CharacterBones;
  private phase = 0;
  private recoilT = 0;
  private state: LocomotionState = "idle";

  constructor(bones: CharacterBones) {
    this.bones = bones;
  }

  get locomotion(): LocomotionState {
    return this.state;
  }

  /**
   * @param dt seconds
   */
  update(dt: number, input: AnimatorInput): void {
    const speed = Math.max(0, input.speed);
    this.state = speed < IDLE_SPEED ? "idle" : "run";

    if (input.shooting) {
      this.recoilT = RECOIL_MS;
    }
    if (this.recoilT > 0) {
      this.recoilT = Math.max(0, this.recoilT - dt);
    }

    const { legL, legR, armL, armR, torso, hips, head } = this.bones;
    const knife = input.weaponCategory === "knife";

    // phase advances faster when running
    const cadence = this.state === "run" ? 8 + Math.min(speed, 8) * 0.6 : 2.2;
    this.phase += dt * cadence;

    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);

    if (this.state === "idle") {
      // micro bob on torso / hips Y
      const bob = Math.sin(this.phase) * IDLE_BOB;
      hips.position.y = 0.55 + bob;
      torso.rotation.x = 0.02;
      torso.rotation.z = Math.sin(this.phase * 0.5) * 0.02;

      legL.rotation.x = 0.02;
      legR.rotation.x = -0.02;

      // arms ready (gun) or slightly open (knife)
      const readyR = knife ? 0.25 : 0.55;
      const readyL = knife ? 0.25 : 0.4;
      armL.rotation.set(readyL + s * 0.03, 0, 0.12);
      armR.rotation.set(readyR + c * 0.03, 0, -0.08);
      head.rotation.x = -0.02;
    } else {
      // run cycle
      const amp = RUN_AMP * Math.min(1, speed / 4);
      hips.position.y = 0.55 + Math.abs(s) * RUN_BOB;
      torso.rotation.x = 0.08;
      torso.rotation.z = c * 0.04;

      legL.rotation.x = s * amp;
      legR.rotation.x = -s * amp;

      // arms opposite phase to legs
      const aAmp = ARM_AMP * Math.min(1, speed / 4);
      const baseR = knife ? 0.35 : 0.5;
      const baseL = knife ? 0.35 : 0.35;
      armL.rotation.set(baseL + -s * aAmp, 0, 0.1);
      armR.rotation.set(baseR + s * aAmp * 0.6, 0, -0.08);
      head.rotation.x = 0.05;
    }

    // shoot recoil overlay — kick arm/torso opposite aim (−Z)
    if (this.recoilT > 0 && !knife) {
      const k = this.recoilT / RECOIL_MS; // 1 → 0
      const kick = Math.sin(k * Math.PI); // smooth pulse
      armR.rotation.x -= RECOIL_ARM * kick;
      torso.rotation.x -= RECOIL_TORSO * kick;
    } else if (this.recoilT > 0 && knife) {
      const k = this.recoilT / RECOIL_MS;
      const kick = Math.sin(k * Math.PI);
      armR.rotation.x -= 0.7 * kick;
      armR.rotation.z -= 0.25 * kick;
    }
  }

  /** Force rest pose (e.g. when pooling). */
  reset(): void {
    this.phase = 0;
    this.recoilT = 0;
    this.state = "idle";
    const { legL, legR, armL, armR, torso, hips, head } = this.bones;
    hips.position.y = 0.55;
    hips.rotation.set(0, 0, 0);
    torso.position.y = 0.1;
    torso.rotation.set(0, 0, 0);
    legL.rotation.set(0, 0, 0);
    legR.rotation.set(0, 0, 0);
    armL.rotation.set(0.35, 0, 0.15);
    armR.rotation.set(0.55, 0, -0.1);
    head.rotation.set(0, 0, 0);
  }
}
