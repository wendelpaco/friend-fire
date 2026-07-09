import * as THREE from "three";
import { CAMERA_HEIGHT, CAMERA_OFFSET } from "@/game/constants";
import type { BulletState, PlayerState } from "@/game/types";
import { buildBillboardMesh, buildWallPoster } from "@/game/world/billboards";
import type { GameMap } from "@/domains/world";

/** Minimal fields required to keep meshes in sync with simulation. */
export interface RenderSnapshot {
  players: ReadonlyArray<
    Pick<
      PlayerState,
      "id" | "name" | "team" | "isBot" | "x" | "z" | "rot" | "alive" | "color"
    >
  >;
  bullets: ReadonlyArray<Pick<BulletState, "id" | "x" | "z">>;
  localPlayerId: string;
}

export class ThreeRenderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private map: GameMap;
  private playerMeshes = new Map<string, THREE.Group>();
  private bulletMeshes = new Map<string, THREE.Mesh>();
  private wallGroup = new THREE.Group();
  private propGroup = new THREE.Group();
  private adGroup = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmpVec = new THREE.Vector3();
  private tmpNdc = new THREE.Vector2();
  private muzzleFlashes: Array<{ mesh: THREE.Mesh; until: number }> = [];
  private playerSpot!: THREE.SpotLight;
  private dustParticles!: THREE.Points;

  constructor(canvas: HTMLCanvasElement, map: GameMap) {
    this.map = map;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 200);
    this.camera.position.set(0, CAMERA_HEIGHT, CAMERA_OFFSET);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(map.skyColor, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.fog = new THREE.Fog(map.fogColor, 32, 68);
    this.scene.background = new THREE.Color(map.skyColor);

    this.buildWorld();
  }

  /** Project screen coords onto the ground plane (Y=0). */
  pickGround(mx: number, my: number): { x: number; z: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.tmpNdc.x = ((mx - rect.left) / rect.width) * 2 - 1;
    this.tmpNdc.y = -((my - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.tmpNdc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(
      this.groundPlane,
      this.tmpVec,
    );
    if (!hit) return null;
    return { x: hit.x, z: hit.z };
  }

  spawnMuzzleFlash(x: number, z: number, rot: number, until: number) {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffee88 }),
    );
    flash.position.set(
      x + Math.sin(rot) * 0.9,
      0.95,
      z + Math.cos(rot) * 0.9,
    );
    this.scene.add(flash);
    this.muzzleFlashes.push({ mesh: flash, until });
  }

  animateDust(dt: number) {
    const pos = this.dustParticles.geometry.attributes
      .position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * 0.15;
      if (y > 5) y = 0.3;
      pos.setY(i, y);
      pos.setX(
        i,
        pos.getX(i) + Math.sin(performance.now() * 0.0005 + i) * dt * 0.2,
      );
    }
    pos.needsUpdate = true;
  }

  sync(snapshot: RenderSnapshot) {
    const aliveBulletIds = new Set<string>();

    for (const p of snapshot.players) {
      let mesh = this.playerMeshes.get(p.id);
      if (!mesh) {
        mesh = this.createPlayerMesh(p);
        this.playerMeshes.set(p.id, mesh);
        this.scene.add(mesh);
      }
      mesh.visible = p.alive;
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = p.rot;
    }

    for (const b of snapshot.bullets) {
      aliveBulletIds.add(b.id);
      let mesh = this.bulletMeshes.get(b.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffee66 }),
        );
        this.bulletMeshes.set(b.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(b.x, 0.95, b.z);
    }

    for (const id of [...this.bulletMeshes.keys()]) {
      if (!aliveBulletIds.has(id)) this.removeBulletMesh(id);
    }

    this.updateMuzzleFlashes();
    this.updateCamera(snapshot);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    this.renderer.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else (mat as THREE.Material).dispose();
      }
    });
  }

  // ─── private setup ───────────────────────────────────────

  private buildWorld() {
    const hemi = new THREE.HemisphereLight(0xc8e0ff, 0x8b6914, 0.55);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xfff0dd, 0.35);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffe6b5, 1.35);
    sun.position.set(22, 32, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -42;
    sun.shadow.camera.right = 42;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -42;
    sun.shadow.bias = -0.00025;
    this.scene.add(sun);

    const groundTex = this.makeGroundTexture();
    const groundGeo = new THREE.PlaneGeometry(
      this.map.size.width,
      this.map.size.depth,
      1,
      1,
    );
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.92,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(24.2, 32, 48),
      new THREE.MeshStandardMaterial({
        color: 0x6b8f4e,
        roughness: 1,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.02;
    this.scene.add(ring);

    for (const w of this.map.walls) {
      const h = w.h ?? 2.5;
      const color = w.color ?? 0xb89a6e;
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.88,
        metalness: 0.04,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, h, w.d), mat);
      mesh.position.set(w.x, h / 2, w.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.wallGroup.add(mesh);

      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(w.w + 0.12, 0.12, w.d + 0.12),
        new THREE.MeshStandardMaterial({
          color: 0x9a7d55,
          roughness: 0.75,
        }),
      );
      cap.position.set(w.x, h + 0.05, w.z);
      cap.castShadow = true;
      this.wallGroup.add(cap);
    }
    this.scene.add(this.wallGroup);

    for (const p of this.map.props) {
      this.propGroup.add(this.createProp(p));
    }
    this.scene.add(this.propGroup);

    for (const slot of this.map.billboards) {
      this.adGroup.add(buildBillboardMesh(slot));
    }
    for (const poster of this.map.wallPosters) {
      this.adGroup.add(
        buildWallPoster(
          poster.x,
          poster.y,
          poster.z,
          poster.rotY,
          poster.w,
          poster.h,
          poster.adId,
        ),
      );
    }
    this.scene.add(this.adGroup);

    for (const site of this.map.bombSites) {
      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(site.radius * 0.65, site.radius, 40),
        new THREE.MeshBasicMaterial({
          color: 0xffcc00,
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
        }),
      );
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(site.x, 0.06, site.z);
      this.scene.add(ringMesh);

      const label = this.makeSpriteText(site.id, "#ffcc00", 96);
      label.position.set(site.x, 2.4, site.z);
      label.scale.set(1.6, 1.6, 1);
      this.scene.add(label);
    }

    this.playerSpot = new THREE.SpotLight(
      0xfff2d0,
      1.15,
      26,
      Math.PI / 3.1,
      0.55,
      1.1,
    );
    this.playerSpot.position.set(0, 12, 0);
    this.playerSpot.castShadow = false;
    this.scene.add(this.playerSpot);
    this.scene.add(this.playerSpot.target);

    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 46;
      positions[i * 3 + 1] = 0.4 + Math.random() * 4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 46;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.dustParticles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: 0xffe8c0,
        size: 0.08,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.scene.add(this.dustParticles);
  }

  private makeGroundTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#c4a574";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const s = 2 + Math.random() * 6;
      ctx.fillStyle = `rgba(${140 + Math.random() * 40},${110 + Math.random() * 30},${70 + Math.random() * 20},${0.08 + Math.random() * 0.12})`;
      ctx.fillRect(x, y, s, s);
    }
    ctx.strokeStyle = "rgba(120,90,50,0.15)";
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.moveTo(40, 40);
    ctx.lineTo(470, 470);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(470, 40);
    ctx.lineTo(40, 470);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  private createProp(p: GameMap["props"][number]): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(p.x, 0, p.z);
    const kind = p.kind ?? "crate";

    if (kind === "barrel") {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(p.w * 0.45, p.w * 0.48, p.h, 12),
        new THREE.MeshStandardMaterial({
          color: p.color,
          roughness: 0.55,
          metalness: 0.35,
        }),
      );
      body.position.y = p.h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(p.w * 0.42, 0.04, 6, 16),
        new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6 }),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = p.h * 0.85;
      group.add(rim);
    } else if (kind === "car") {
      const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, p.h * 0.55, p.d),
        new THREE.MeshStandardMaterial({
          color: p.color,
          roughness: 0.45,
          metalness: 0.4,
        }),
      );
      chassis.position.y = p.h * 0.35;
      chassis.castShadow = true;
      group.add(chassis);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(p.w * 0.55, p.h * 0.45, p.d * 0.9),
        new THREE.MeshStandardMaterial({
          color: 0x1a202c,
          roughness: 0.3,
          metalness: 0.2,
          transparent: true,
          opacity: 0.85,
        }),
      );
      cabin.position.set(-p.w * 0.05, p.h * 0.72, 0);
      cabin.castShadow = true;
      group.add(cabin);
      for (const [ox, oz] of [
        [-p.w * 0.3, p.d * 0.55],
        [p.w * 0.3, p.d * 0.55],
        [-p.w * 0.3, -p.d * 0.55],
        [p.w * 0.3, -p.d * 0.55],
      ] as const) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.28, 0.22, 10),
          new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }),
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(ox, 0.28, oz);
        group.add(wheel);
      }
    } else if (kind === "dumpster") {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, p.h, p.d),
        new THREE.MeshStandardMaterial({
          color: p.color,
          roughness: 0.7,
          metalness: 0.25,
        }),
      );
      body.position.y = p.h / 2;
      body.castShadow = true;
      group.add(body);
    } else {
      const mat = new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: 0.8,
      });
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, p.h, p.d),
        mat,
      );
      box.position.y = p.h / 2;
      box.castShadow = true;
      box.receiveShadow = true;
      group.add(box);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w, p.h, p.d)),
        new THREE.LineBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.25,
        }),
      );
      edges.position.y = p.h / 2;
      group.add(edges);
    }

    return group;
  }

  private makeSpriteText(
    text: string,
    color: string,
    size = 128,
  ): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);
    ctx.font = `bold ${Math.floor(size * 0.55)}px system-ui, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.lineWidth = 6;
    ctx.strokeText(text, size / 2, size / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, size / 2, size / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    return new THREE.Sprite(mat);
  }

  private createPlayerMesh(
    p: Pick<
      PlayerState,
      "id" | "name" | "team" | "isBot" | "x" | "z" | "rot" | "color"
    >,
  ): THREE.Group {
    const g = new THREE.Group();
    g.name = p.id;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: p.color,
      roughness: 0.55,
      metalness: 0.12,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.7,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xe0b090,
      roughness: 0.75,
    });

    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 0.4),
      darkMat,
    );
    legs.position.y = 0.35;
    legs.castShadow = true;
    g.add(legs);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.75, 0.48),
      bodyMat,
    );
    body.position.y = 0.95;
    body.castShadow = true;
    g.add(body);

    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.45, 0.2),
      new THREE.MeshStandardMaterial({
        color: p.team === "TR" ? 0x5c3a1e : 0x1e3a5c,
        roughness: 0.5,
        metalness: 0.2,
      }),
    );
    vest.position.set(0, 1.0, 0.18);
    g.add(vest);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.38, 0.38),
      skinMat,
    );
    head.position.y = 1.52;
    head.castShadow = true;
    g.add(head);

    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.18, 0.46),
      bodyMat,
    );
    helmet.position.y = 1.75;
    g.add(helmet);

    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.75),
      new THREE.MeshStandardMaterial({
        color: 0x222222,
        metalness: 0.5,
        roughness: 0.4,
      }),
    );
    gun.position.set(0.38, 0.95, -0.4);
    gun.name = "gun";
    g.add(gun);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.68, 28),
      new THREE.MeshBasicMaterial({
        color: p.color,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    g.add(ring);

    const label = this.makeSpriteText(
      p.isBot ? p.name.replace("BOT ", "") : p.name,
      "#ffffff",
      256,
    );
    label.position.y = 2.25;
    label.scale.set(2.2, 0.7, 1);
    label.name = "label";
    g.add(label);

    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.rot;
    return g;
  }

  private removeBulletMesh(id: string) {
    const mesh = this.bulletMeshes.get(id);
    if (!mesh) return;
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    this.bulletMeshes.delete(id);
  }

  private updateMuzzleFlashes() {
    const now = performance.now();
    this.muzzleFlashes = this.muzzleFlashes.filter((f) => {
      if (now >= f.until) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        (f.mesh.material as THREE.Material).dispose();
        return false;
      }
      return true;
    });
  }

  private updateCamera(snapshot: RenderSnapshot) {
    const p = snapshot.players.find((x) => x.id === snapshot.localPlayerId);
    if (!p) return;

    this.camera.position.x += (p.x - this.camera.position.x) * 0.12;
    this.camera.position.z +=
      (p.z + CAMERA_OFFSET - this.camera.position.z) * 0.12;
    this.camera.position.y = CAMERA_HEIGHT;
    this.camera.lookAt(p.x, 0.5, p.z);

    this.playerSpot.position.set(p.x, 12, p.z);
    this.playerSpot.target.position.set(p.x, 0, p.z);
    this.playerSpot.target.updateMatrixWorld();
  }
}
