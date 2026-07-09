import * as THREE from "three";

/** Weapon socket on the right hand — attach meshes here. */
export const WEAPON_SLOT_NAME = "weaponSlot";

export type CharacterBones = {
  root: THREE.Group;
  hips: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  torso: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  handR: THREE.Object3D;
  weaponSlot: THREE.Object3D;
  head: THREE.Object3D;
  helmet: THREE.Object3D;
};

function boxMesh(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  castShadow = true,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = castShadow;
  m.receiveShadow = false;
  return m;
}

/**
 * Low-poly hierarchical character rig.
 *
 * ```
 * root
 *   hips
 *     legL, legR
 *   torso
 *     armL, armR
 *       handR → weaponSlot
 *     head
 *       helmet
 * ```
 *
 * Bone pivots sit at joints so rot.x swings limbs naturally.
 */
export class CharacterRig {
  readonly group: THREE.Group;
  readonly bones: CharacterBones;
  readonly teamColor: number;

  constructor(teamColor: number) {
    this.teamColor = teamColor;
    this.group = new THREE.Group();
    this.group.name = "character";

    const bodyMat = new THREE.MeshStandardMaterial({
      color: teamColor,
      roughness: 0.5,
      metalness: 0.15,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.65,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd4a574,
      roughness: 0.7,
    });
    const gearMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.55,
      metalness: 0.2,
    });

    // --- hips (pelvis pivot) ---
    const hips = new THREE.Object3D();
    hips.name = "hips";
    hips.position.y = 0.55;
    this.group.add(hips);

    const pelvis = boxMesh(0.38, 0.18, 0.24, darkMat);
    pelvis.position.y = 0.02;
    hips.add(pelvis);

    // legs: pivot at hip joint; mesh hangs downward
    const legL = new THREE.Object3D();
    legL.name = "legL";
    legL.position.set(-0.12, 0, 0);
    hips.add(legL);
    const legLMesh = boxMesh(0.16, 0.52, 0.18, darkMat);
    legLMesh.position.y = -0.26;
    legL.add(legLMesh);
    const bootL = boxMesh(0.18, 0.1, 0.26, gearMat);
    bootL.position.set(0, -0.52, 0.04);
    legL.add(bootL);

    const legR = new THREE.Object3D();
    legR.name = "legR";
    legR.position.set(0.12, 0, 0);
    hips.add(legR);
    const legRMesh = boxMesh(0.16, 0.52, 0.18, darkMat);
    legRMesh.position.y = -0.26;
    legR.add(legRMesh);
    const bootR = boxMesh(0.18, 0.1, 0.26, gearMat);
    bootR.position.set(0, -0.52, 0.04);
    legR.add(bootR);

    // --- torso (spine pivot at hips) ---
    const torso = new THREE.Object3D();
    torso.name = "torso";
    torso.position.y = 0.1;
    hips.add(torso);

    const chest = boxMesh(0.48, 0.55, 0.28, bodyMat);
    chest.position.y = 0.32;
    torso.add(chest);

    // Vest on +Z = chest / “front” of the soldier (must match yawFromDirection).
    const vest = boxMesh(0.42, 0.36, 0.14, gearMat);
    vest.position.set(0, 0.34, 0.12);
    torso.add(vest);

    // arms: pivot at shoulder
    const armL = new THREE.Object3D();
    armL.name = "armL";
    armL.position.set(-0.3, 0.5, 0);
    torso.add(armL);
    const armLMesh = boxMesh(0.14, 0.48, 0.14, bodyMat);
    armLMesh.position.y = -0.24;
    armL.add(armLMesh);

    const armR = new THREE.Object3D();
    armR.name = "armR";
    armR.position.set(0.3, 0.5, 0);
    torso.add(armR);
    const armRMesh = boxMesh(0.14, 0.48, 0.14, bodyMat);
    armRMesh.position.y = -0.24;
    armR.add(armRMesh);

    // right hand + weapon slot at end of arm
    const handR = new THREE.Object3D();
    handR.name = "handR";
    handR.position.set(0, -0.48, 0.02);
    armR.add(handR);
    const handMesh = boxMesh(0.12, 0.1, 0.12, skinMat);
    handMesh.position.y = -0.04;
    handR.add(handMesh);

    const weaponSlot = new THREE.Object3D();
    weaponSlot.name = WEAPON_SLOT_NAME;
    // Character faces **+Z** (vest on +Z). Barrel meshes also along +Z.
    // Slight forward offset so muzzle sits in front of the hand.
    weaponSlot.position.set(0.02, -0.02, 0.08);
    handR.add(weaponSlot);

    // head
    const head = new THREE.Object3D();
    head.name = "head";
    head.position.y = 0.62;
    torso.add(head);
    const headMesh = boxMesh(0.28, 0.28, 0.28, skinMat);
    headMesh.position.y = 0.14;
    head.add(headMesh);

    const helmet = new THREE.Object3D();
    helmet.name = "helmet";
    helmet.position.y = 0.28;
    head.add(helmet);
    const helmetMesh = boxMesh(0.32, 0.12, 0.34, bodyMat);
    helmetMesh.position.y = 0.04;
    helmet.add(helmetMesh);

    // ground marker (selection ring)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.58, 28),
      new THREE.MeshBasicMaterial({
        color: teamColor,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.name = "teamRing";
    this.group.add(ring);

    this.bones = {
      root: this.group,
      hips,
      legL,
      legR,
      torso,
      armL,
      armR,
      handR,
      weaponSlot,
      head,
      helmet,
    };
  }

  /** Rest pose rotations (arms slightly ready). */
  applyRestPose(): void {
    const { legL, legR, armL, armR, torso, hips, head } = this.bones;
    hips.position.y = 0.55;
    hips.rotation.set(0, 0, 0);
    torso.position.y = 0.1;
    torso.rotation.set(0, 0, 0);
    legL.rotation.set(0, 0, 0);
    legR.rotation.set(0, 0, 0);
    // slight ready angle for arms
    armL.rotation.set(0.35, 0, 0.15);
    armR.rotation.set(0.55, 0, -0.1);
    head.rotation.set(0, 0, 0);
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
  }
}
