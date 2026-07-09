import type { LocomotionWeights } from "@/domains/fx";
import type { CharacterBones } from "./CharacterRig";
import type { WeaponCategory } from "./WeaponAttach";

export type LocomotionState =
  | "idle"
  | "forward"
  | "backward"
  | "strafeLeft"
  | "strafeRight"
  | "run";

export type AnimatorInput = {
  /** Horizontal speed (world units / second). */
  speed: number;
  /**
   * Directional blend from {@link CharacterController}.
   * When omitted, falls back to idle/run from speed only.
   */
  weights?: LocomotionWeights;
  /** Upper-body Y twist toward aim (radians). */
  torsoTwist?: number;
  /** Hold crouch (CTRL) — lowers hips / bends legs. */
  crouching?: boolean;
  /** Airborne (jump) — tuck pose, less walk amp. */
  airborne?: boolean;
  /** True on the frame(s) a shot is fired — triggers recoil overlay. */
  shooting?: boolean;
  weaponCategory?: WeaponCategory;
};

const RUN_AMP = 0.55;
const ARM_AMP = 0.4;
const IDLE_BOB = 0.012;
const RUN_BOB = 0.035;
/** Shoot recoil duration (seconds). Spec: 80–120 ms. */
const RECOIL_MS = 0.1;
const RECOIL_ARM = 0.55;
const RECOIL_TORSO = 0.12;

const ZERO_WEIGHTS: LocomotionWeights = {
  idle: 1,
  forward: 0,
  backward: 0,
  strafeLeft: 0,
  strafeRight: 0,
};

