import * as THREE from "three";
import {
  applyDamage as applyDamageToVitals,
  beginReload,
  completeReload,
  isDead,
  WEAPONS,
} from "@/domains/combat";
import {
  BOT_LINES,
  BOT_NAMES,
  BOT_SPEED,
  BULLET_RADIUS,
  CAMERA_HEIGHT,
  CAMERA_OFFSET,
  KILL_REWARD,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  ROUND_LOSS_REWARD,
  ROUND_TIME,
  ROUND_WIN_REWARD,
  START_MONEY,
  TEAM_COLORS,
  WARMUP_TIME,
} from "../constants";
import type {
  BulletState,
  ChatEntry,
  HudSnapshot,
  KillFeedEntry,
  MatchState,
  PlayerState,
  Team,
  WeaponId,
} from "../types";
import { buildBillboardMesh, buildWallPoster } from "../world/billboards";
import {
  MAP_DUST,
  mapCollisionWalls,
  resolveCircleWalls,
  type GameMap,
} from "../world/maps";
import { Input } from "./Input";

let idCounter = 0;
function uid(prefix: string) {
  idCounter += 1;
  return `${prefix}_${idCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export class GameEngine {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly input = new Input();
  readonly map: GameMap = MAP_DUST;

  private state: MatchState;
  private playerMeshes = new Map<string, THREE.Group>();
  private bulletMeshes = new Map<string, THREE.Mesh>();
  private wallGroup = new THREE.Group();
  private propGroup = new THREE.Group();
  private adGroup = new THREE.Group();
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private onHud?: (hud: HudSnapshot) => void;
  private botTimers = new Map<
    string,
    { nextShot: number; nextChat: number }
  >();
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmpVec = new THREE.Vector3();
  private tmpNdc = new THREE.Vector2();
  private muzzleFlashes: Array<{ mesh: THREE.Mesh; until: number }> = [];
  private playerSpot!: THREE.SpotLight;
  private collisionWalls = mapCollisionWalls(MAP_DUST);
  private dustParticles!: THREE.Points;
  private helpSeenKey = "ff_help_seen";

  constructor(canvas: HTMLCanvasElement) {
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
    this.renderer.setClearColor(this.map.skyColor, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.fog = new THREE.Fog(this.map.fogColor, 32, 68);
    this.scene.background = new THREE.Color(this.map.skyColor);

    this.state = this.createInitialState();
    this.buildWorld();
    this.spawnAllMeshes();
    this.input.bind();
  }

  setHudListener(fn: (hud: HudSnapshot) => void) {
    this.onHud = fn;
  }

  setPaused(paused: boolean) {
    this.state.paused = paused;
    if (!paused) this.clock.getDelta();
  }

  togglePause() {
    this.setPaused(!this.state.paused);
  }

  dismissHelp() {
    this.state.showHelp = false;
    try {
      localStorage.setItem(this.helpSeenKey, "1");
    } catch {
      /* ignore */
    }
  }

  openHelp() {
    this.state.showHelp = true;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(dt);
      this.render();
    };
    loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    this.input.unbind();
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

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  // ─── setup ───────────────────────────────────────────────

  private createInitialState(): MatchState {
    const localId = "local_player";
    let showHelp = true;
    try {
      showHelp = localStorage.getItem(this.helpSeenKey) !== "1";
    } catch {
      showHelp = true;
    }

    const players: PlayerState[] = [
      this.makePlayer(localId, "Você", "TR", false, 0),
      this.makePlayer(uid("bot"), BOT_NAMES[0], "TR", true, 1),
      this.makePlayer(uid("bot"), BOT_NAMES[1], "TR", true, 2),
      this.makePlayer(uid("bot"), BOT_NAMES[2], "CT", true, 0),
      this.makePlayer(uid("bot"), BOT_NAMES[3], "CT", true, 1),
      this.makePlayer(uid("bot"), BOT_NAMES[4], "CT", true, 2),
    ];

    return {
      phase: "warmup",
      round: 0,
      timeLeft: WARMUP_TIME,
      scoreTR: 0,
      scoreCT: 0,
      players,
      bullets: [],
      killFeed: [],
      chat: [
        {
          id: uid("chat"),
          from: "SYSTEM",
          text: "AQUECIMENTO — treine mira e movimento. Nada conta.",
          kind: "system",
          at: performance.now(),
        },
      ],
      localPlayerId: localId,
      paused: false,
      showScoreboard: false,
      showHelp,
      hitMarkerUntil: 0,
      damageFlashUntil: 0,
      lastDamageAmount: 0,
    };
  }

  private makePlayer(
    id: string,
    name: string,
    team: Team,
    isBot: boolean,
    spawnIndex: number,
  ): PlayerState {
    const spawns = this.map.spawns.filter((s) => s.team === team);
    const spawn = spawns[spawnIndex % spawns.length]!;
    const primary: WeaponId = team === "TR" ? "ak47" : "usp";
    const secondary: WeaponId = team === "TR" ? "glock" : "deagle";

    const weapons: PlayerState["weapons"] = {
      1: primary,
      2: secondary,
      4: "knife",
    };

    const ammo: PlayerState["ammo"] = {};
    for (const wid of Object.values(weapons)) {
      if (!wid) continue;
      const def = WEAPONS[wid];
      ammo[wid] = { mag: def.magazine, reserve: def.reserve };
    }

    return {
      id,
      name,
      team,
      isBot,
      x: spawn.x + (Math.random() - 0.5) * 1.5,
      z: spawn.z + (Math.random() - 0.5) * 1.5,
      rot: team === "TR" ? Math.PI / 4 : (-3 * Math.PI) / 4,
      hp: 100,
      armor: team === "CT" ? 50 : 0,
      money: START_MONEY,
      weaponSlot: 2,
      weapons,
      ammo,
      alive: true,
      kills: 0,
      deaths: 0,
      assists: 0,
      lastShotAt: 0,
      reloadingUntil: 0,
      color: TEAM_COLORS[team],
    };
  }

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

    // ground with subtle checker variation via canvas texture
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

    // outer dirt ring
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

    // walls with top cap
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

      // coping
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

    // props
    for (const p of this.map.props) {
      this.propGroup.add(this.createProp(p));
    }
    this.scene.add(this.propGroup);

    // ads
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

    // bomb sites
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

    // local light following player
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

    // ambient dust motes
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
    // path dirt
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
      // stacked crate look
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
      // edge lines
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w, p.h, p.d)),
        new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }),
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

  private createPlayerMesh(p: PlayerState): THREE.Group {
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

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.4), darkMat);
    legs.position.y = 0.35;
    legs.castShadow = true;
    g.add(legs);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.75, 0.48), bodyMat);
    body.position.y = 0.95;
    body.castShadow = true;
    g.add(body);

    // vest plate
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

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skinMat);
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
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.4 }),
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

  private spawnAllMeshes() {
    for (const p of this.state.players) {
      const mesh = this.createPlayerMesh(p);
      this.playerMeshes.set(p.id, mesh);
      this.scene.add(mesh);
      if (p.isBot) {
        this.botTimers.set(p.id, {
          nextShot: 0,
          nextChat: performance.now() + 3000 + Math.random() * 5000,
        });
      }
    }
  }

  // ─── update ──────────────────────────────────────────────

  private update(dt: number) {
    // UI toggles always work
    if (this.input.wasPressed("Escape")) {
      this.togglePause();
    }
    if (this.input.wasPressed("KeyH")) {
      if (this.state.showHelp) this.dismissHelp();
      else this.state.showHelp = true;
    }
    this.state.showScoreboard = this.input.isDown("Tab");

    if (this.state.paused || this.state.showHelp) {
      this.pushHud();
      this.input.endFrame();
      return;
    }

    this.updateAim();
    this.updateTimer(dt);
    this.updateLocalPlayer(dt);
    this.updateBots(dt);
    this.updateBullets(dt);
    this.updateMuzzleFlashes();
    this.animateDust(dt);
    this.syncMeshes();
    this.updateCamera();
    this.pushHud();
    this.input.endFrame();
  }

  private animateDust(dt: number) {
    const pos = this.dustParticles.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * 0.15;
      if (y > 5) y = 0.3;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(performance.now() * 0.0005 + i) * dt * 0.2);
    }
    pos.needsUpdate = true;
  }

  private updateAim() {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.tmpNdc.x = ((this.input.mouseX - rect.left) / rect.width) * 2 - 1;
    this.tmpNdc.y = -((this.input.mouseY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.tmpNdc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.tmpVec);
    if (hit) {
      this.input.aimWorldX = hit.x;
      this.input.aimWorldZ = hit.z;
    }
  }

  private updateTimer(dt: number) {
    this.state.timeLeft -= dt;
    if (this.state.timeLeft > 0) return;

    if (this.state.phase === "warmup") {
      this.startLiveRound();
    } else if (this.state.phase === "live") {
      this.endRound("CT");
    } else if (this.state.phase === "ended") {
      this.startLiveRound();
    }
  }

  private startLiveRound() {
    this.state.phase = "live";
    this.state.round += 1;
    this.state.timeLeft = ROUND_TIME;
    this.state.bullets = [];
    this.clearBulletMeshes();
    this.addChat("SYSTEM", `ROUND ${this.state.round} — boa sorte`, "system");
    for (const p of this.state.players) this.respawnPlayer(p);
  }

  private endRound(winner: Team) {
    this.state.phase = "ended";
    this.state.timeLeft = 5;
    if (winner === "TR") this.state.scoreTR += 1;
    else this.state.scoreCT += 1;
    this.addChat("SYSTEM", `${winner} venceu o round!`, "system");
    for (const p of this.state.players) {
      p.money += p.team === winner ? ROUND_WIN_REWARD : ROUND_LOSS_REWARD;
    }
  }

  private respawnPlayer(p: PlayerState) {
    const spawns = this.map.spawns.filter((s) => s.team === p.team);
    const spawn = spawns[Math.floor(Math.random() * spawns.length)]!;
    p.x = spawn.x + (Math.random() - 0.5);
    p.z = spawn.z + (Math.random() - 0.5);
    p.hp = 100;
    p.alive = true;
    p.reloadingUntil = 0;
    p.rot = p.team === "TR" ? Math.PI / 4 : (-3 * Math.PI) / 4;
    for (const [wid, ammo] of Object.entries(p.ammo)) {
      if (!ammo) continue;
      p.ammo[wid as WeaponId] = completeReload(ammo, wid as WeaponId);
    }
  }

  private updateLocalPlayer(dt: number) {
    const p = this.state.players.find((x) => x.id === this.state.localPlayerId);
    if (!p) return;

    // finish reload
    if (p.reloadingUntil > 0 && performance.now() >= p.reloadingUntil) {
      this.finishReload(p);
    }

    if (!p.alive) {
      if (this.state.phase === "warmup" && this.input.wasPressed("KeyF")) {
        this.respawnPlayer(p);
      }
      return;
    }

    const move = this.input.moveVector();
    if (move.x !== 0 || move.z !== 0) {
      const nx = p.x + move.x * PLAYER_SPEED * dt;
      const nz = p.z + move.z * PLAYER_SPEED * dt;
      const resolved = resolveCircleWalls(
        nx,
        nz,
        PLAYER_RADIUS,
        this.collisionWalls,
      );
      p.x = resolved.x;
      p.z = resolved.z;
    }

    const dx = this.input.aimWorldX - p.x;
    const dz = this.input.aimWorldZ - p.z;
    if (dx !== 0 || dz !== 0) p.rot = Math.atan2(dx, dz);

    const slot = this.input.weaponSlotKey();
    if (slot && p.weapons[slot]) {
      p.weaponSlot = slot;
      p.reloadingUntil = 0;
    }

    if (this.input.wasPressed("KeyR")) {
      this.startReload(p);
    }

    if (this.input.isMouseDown(0) && p.reloadingUntil <= 0) {
      this.tryShoot(p);
    }
  }

  private startReload(p: PlayerState) {
    if (!p.alive || p.reloadingUntil > 0) return;
    const wid = p.weapons[p.weaponSlot];
    if (!wid) return;
    const ammo = p.ammo[wid];
    if (!ammo) return;
    const until = beginReload(ammo, wid, performance.now());
    if (until !== null) p.reloadingUntil = until;
  }

  private finishReload(p: PlayerState) {
    p.reloadingUntil = 0;
    const wid = p.weapons[p.weaponSlot];
    if (!wid) return;
    const ammo = p.ammo[wid];
    if (!ammo) return;
    p.ammo[wid] = completeReload(ammo, wid);
  }

  private updateBots(dt: number) {
    const now = performance.now();
    for (const bot of this.state.players) {
      if (!bot.isBot || !bot.alive) continue;
      if (bot.reloadingUntil > 0 && now >= bot.reloadingUntil) {
        this.finishReload(bot);
      }

      const timer = this.botTimers.get(bot.id) ?? {
        nextShot: 0,
        nextChat: now + 5000,
      };

      const enemies = this.state.players.filter(
        (p) => p.alive && p.team !== bot.team,
      );
      let target: PlayerState | undefined;
      let best = Infinity;
      for (const e of enemies) {
        const d = (e.x - bot.x) ** 2 + (e.z - bot.z) ** 2;
        if (d < best) {
          best = d;
          target = e;
        }
      }

      if (target) {
        const dx = target.x - bot.x;
        const dz = target.z - bot.z;
        const dist = Math.hypot(dx, dz);
        bot.rot = Math.atan2(dx, dz);

        let mx = 0;
        let mz = 0;
        if (dist > 9) {
          mx = (dx / dist) * BOT_SPEED * dt;
          mz = (dz / dist) * BOT_SPEED * dt;
        } else if (dist < 4.5) {
          mx = (-dx / dist) * BOT_SPEED * 0.55 * dt;
          mz = (-dz / dist) * BOT_SPEED * 0.55 * dt;
        } else {
          mx = (-dz / dist) * BOT_SPEED * 0.65 * dt;
          mz = (dx / dist) * BOT_SPEED * 0.65 * dt;
        }
        const resolved = resolveCircleWalls(
          bot.x + mx,
          bot.z + mz,
          PLAYER_RADIUS,
          this.collisionWalls,
        );
        bot.x = resolved.x;
        bot.z = resolved.z;

        const wid = bot.weapons[bot.weaponSlot];
        const ammo = wid ? bot.ammo[wid] : null;
        if (ammo && ammo.mag === 0 && ammo.reserve > 0) {
          this.startReload(bot);
        }

        if (
          dist < 22 &&
          now >= timer.nextShot &&
          bot.reloadingUntil <= 0
        ) {
          this.tryShoot(bot);
          const def = wid ? WEAPONS[wid] : WEAPONS.glock;
          timer.nextShot = now + def.fireRate + Math.random() * 140;
        }

        if (now >= timer.nextChat) {
          if (dist < 12 && Math.random() < 0.5) {
            this.addChat(bot.name, pick(BOT_LINES.enemySpotted), "radio");
          } else if (Math.random() < 0.3) {
            this.addChat(bot.name, pick(BOT_LINES.taunt), "all");
          }
          timer.nextChat = now + 7000 + Math.random() * 9000;
        }
      }

      this.botTimers.set(bot.id, timer);
    }
  }

  private tryShoot(p: PlayerState) {
    const wid = p.weapons[p.weaponSlot];
    if (!wid) return;
    const def = WEAPONS[wid];
    const now = performance.now();
    if (now - p.lastShotAt < def.fireRate) return;

    if (def.isMelee) {
      p.lastShotAt = now;
      this.meleeAttack(p, def.damage, def.range);
      return;
    }

    const ammo = p.ammo[wid];
    if (!ammo || ammo.mag <= 0) {
      if (ammo && ammo.reserve > 0) this.startReload(p);
      else if (p.weapons[2] && (p.ammo[p.weapons[2]]?.mag ?? 0) > 0) {
        p.weaponSlot = 2;
      } else {
        p.weaponSlot = 4;
      }
      return;
    }

    ammo.mag -= 1;
    p.lastShotAt = now;

    const spread = (Math.random() - 0.5) * def.spread;
    const angle = p.rot + spread;
    const bullet: BulletState = {
      id: uid("b"),
      ownerId: p.id,
      team: p.team,
      x: p.x + Math.sin(p.rot) * 0.75,
      z: p.z + Math.cos(p.rot) * 0.75,
      vx: Math.sin(angle) * def.speed,
      vz: Math.cos(angle) * def.speed,
      damage: def.damage,
      rangeLeft: def.range,
      bornAt: now,
    };
    this.state.bullets.push(bullet);

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffee88 }),
    );
    flash.position.set(
      p.x + Math.sin(p.rot) * 0.9,
      0.95,
      p.z + Math.cos(p.rot) * 0.9,
    );
    this.scene.add(flash);
    this.muzzleFlashes.push({ mesh: flash, until: now + 45 });
  }

  private meleeAttack(p: PlayerState, damage: number, range: number) {
    for (const other of this.state.players) {
      if (!other.alive || other.id === p.id || other.team === p.team) continue;
      const dx = other.x - p.x;
      const dz = other.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range) continue;
      const ang = Math.atan2(dx, dz);
      let diff = ang - p.rot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 0.9) continue;
      this.applyDamage(other, p, damage, "FACA");
    }
  }

  private updateBullets(dt: number) {
    const walls = this.map.walls;
    const next: BulletState[] = [];

    for (const b of this.state.bullets) {
      const stepX = b.vx * dt;
      const stepZ = b.vz * dt;
      const stepLen = Math.hypot(stepX, stepZ);
      b.x += stepX;
      b.z += stepZ;
      b.rangeLeft -= stepLen;

      let hitWall = false;
      for (const w of walls) {
        const halfW = w.w / 2;
        const halfD = w.d / 2;
        if (
          b.x > w.x - halfW &&
          b.x < w.x + halfW &&
          b.z > w.z - halfD &&
          b.z < w.z + halfD
        ) {
          hitWall = true;
          break;
        }
      }
      if (hitWall || b.rangeLeft <= 0) {
        this.removeBulletMesh(b.id);
        continue;
      }

      let hitPlayer = false;
      for (const p of this.state.players) {
        if (!p.alive || p.team === b.team || p.id === b.ownerId) continue;
        const dx = p.x - b.x;
        const dz = p.z - b.z;
        if (dx * dx + dz * dz < (PLAYER_RADIUS + BULLET_RADIUS) ** 2) {
          const owner = this.state.players.find((o) => o.id === b.ownerId);
          const weaponName =
            owner && owner.weapons[owner.weaponSlot]
              ? WEAPONS[owner.weapons[owner.weaponSlot]!].name
              : "ARMA";
          if (owner) this.applyDamage(p, owner, b.damage, weaponName);
          hitPlayer = true;
          break;
        }
      }

      if (hitPlayer) {
        this.removeBulletMesh(b.id);
        continue;
      }
      next.push(b);
    }
    this.state.bullets = next;
  }

  private applyDamage(
    victim: PlayerState,
    killer: PlayerState,
    damage: number,
    weaponName: string,
  ) {
    if (!victim.alive) return;

    const result = applyDamageToVitals(
      { hp: victim.hp, armor: victim.armor },
      damage,
    );
    victim.hp = result.hp;
    victim.armor = result.armor;

    if (victim.id === this.state.localPlayerId) {
      this.state.damageFlashUntil = performance.now() + 220;
      this.state.lastDamageAmount = damage;
    }
    if (killer.id === this.state.localPlayerId) {
      this.state.hitMarkerUntil = performance.now() + 120;
    }

    if (isDead(victim.hp)) {
      victim.hp = 0;
      victim.alive = false;
      victim.deaths += 1;
      killer.kills += 1;

      if (this.state.phase === "live") killer.money += KILL_REWARD;

      const entry: KillFeedEntry = {
        id: uid("kf"),
        killer: killer.name,
        victim: victim.name,
        weapon: weaponName,
        at: performance.now(),
      };
      this.state.killFeed.unshift(entry);
      this.state.killFeed = this.state.killFeed.slice(0, 6);

      if (killer.isBot) {
        this.addChat(killer.name, pick(BOT_LINES.kill), "all");
      }

      if (this.state.phase === "live") {
        const trAlive = this.state.players.some((p) => p.team === "TR" && p.alive);
        const ctAlive = this.state.players.some((p) => p.team === "CT" && p.alive);
        if (!trAlive) this.endRound("CT");
        else if (!ctAlive) this.endRound("TR");
      }

      if (this.state.phase === "warmup") {
        setTimeout(() => {
          if (this.state.phase === "warmup" && !victim.alive) {
            this.respawnPlayer(victim);
          }
        }, 2000);
      }
    }
  }

  private addChat(from: string, text: string, kind: ChatEntry["kind"]) {
    this.state.chat.push({
      id: uid("chat"),
      from,
      text,
      kind,
      at: performance.now(),
    });
    this.state.chat = this.state.chat.slice(-8);
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

  private syncMeshes() {
    for (const p of this.state.players) {
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

    for (const b of this.state.bullets) {
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
  }

  private removeBulletMesh(id: string) {
    const mesh = this.bulletMeshes.get(id);
    if (!mesh) return;
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    this.bulletMeshes.delete(id);
  }

  private clearBulletMeshes() {
    for (const id of [...this.bulletMeshes.keys()]) this.removeBulletMesh(id);
  }

  private updateCamera() {
    const p = this.state.players.find((x) => x.id === this.state.localPlayerId);
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

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  private pushHud() {
    if (!this.onHud) return;
    const p = this.state.players.find((x) => x.id === this.state.localPlayerId);
    if (!p) return;

    const now = performance.now();
    const wid = p.weapons[p.weaponSlot];
    const def = wid ? WEAPONS[wid] : null;
    const ammo = wid ? p.ammo[wid] : null;

    const weapons: HudSnapshot["weapons"] = [];
    for (const [slotStr, w] of Object.entries(p.weapons)) {
      if (!w) continue;
      weapons.push({
        slot: Number(slotStr),
        name: WEAPONS[w].name,
        active: Number(slotStr) === p.weaponSlot,
      });
    }
    weapons.sort((a, b) => a.slot - b.slot);

    const reloading = p.reloadingUntil > now;
    let reloadProgress = 0;
    if (reloading && def && def.reloadTime > 0) {
      const left = p.reloadingUntil - now;
      reloadProgress = 1 - left / def.reloadTime;
    }

    this.onHud({
      hp: Math.max(0, Math.round(p.hp)),
      armor: Math.max(0, Math.round(p.armor)),
      money: p.money,
      mag: ammo?.mag ?? 0,
      reserve: ammo?.reserve ?? 0,
      weaponName: def?.name ?? "—",
      weaponSlot: p.weaponSlot,
      weapons,
      scoreTR: this.state.scoreTR,
      scoreCT: this.state.scoreCT,
      timeLeft: Math.max(0, this.state.timeLeft),
      phase: this.state.phase,
      round: this.state.round,
      killFeed: this.state.killFeed,
      chat: this.state.chat,
      alive: p.alive,
      paused: this.state.paused,
      showScoreboard: this.state.showScoreboard,
      showHelp: this.state.showHelp,
      reloading,
      reloadProgress: Math.max(0, Math.min(1, reloadProgress)),
      lowAmmo: !!ammo && ammo.mag <= Math.ceil((def?.magazine ?? 10) * 0.25) && !def?.isMelee,
      hitMarker: now < this.state.hitMarkerUntil,
      damageFlash: Math.max(
        0,
        (this.state.damageFlashUntil - now) / 220,
      ),
      mapName: this.map.displayName,
      minimap: this.state.players.map((pl) => ({
        id: pl.id,
        x: pl.x,
        z: pl.z,
        team: pl.team,
        isLocal: pl.id === this.state.localPlayerId,
        alive: pl.alive,
      })),
      scoreboard: this.state.players
        .map((pl) => ({
          id: pl.id,
          name: pl.name,
          team: pl.team,
          kills: pl.kills,
          deaths: pl.deaths,
          money: pl.money,
          alive: pl.alive,
          isLocal: pl.id === this.state.localPlayerId,
          isBot: pl.isBot,
        }))
        .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths),
    });
  }
}
