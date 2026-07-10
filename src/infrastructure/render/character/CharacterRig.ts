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
 * Low-poly **tactical** soldier — RUSH-B style read at isometric distance:
 * dark fatigues, team-color vest/helmet stripe, helmet mass, backpack, clear gun.
 * Vest on +Z = chest / front (must match yawFromDirection).
 */
export class CharacterRig {
  readonly group: THREE.Group;
  readonly bones: CharacterBones;
  readonly teamColor: number;

  constructor(teamColor: number) {
    this.teamColor = teamColor;
    this.group = new THREE.Group();
    this.group.name = "character";

    // Fatigues: dark olive (not full-body team paint — team is accents only)
    const fatigues = new THREE.MeshStandardMaterial({
      color: 0x3a4230,
      roughness: 0.82,
      metalness: 0.05,
    });
    const pants = new THREE.MeshStandardMaterial({
      color: 0x2c3228,
      roughness: 0.85,
    });
    const teamMat = new THREE.MeshStandardMaterial({
      color: teamColor,
      roughness: 0.45,
      metalness: 0.2,
    });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x2a3020,
      roughness: 0.55,
      metalness: 0.15,
    });
    const gearMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c18,
      roughness: 0.6,
      metalness: 0.25,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xc4a07a,
      roughness: 0.75,
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x1a1510,
      roughness: 0.9,
    });

    // --- hips ---
    const hips = new THREE.Object3D();
    hips.name = "hips";
    hips.position.y = 0.52;
    this.group.add(hips);

    const pelvis = boxMesh(0.42, 0.18, 0.26, pants);
    pelvis.position.y = 0.02;
    hips.add(pelvis);

    // legs
    const legL = new THREE.Object3D();
    legL.name = "legL";
    legL.position.set(-0.13, 0, 0);
    hips.add(legL);
    const legLMesh = boxMesh(0.17, 0.5, 0.19, pants);
    legLMesh.position.y = -0.25;
    legL.add(legLMesh);
    const bootL = boxMesh(0.19, 0.12, 0.28, bootMat);
    bootL.position.set(0, -0.52, 0.04);
    legL.add(bootL);

    const legR = new THREE.Object3D();
    legR.name = "legR";
    legR.position.set(0.13, 0, 0);
    hips.add(legR);
    const legRMesh = boxMesh(0.17, 0.5, 0.19, pants);
    legRMesh.position.y = -0.25;
    legR.add(legRMesh);
    const bootR = boxMesh(0.19, 0.12, 0.28, bootMat);
    bootR.position.set(0, -0.52, 0.04);
    legR.add(bootR);

    // --- torso ---
    const torso = new THREE.Object3D();
    torso.name = "torso";
    torso.position.y = 0.1;
    hips.add(torso);

    // Uniform torso (olive)
    const chest = boxMesh(0.52, 0.52, 0.3, fatigues);
    chest.position.y = 0.32;
    torso.add(chest);

    // Team plate carrier on chest (+Z front)
    const vest = boxMesh(0.46, 0.36, 0.14, teamMat);
    vest.position.set(0, 0.34, 0.14);
    torso.add(vest);
    // Pouches
    const pouchL = boxMesh(0.12, 0.1, 0.08, gearMat);
    pouchL.position.set(-0.14, 0.28, 0.22);
    torso.add(pouchL);
    const pouchR = boxMesh(0.12, 0.1, 0.08, gearMat);
    pouchR.position.set(0.14, 0.28, 0.22);
    torso.add(pouchR);

    // Pack
    const pack = boxMesh(0.34, 0.36, 0.16, gearMat);
    pack.position.set(0, 0.34, -0.18);
    torso.add(pack);

    // Shoulders / pads with team accent
    const padL = boxMesh(0.14, 0.1, 0.2, teamMat);
    padL.position.set(-0.32, 0.54, 0);
    torso.add(padL);
    const padR = boxMesh(0.14, 0.1, 0.2, teamMat);
    padR.position.set(0.32, 0.54, 0);
    torso.add(padR);

    // arms (fatigues)
    const armL = new THREE.Object3D();
    armL.name = "armL";
    armL.position.set(-0.34, 0.5, 0);
    torso.add(armL);
    const armLMesh = boxMesh(0.14, 0.48, 0.14, fatigues);
    armLMesh.position.y = -0.24;
    armL.add(armLMesh);

    const armR = new THREE.Object3D();
    armR.name = "armR";
    armR.position.set(0.34, 0.5, 0);
    torso.add(armR);
    const armRMesh = boxMesh(0.14, 0.48, 0.14, fatigues);
    armRMesh.position.y = -0.24;
    armR.add(armRMesh);

    const handR = new THREE.Object3D();
    handR.name = "handR";
    handR.position.set(0, -0.48, 0.02);
    armR.add(handR);
    const handMesh = boxMesh(0.11, 0.09, 0.11, skinMat);
    handMesh.position.y = -0.04;
    handR.add(handMesh);

    const weaponSlot = new THREE.Object3D();
    weaponSlot.name = WEAPON_SLOT_NAME;
    weaponSlot.position.set(0.02, -0.02, 0.12);
    handR.add(weaponSlot);

    // head + combat helmet
    const head = new THREE.Object3D();
    head.name = "head";
    head.position.y = 0.62;
    torso.add(head);
    const headMesh = boxMesh(0.26, 0.26, 0.26, skinMat);
    headMesh.position.y = 0.13;
    head.add(headMesh);

    const helmet = new THREE.Object3D();
    helmet.name = "helmet";
    helmet.position.y = 0.28;
    head.add(helmet);
    // Dome
    const helmetMesh = boxMesh(0.36, 0.18, 0.38, helmetMat);
    helmetMesh.position.y = 0.06;
    helmet.add(helmetMesh);
    // Team stripe on helmet
    const stripe = boxMesh(0.38, 0.06, 0.12, teamMat);
    stripe.position.set(0, 0.1, 0.14);
    helmet.add(stripe);
    // Goggles / visor
    const visor = boxMesh(0.3, 0.07, 0.1, gearMat);
    visor.position.set(0, 0.0, 0.18);
    helmet.add(visor);

    // Team ground ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.55, 28),
      new THREE.MeshBasicMaterial({
        color: teamColor,
        transparent: true,
        opacity: 0.7,
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

  applyRestPose(): void {
    const { legL, legR, armL, armR, torso, hips, head } = this.bones;
    hips.position.y = 0.52;
    hips.rotation.set(0, 0, 0);
    torso.position.y = 0.1;
    torso.rotation.set(0, 0, 0);
    legL.rotation.set(0, 0, 0);
    legR.rotation.set(0, 0, 0);
    armL.rotation.set(0.35, 0, 0.12);
    armR.rotation.set(0.55, 0, -0.08);
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