/**
 * Procedural locomotion with **directional blending**:
 * idle · walk forward · walk backward · strafe left · strafe right.
 *
 * No AnimationMixer / GLTF clips — sin-wave poses weighted by
 * `locomotionWeights()` so diagonals mix cleanly.
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
    const w = input.weights ?? fallbackWeights(speed);

    if (input.shooting) {
      this.recoilT = RECOIL_MS;
    }
    if (this.recoilT > 0) {
      this.recoilT = Math.max(0, this.recoilT - dt);
    }

    this.state = dominantState(w);

    const moving = 1 - w.idle;
    const cadence = moving > 0.01 ? 8 + Math.min(speed, 8) * 0.6 : 2.2;
    this.phase += dt * cadence;

    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);

    const { legL, legR, armL, armR, torso, hips, head } = this.bones;
    const knife = input.weaponCategory === "knife";

    // ── Idle baseline ──────────────────────────────────────────
    const idleBob = Math.sin(this.phase) * IDLE_BOB;
    let hipsY = 0.55 + idleBob * w.idle;
    let torsoX = 0.02 * w.idle;
    let torsoZ = Math.sin(this.phase * 0.5) * 0.02 * w.idle;
    let legLX = 0.02 * w.idle;
    let legRX = -0.02 * w.idle;
    let legLZ = 0;
    let legRZ = 0;

    const readyR = knife ? 0.25 : 0.55;
    const readyL = knife ? 0.25 : 0.4;
    let armLX = readyL + s * 0.03 * w.idle;
    let armRX = readyR + c * 0.03 * w.idle;
    let armLZ = 0.12 * w.idle;
    let armRZ = -0.08 * w.idle;
    let headX = -0.02 * w.idle;

    // Amp scales with overall move energy
    const amp = RUN_AMP * Math.min(1, speed / 4 || moving);
    const aAmp = ARM_AMP * Math.min(1, speed / 4 || moving);
    const bob = Math.abs(s) * RUN_BOB;

    // ── Forward walk ───────────────────────────────────────────
    if (w.forward > 0.001) {
      const k = w.forward;
      hipsY += bob * k;
      torsoX += 0.08 * k;
      torsoZ += c * 0.04 * k;
      legLX += s * amp * k;
      legRX += -s * amp * k;
      armLX = armLX * (1 - k) + (0.35 + -s * aAmp) * k;
      armRX = armRX * (1 - k) + ((knife ? 0.35 : 0.5) + s * aAmp * 0.6) * k;
      armLZ = armLZ * (1 - k) + 0.1 * k;
      armRZ = armRZ * (1 - k) + -0.08 * k;
      headX += 0.05 * k;
    }

    // ── Backward walk (phase inverted feel) ────────────────────
    if (w.backward > 0.001) {
      const k = w.backward;
      hipsY += bob * 0.85 * k;
      torsoX += -0.06 * k; // lean back slightly
      torsoZ += c * 0.03 * k;
      // legs reverse phase vs forward
      legLX += -s * amp * 0.9 * k;
      legRX += s * amp * 0.9 * k;
      armLX = armLX * (1 - k) + (0.4 + s * aAmp * 0.5) * k;
      armRX = armRX * (1 - k) + (0.45 + -s * aAmp * 0.4) * k;
      headX += 0.08 * k;
    }

    // ── Strafe right ───────────────────────────────────────────
    if (w.strafeRight > 0.001) {
      const k = w.strafeRight;
      hipsY += bob * 0.9 * k;
      torsoZ += 0.1 * k; // lean into strafe
      // scissor legs on Z (sideways)
      legLZ += s * amp * 0.7 * k;
      legRZ += -s * amp * 0.7 * k;
      legLX += Math.abs(s) * 0.15 * k;
      legRX += Math.abs(c) * 0.15 * k;
      armLX = armLX * (1 - k) + (0.4 + c * 0.15) * k;
      armRX = armRX * (1 - k) + (0.5 + -c * 0.12) * k;
      armLZ += 0.2 * k;
      armRZ += -0.15 * k;
    }

    // ── Strafe left ────────────────────────────────────────────
    if (w.strafeLeft > 0.001) {
      const k = w.strafeLeft;
      hipsY += bob * 0.9 * k;
      torsoZ += -0.1 * k;
      legLZ += -s * amp * 0.7 * k;
      legRZ += s * amp * 0.7 * k;
      legLX += Math.abs(c) * 0.15 * k;
      legRX += Math.abs(s) * 0.15 * k;
      armLX = armLX * (1 - k) + (0.4 + -c * 0.15) * k;
      armRX = armRX * (1 - k) + (0.5 + c * 0.12) * k;
      armLZ += -0.15 * k;
      armRZ += 0.2 * k;
    }

    // ── Crouch overlay (hold CTRL) ─────────────────────────────
    // Lower hips, fold legs, slight torso tuck — works with walk blend.
    if (input.crouching) {
      hipsY -= 0.28;
      torsoX += 0.22;
      legLX += 0.85;
      legRX += 0.85;
      armLX += 0.15;
      armRX += 0.2;
      headX += 0.12;
      // damp walk amp visually while crouched
      legLZ *= 0.55;
      legRZ *= 0.55;
    }

    // ── Jump / airborne overlay ─────────────────────────────────
    if (input.airborne) {
      hipsY += 0.06;
      torsoX -= 0.12;
      // tuck legs slightly (doesn't fight crouch badly)
      legLX = legLX * 0.4 + 0.55;
      legRX = legRX * 0.4 + 0.55;
      armLX -= 0.25;
      armRX -= 0.2;
    }

    hips.position.y = hipsY;
    hips.rotation.set(0, 0, 0);
    torso.rotation.x = torsoX;
    torso.rotation.z = torsoZ;
    // Aim twist on torso Y (hips stay on body yaw from controller)
    torso.rotation.y = input.torsoTwist ?? 0;

    legL.rotation.set(legLX, 0, legLZ);
    legR.rotation.set(legRX, 0, legRZ);
    armL.rotation.set(armLX, 0, armLZ);
    armR.rotation.set(armRX, 0, armRZ);
    head.rotation.x = headX;
    head.rotation.y = 0;
    head.rotation.z = 0;

    // shoot recoil overlay — kick arm/torso opposite aim
    if (this.recoilT > 0 && !knife) {
      const k = this.recoilT / RECOIL_MS;
      const kick = Math.sin(k * Math.PI);
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

function fallbackWeights(speed: number): LocomotionWeights {
  if (speed < 0.3) return { ...ZERO_WEIGHTS };
  return {
    idle: 0,
    forward: 1,
    backward: 0,
    strafeLeft: 0,
    strafeRight: 0,
  };
}

function dominantState(w: LocomotionWeights): LocomotionState {
  if (w.idle >= 0.5) return "idle";
  let best: LocomotionState = "forward";
  let bestV = w.forward;
  if (w.backward > bestV) {
    best = "backward";
    bestV = w.backward;
  }
  if (w.strafeLeft > bestV) {
    best = "strafeLeft";
    bestV = w.strafeLeft;
  }
  if (w.strafeRight > bestV) {
    best = "strafeRight";
  }
  return best;
}
