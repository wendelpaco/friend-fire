import * as THREE from "three";
import { CAMERA_HEIGHT, CAMERA_OFFSET } from "@/game/constants";
import type { BulletState, PlayerState } from "@/game/types";
import { buildBillboardMesh, buildWallPoster } from "@/game/world/billboards";
import {
  FOG_ENABLED_KEY,
  GRAPHICS_QUALITY_KEY,
  getFogEnabled as readFogEnabledPref,
  resolveQualityConfig,
  type GraphicsQualityConfig,
} from "@/domains/prefs";
import type { GameMap } from "@/domains/world";
import { Sfx } from "@/infrastructure/audio/Sfx";
import {
  createCharacter,
  type CharacterHandle,
  type WeaponCategory,
} from "./character";
import {
  BombMarkerSystem,
  DamageNumberSystem,
  HESystem,
  ImpactParticleSystem,
  type ImpactSurface,
  MuzzleFlashSystem,
  WallDamageSystem,
} from "./fx";

/** Enemy players beyond this distance from the local player are culled. */
export const FOG_VISION_RADIUS = 14;

/** Minimal fields required to keep meshes in sync with simulation. */
export interface RenderSnapshot {
  players: ReadonlyArray<
    Pick<
      PlayerState,
      | "id"
      | "name"
      | "team"
      | "isBot"
      | "x"
      | "z"
      | "rot"
      | "alive"
      | "color"
    > & {
      weaponSlot?: number;
      weaponId?: string;
      /** Jump height (default 0). */
      y?: number;
      crouching?: boolean;
      onGround?: boolean;
      /** Mag reload timer active — reload arm pose. */
      reloading?: boolean;
    }
  >;
  bullets: ReadonlyArray<Pick<BulletState, "id" | "x" | "z">>;
  localPlayerId: string;
  cameraMode?: "locked" | "free";
  /** When free cam: pan target on ground */
  freeCamX?: number;
  freeCamZ?: number;
}

/** Map loadout → held weapon silhouette. */
export function weaponCategoryOf(
  weaponId?: string | null,
  weaponSlot?: number,
): WeaponCategory {
  if (weaponSlot === 4 || weaponId === "knife") return "knife";
  if (
    weaponId === "glock" ||
    weaponId === "usp" ||
    weaponId === "deagle"
  ) {
    return "pistol";
  }
  return "rifle";
}

/**
 * Visual target: RUSH-B style top-down — warm sand, long sun shadows,
 * local spotlight, radial vignette, tropical horizon, denser props.
 * Owns combat FX + animated character rigs.
 */
export class ThreeRenderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private map: GameMap;
  private characters = new Map<string, CharacterHandle>();
  private lastPos = new Map<string, { x: number; z: number; t: number }>();
  private shootFlags = new Set<string>();
  private bulletMeshes = new Map<string, THREE.Mesh>();
  /** Inactive bullet meshes ready for reuse (shared geo/mat). */
  private bulletPool: THREE.Mesh[] = [];
  private bulletGeo!: THREE.SphereGeometry;
  private bulletMat!: THREE.MeshBasicMaterial;
  private wallGroup = new THREE.Group();
  private propGroup = new THREE.Group();
  private adGroup = new THREE.Group();
  private sceneryGroup = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmpVec = new THREE.Vector3();
  private tmpNdc = new THREE.Vector2();
  private muzzleFx: MuzzleFlashSystem;
  private impactFx: ImpactParticleSystem;
  private wallDamageFx: WallDamageSystem;
  private bombMarkerFx: BombMarkerSystem;
  private heFx: HESystem;
  private damageNumberFx: DamageNumberSystem;
  private playerSpot!: THREE.SpotLight;
  private sunLight!: THREE.DirectionalLight;
  private dustParticles!: THREE.Points;
  private dustPositions!: Float32Array;
  private dustMaxCount = 280;
  private dustActiveCount = 0;
  private dustUpdateHz = 20;
  private dustAccum = 0;
  private propCastShadow = false;
  private quality: GraphicsQualityConfig = resolveQualityConfig();
  private vignette!: THREE.Mesh;
  private wallTex!: THREE.CanvasTexture;
  private sandTex!: THREE.CanvasTexture;
  /** Limited-vision cull; from `ff_fog_enabled` (default true). */
  private fogEnabled = true;
  private readonly onPrefsEvent = () => {
    this.fogEnabled = readFogEnabledPref();
    this.applyQuality(resolveQualityConfig());
  };
  private readonly onStorageEvent = (e: StorageEvent) => {
    if (e.key === null || e.key === FOG_ENABLED_KEY) {
      this.fogEnabled = readFogEnabledPref();
    }
    if (e.key === null || e.key === GRAPHICS_QUALITY_KEY) {
      this.applyQuality(resolveQualityConfig());
    }
  };

  constructor(canvas: HTMLCanvasElement, map: GameMap) {
    this.map = map;
    this.fogEnabled = readFogEnabledPref();
    this.quality = resolveQualityConfig();
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 220);
    this.camera.position.set(0, CAMERA_HEIGHT, CAMERA_OFFSET);
    this.camera.lookAt(0, 0, 0);

    // Antialias is fixed at context creation — quality tier picks initial value.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality.antialias,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(map.skyColor, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.bulletGeo = new THREE.SphereGeometry(0.08, 6, 6);
    this.bulletMat = new THREE.MeshBasicMaterial({ color: 0xffee77 });

    this.scene.fog = new THREE.FogExp2(map.fogColor, 0.018);
    this.scene.background = this.makeSkyTexture(map.skyColor);

    this.sandTex = this.makeGroundTexture();
    this.wallTex = this.makeWallTexture();
    this.propCastShadow = this.quality.propCastShadow;
    this.buildWorld();
    this.buildScenery();
    this.buildVignette();

    this.muzzleFx = new MuzzleFlashSystem(this.scene);
    this.impactFx = new ImpactParticleSystem(this.scene);
    this.wallDamageFx = new WallDamageSystem(this.scene);
    this.bombMarkerFx = new BombMarkerSystem(this.scene);
    this.heFx = new HESystem(this.scene);
    this.damageNumberFx = new DamageNumberSystem(this.scene);

    // Apply DPR / shadows / dust after lights & dust exist.
    this.applyQuality(this.quality);

    if (typeof window !== "undefined") {
      window.addEventListener("ff-prefs", this.onPrefsEvent);
      window.addEventListener("storage", this.onStorageEvent);
    }
  }

  /**
   * Apply graphics quality (runtime-safe knobs: DPR, shadows, dust).
   * Antialias cannot toggle without recreating the WebGL context.
   */
  applyQuality(cfg: GraphicsQualityConfig = resolveQualityConfig()): void {
    this.quality = cfg;
    this.propCastShadow = cfg.propCastShadow;

    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    this.renderer.setPixelRatio(Math.min(dpr, cfg.maxPixelRatio));

    this.renderer.shadowMap.enabled = cfg.shadowsEnabled;
    if (cfg.shadowType === "basic") {
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
    } else if (cfg.shadowType === "pcf") {
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
    } else {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.renderer.shadowMap.needsUpdate = true;

    if (this.sunLight) {
      this.sunLight.castShadow = cfg.shadowsEnabled;
      this.sunLight.shadow.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
      // Force shadow map rebuild at new resolution
      if (this.sunLight.shadow.map) {
        this.sunLight.shadow.map.dispose();
        this.sunLight.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      }
    }

    this.applyPropShadowFlag(cfg.propCastShadow);
    this.configureDust(cfg.dustCount, cfg.dustUpdateHz);
  }

  getQuality(): GraphicsQualityConfig {
    return this.quality;
  }

  /** WebGL draw stats for FPS overlay (call after render). */
  getRenderInfo(): { calls: number; triangles: number } {
    const info = this.renderer.info.render;
    return { calls: info.calls, triangles: info.triangles };
  }

  private applyPropShadowFlag(cast: boolean): void {
    this.propGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        // Keep receive; only toggle cast on prop meshes
        obj.castShadow = cast;
      }
    });
  }

  private configureDust(count: number, updateHz: number): void {
    this.dustUpdateHz = updateHz;
    this.dustAccum = 0;
    if (!this.dustParticles || !this.dustPositions) return;

    const max = this.dustMaxCount;
    const n = Math.max(0, Math.min(max, Math.floor(count)));
    this.dustActiveCount = n;
    this.dustParticles.visible = n > 0;

    const pos = this.dustParticles.geometry.attributes
      .position as THREE.BufferAttribute;
    // Hide inactive points far below the map
    for (let i = 0; i < max; i++) {
      if (i < n) {
        if (pos.getY(i) < -10) {
          pos.setXYZ(
            i,
            (Math.random() - 0.5) * 48,
            0.3 + Math.random() * 5,
            (Math.random() - 0.5) * 48,
          );
        }
      } else {
        pos.setXYZ(i, 0, -50, 0);
      }
    }
    pos.needsUpdate = true;
    this.dustParticles.geometry.setDrawRange(0, n);
  }

  /** Enable/disable enemy distance fog-of-war cull (in-memory). */
  setFogEnabled(on: boolean) {
    this.fogEnabled = on;
  }

  getFogEnabled(): boolean {
    return this.fogEnabled;
  }

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

  /** Muzzle flash at gun tip along facing. */
  spawnMuzzle(x: number, z: number, rot: number) {
    this.muzzleFx.spawn(x, z, rot);
  }

  /** Impact sparks/dust + cosmetic wall damage (wall/prop). */
  spawnImpact(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    surface: ImpactSurface = "wall",
  ) {
    this.impactFx.spawn(x, y, z, nx, ny, nz, surface);
    if (surface === "wall" || surface === "prop") {
      this.wallDamageFx.spawn(x, y, z, nx, ny, nz, surface);
    }
  }

  /** Planted bomb world marker; pass null to hide. Spec §2.1. */
  setBombVisual(pos: { x: number; z: number } | null) {
    this.bombMarkerFx.setVisual(pos);
  }

  /**
   * HE grenade: projectile at (x,y,z), or explosion when `explode` is true.
   * Optional `id` for multi-grenade projectile slots. Spec §2.4.
   */
  spawnHE(x: number, y: number, z: number, explode = false, id = 0) {
    this.heFx.spawn(x, y, z, explode, id);
  }

  /** Floating damage number (“-XX”) at hit pos. Spec §2.8. */
  spawnDamageNumber(x: number, y: number, z: number, text: string) {
    this.damageNumberFx.spawn(x, y, z, text);
  }

  /** Advance pooled FX systems (call every frame). */
  updateFx(dt: number) {
    this.muzzleFx.update(dt);
    this.impactFx.update(dt);
    this.wallDamageFx.update(dt);
    this.bombMarkerFx.update(dt);
    this.heFx.update(dt);
    this.damageNumberFx.update(dt);
  }

  /** Brief shoot recoil overlay on character next sync. */
  notifyShoot(playerId: string) {
    this.shootFlags.add(playerId);
  }

  animateDust(dt: number) {
    if (this.dustActiveCount <= 0 || this.dustUpdateHz <= 0) return;
    this.dustAccum += dt;
    const interval = 1 / this.dustUpdateHz;
    if (this.dustAccum < interval) return;
    // Use accumulated step so low Hz stays stable under varying frame times
    const step = this.dustAccum;
    this.dustAccum = 0;

    const pos = this.dustParticles.geometry.attributes
      .position as THREE.BufferAttribute;
    const t = performance.now() * 0.001;
    const n = this.dustActiveCount;
    for (let i = 0; i < n; i++) {
      let y = pos.getY(i) + step * (0.12 + (i % 5) * 0.02);
      if (y > 5.5) y = 0.25;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t + i) * step * 0.25);
      pos.setZ(i, pos.getZ(i) + Math.cos(t * 0.7 + i) * step * 0.12);
    }
    pos.needsUpdate = true;
  }

  sync(snapshot: RenderSnapshot) {
    const aliveBulletIds = new Set<string>();
    const alivePlayerIds = new Set<string>();
    const now = performance.now() * 0.001;
    const local = snapshot.players.find((x) => x.id === snapshot.localPlayerId);

    for (const p of snapshot.players) {
      alivePlayerIds.add(p.id);
      let handle = this.characters.get(p.id);
      if (!handle) {
        handle = this.createPlayerCharacter(p);
        this.characters.set(p.id, handle);
        this.scene.add(handle.group);
      }

      const cat = weaponCategoryOf(p.weaponId, p.weaponSlot);
      handle.setWeapon(cat);

      const last = this.lastPos.get(p.id);
      const dt = last ? Math.max(1 / 120, now - last.t) : 1 / 60;
      // World velocity from position delta (WASD result after collision).
      const moveX = last ? (p.x - last.x) / dt : 0;
      const moveZ = last ? (p.z - last.z) / dt : 0;
      this.lastPos.set(p.id, { x: p.x, z: p.z, t: now });

      const shooting = this.shootFlags.has(p.id);
      const rootY = p.y ?? 0;
      const crouching = Boolean(p.crouching);
      const airborne = p.onGround === false;
      // CharacterController: body faces velocity when moving, aim when idle.
      // Yaw uses horizontal move only (moveX/moveZ) — jump Y never enters facing.
      const foot = handle.update(dt, {
        moveX,
        moveZ,
        aimYaw: p.rot,
        rootY,
        crouching,
        airborne,
        reloading: Boolean(p.reloading),
        shooting,
        weaponCategory: cat,
      });

      // Foot SFX synced to walk-cycle plant (local player only — avoid spam).
      if (foot && p.id === snapshot.localPlayerId && p.alive) {
        Sfx.play("foot");
      }

      // Fog of war: local + same team always visible (if alive); enemies only within radius when on.
      let inVision = true;
      if (
        this.fogEnabled &&
        local &&
        p.id !== local.id &&
        p.team !== local.team
      ) {
        const dist = Math.hypot(p.x - local.x, p.z - local.z);
        inVision = dist <= FOG_VISION_RADIUS;
      }
      handle.group.visible = p.alive && inVision;
      handle.group.position.set(p.x, rootY, p.z);
      // visual yaw applied inside handle.update via CharacterController
    }
    this.shootFlags.clear();

    for (const id of [...this.characters.keys()]) {
      if (!alivePlayerIds.has(id)) this.removeCharacter(id);
    }

    for (const b of snapshot.bullets) {
      aliveBulletIds.add(b.id);
      let mesh = this.bulletMeshes.get(b.id);
      if (!mesh) {
        mesh = this.acquireBulletMesh();
        this.bulletMeshes.set(b.id, mesh);
      }
      mesh.visible = true;
      mesh.position.set(b.x, 1.0, b.z);
    }

    for (const id of [...this.bulletMeshes.keys()]) {
      if (!aliveBulletIds.has(id)) this.releaseBulletMesh(id);
    }

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
    if (typeof window !== "undefined") {
      window.removeEventListener("ff-prefs", this.onPrefsEvent);
      window.removeEventListener("storage", this.onStorageEvent);
    }
    this.muzzleFx.dispose();
    this.impactFx.dispose();
    this.wallDamageFx.dispose();
    this.bombMarkerFx.dispose();
    this.heFx.dispose();
    this.damageNumberFx.dispose();
    for (const id of [...this.characters.keys()]) this.removeCharacter(id);
    this.renderer.dispose();
    this.sandTex.dispose();
    this.wallTex.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else (mat as THREE.Material).dispose();
      }
    });
  }

  // ─── world ───────────────────────────────────────────────

  private buildWorld() {
    const hemi = new THREE.HemisphereLight(0xb8d4f0, 0x8b6914, 0.45);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffe8cc, 0.28);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffe2b0, 1.55);
    sun.position.set(28, 36, 14);
    sun.castShadow = this.quality.shadowsEnabled;
    sun.shadow.mapSize.set(
      this.quality.shadowMapSize,
      this.quality.shadowMapSize,
    );
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -48;
    sun.shadow.camera.right = 48;
    sun.shadow.camera.top = 48;
    sun.shadow.camera.bottom = -48;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
    this.sunLight = sun;
    this.scene.add(sun);

    // fill light (cool) opposite sun for contact contrast
    const fill = new THREE.DirectionalLight(0x88aacc, 0.25);
    fill.position.set(-18, 12, -10);
    this.scene.add(fill);

    const groundGeo = new THREE.PlaneGeometry(
      this.map.size.width,
      this.map.size.depth,
      1,
      1,
    );
    const groundMat = new THREE.MeshStandardMaterial({
      map: this.sandTex,
      roughness: 0.95,
      metalness: 0.0,
      color: 0xe8d0a8,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // asphalt path strips (mid corridors feel)
    this.addRoad(-2, 0, 5, 40, 0);
    this.addRoad(0, -8, 28, 4.5, 0);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(24.2, 40, 64),
      new THREE.MeshStandardMaterial({
        color: 0x5a8a4a,
        roughness: 1,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.03;
    this.scene.add(ring);

    // outer sand beach strip toward ocean
    const beach = new THREE.Mesh(
      new THREE.RingGeometry(40, 55, 64),
      new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 1 }),
    );
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = -0.04;
    this.scene.add(beach);

    const ocean = new THREE.Mesh(
      new THREE.RingGeometry(55, 90, 64),
      new THREE.MeshStandardMaterial({
        color: 0x2a7a9a,
        roughness: 0.35,
        metalness: 0.15,
      }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.06;
    this.scene.add(ocean);

    for (const w of this.map.walls) {
      const h = w.h ?? 2.5;
      const color = w.color ?? 0xb89a6e;
      const mat = new THREE.MeshStandardMaterial({
        map: this.wallTex,
        color,
        roughness: 0.9,
        metalness: 0.03,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, h, w.d), mat);
      mesh.position.set(w.x, h / 2, w.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.wallGroup.add(mesh);

      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(w.w + 0.14, 0.14, w.d + 0.14),
        new THREE.MeshStandardMaterial({
          color: 0x8a7048,
          roughness: 0.7,
        }),
      );
      cap.position.set(w.x, h + 0.06, w.z);
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
          opacity: 0.28,
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
      0xfff1d0,
      1.85,
      16,
      Math.PI / 2.8,
      0.65,
      1.0,
    );
    this.playerSpot.position.set(0, 14, 0);
    this.playerSpot.castShadow = false;
    this.scene.add(this.playerSpot);
    this.scene.add(this.playerSpot.target);

    // Max capacity 280; active count / update Hz come from quality tier.
    const count = 280;
    this.dustMaxCount = count;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 48;
      positions[i * 3 + 1] = 0.3 + Math.random() * 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 48;
    }
    this.dustPositions = positions;
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.dustParticles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: 0xffe4b8,
        size: 0.07,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.scene.add(this.dustParticles);
    this.dustActiveCount = count;
  }

  private addRoad(x: number, z: number, w: number, d: number, y: number) {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        color: 0x5a564e,
        roughness: 0.92,
        metalness: 0.05,
      }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, y + 0.025, z);
    road.receiveShadow = true;
    this.scene.add(road);

    // dashed center line
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xc8b060 });
    const segments = Math.floor(Math.max(w, d) / 2.2);
    const alongZ = d >= w;
    for (let i = 0; i < segments; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.9), lineMat);
      dash.rotation.x = -Math.PI / 2;
      if (alongZ) {
        dash.position.set(x, y + 0.03, z - d / 2 + 1.1 + i * 2.2);
      } else {
        dash.rotation.z = Math.PI / 2;
        dash.position.set(x - w / 2 + 1.1 + i * 2.2, y + 0.03, z);
      }
      this.scene.add(dash);
    }
  }

  /** Tropical horizon: palms + pastel buildings (backdrop only, no collision) */
  private buildScenery() {
    const buildingColors = [0xd4a574, 0xc97b63, 0x7a9eb5, 0xe8d5b0, 0xa8b89a];
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + 0.2;
      const dist = 32 + (i % 3) * 3;
      const bx = Math.cos(ang) * dist;
      const bz = Math.sin(ang) * dist;
      const bh = 4 + (i % 5) * 1.4;
      const bw = 2.5 + (i % 3);
      const bd = 2.2 + (i % 2);
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, bd),
        new THREE.MeshStandardMaterial({
          color: buildingColors[i % buildingColors.length],
          roughness: 0.85,
        }),
      );
      b.position.set(bx, bh / 2 - 0.2, bz);
      b.castShadow = true;
      this.sceneryGroup.add(b);

      // simple window row
      const winMat = new THREE.MeshBasicMaterial({
        color: 0x1a3040,
        transparent: true,
        opacity: 0.55,
      });
      for (let wy = 1; wy < bh - 0.5; wy += 1.1) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.7, 0.35), winMat);
        win.position.set(bx, wy, bz + bd / 2 + 0.02);
        this.sceneryGroup.add(win);
      }
    }

    // palm trees around rim
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      const dist = 28 + (i % 4);
      this.sceneryGroup.add(
        this.makePalm(Math.cos(ang) * dist, Math.sin(ang) * dist, 0.85 + (i % 3) * 0.12),
      );
    }

    // flowering bush blobs (favela vibe accents)
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + 0.4;
      const dist = 26.5;
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.9 + (i % 3) * 0.2, 8, 6),
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0xd45a8a : 0x4a8a3a,
          roughness: 0.9,
        }),
      );
      bush.position.set(Math.cos(ang) * dist, 0.6, Math.sin(ang) * dist);
      this.sceneryGroup.add(bush);
    }

    this.scene.add(this.sceneryGroup);
  }

  private makePalm(x: number, z: number, scale: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 5.2, 7),
      new THREE.MeshStandardMaterial({ color: 0x6b4a28, roughness: 0.9 }),
    );
    trunk.position.y = 2.6;
    trunk.castShadow = true;
    g.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2d7a3a,
      roughness: 0.75,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.8), leafMat);
      leaf.position.set(0, 5.0, 0);
      leaf.rotation.z = (i / 7) * Math.PI * 2;
      leaf.rotation.x = 0.85;
      leaf.position.x = Math.sin((i / 7) * Math.PI * 2) * 0.3;
      leaf.position.z = Math.cos((i / 7) * Math.PI * 2) * 0.3;
      g.add(leaf);
    }
    return g;
  }

  private buildVignette() {
    // Screen-space dark ring — signature RUSH B look (local light focus)
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(256, 256, 80, 256, 256, 256);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.45, "rgba(0,0,0,0)");
    g.addColorStop(0.75, "rgba(0,0,0,0.45)");
    g.addColorStop(1, "rgba(0,0,0,0.82)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.vignette = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.vignette.frustumCulled = false;
    this.vignette.renderOrder = 999;
    // attach as camera child in NDC-ish space via Orthographic overlay
    // simpler: large plane slightly in front of camera, always facing
    this.camera.add(this.vignette);
    this.vignette.position.set(0, 0, -0.55);
    this.vignette.scale.set(1.15, 1.15, 1);
    this.scene.add(this.camera);
  }

  private makeSkyTexture(base: number): THREE.Color {
    // FogExp2 + solid color is enough; gradient sky via scene.background Color
    return new THREE.Color(base);
  }

  private makeGroundTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#c9a878";
    ctx.fillRect(0, 0, 512, 512);
    // multi-scale noise
    for (let i = 0; i < 2800; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const s = 1 + Math.random() * 5;
      const shade = 130 + Math.random() * 50;
      ctx.fillStyle = `rgba(${shade},${shade * 0.78},${shade * 0.48},${0.06 + Math.random() * 0.14})`;
      ctx.fillRect(x, y, s, s * (0.5 + Math.random()));
    }
    // footprint-ish dark patches
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(90,70,40,${0.04 + Math.random() * 0.06})`;
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * 512,
        Math.random() * 512,
        8 + Math.random() * 20,
        4 + Math.random() * 10,
        Math.random() * Math.PI,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  private makeWallTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#c2a87a";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 800; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    // stucco lines
    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    for (let y = 0; y < 256; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.random() * 2);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.5, 1.5);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createProp(p: GameMap["props"][number]): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(p.x, 0, p.z);
    const kind = p.kind ?? "crate";
    // Props are numerous — casting shadows is high-only (toggle via applyQuality).
    const cast = this.propCastShadow;

    if (kind === "barrel") {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(p.w * 0.45, p.w * 0.48, p.h, 14),
        new THREE.MeshStandardMaterial({
          color: p.color,
          roughness: 0.5,
          metalness: 0.4,
        }),
      );
      body.position.y = p.h / 2;
      body.castShadow = cast;
      body.receiveShadow = true;
      group.add(body);
    } else if (kind === "car") {
      const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, p.h * 0.55, p.d),
        new THREE.MeshStandardMaterial({
          color: p.color,
          roughness: 0.4,
          metalness: 0.45,
        }),
      );
      chassis.position.y = p.h * 0.35;
      chassis.castShadow = cast;
      group.add(chassis);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(p.w * 0.55, p.h * 0.45, p.d * 0.9),
        new THREE.MeshStandardMaterial({
          color: 0x1a202c,
          roughness: 0.25,
          metalness: 0.2,
          transparent: true,
          opacity: 0.85,
        }),
      );
      cabin.position.set(-p.w * 0.05, p.h * 0.72, 0);
      cabin.castShadow = cast;
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
    } else if (kind === "container") {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, p.h, p.d),
        new THREE.MeshStandardMaterial({
          color: p.color,
          roughness: 0.55,
          metalness: 0.35,
        }),
      );
      body.position.y = p.h / 2;
      body.castShadow = cast;
      body.receiveShadow = true;
      group.add(body);
      const ridge = new THREE.Mesh(
        new THREE.BoxGeometry(p.w * 0.98, 0.08, p.d * 0.98),
        new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5 }),
      );
      ridge.position.y = p.h + 0.02;
      group.add(ridge);
    } else if (kind === "debris") {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(Math.max(p.w, p.d) * 0.45, 0),
        new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.95 }),
      );
      rock.position.y = p.h * 0.4;
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = cast;
      group.add(rock);
    } else if (kind === "pole") {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, p.h, 6),
        new THREE.MeshStandardMaterial({
          color: p.color,
          metalness: 0.5,
          roughness: 0.5,
        }),
      );
      pole.position.y = p.h / 2;
      pole.castShadow = cast;
      group.add(pole);
      const wire = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.03, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x222222 }),
      );
      wire.position.set(1.0, p.h * 0.92, 0);
      group.add(wire);
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
      body.castShadow = cast;
      group.add(body);
    } else {
      const mat = new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: 0.8,
      });
      const box = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat);
      box.position.y = p.h / 2;
      box.castShadow = cast;
      box.receiveShadow = true;
      group.add(box);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w, p.h, p.d)),
        new THREE.LineBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.22,
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
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
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

  private createPlayerCharacter(
    p: Pick<
      PlayerState,
      "id" | "name" | "team" | "isBot" | "x" | "z" | "rot" | "color"
    > & { weaponSlot?: number; weaponId?: string },
  ): CharacterHandle {
    const handle = createCharacter(p.color);
    handle.group.name = p.id;

    const cat = weaponCategoryOf(p.weaponId, p.weaponSlot);
    handle.setWeapon(cat);

    // Soft ground blob under feet
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 20),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.22,
      }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.02;
    handle.group.add(blob);

    const label = this.makeSpriteText(
      p.isBot ? p.name.replace("BOT ", "") : p.name,
      "#ffffff",
      256,
    );
    label.position.y = 2.05;
    label.scale.set(2.0, 0.65, 1);
    label.name = "label";
    handle.group.add(label);

    handle.group.position.set(p.x, 0, p.z);
    handle.resetFacing(p.rot);
    handle.group.rotation.y = p.rot; // seed; controller takes over next frame
    return handle;
  }

  private removeCharacter(id: string) {
    const handle = this.characters.get(id);
    if (!handle) return;
    this.scene.remove(handle.group);
    handle.dispose();
    this.characters.delete(id);
    this.lastPos.delete(id);
  }

  private acquireBulletMesh(): THREE.Mesh {
    const pooled = this.bulletPool.pop();
    if (pooled) {
      pooled.visible = true;
      return pooled;
    }
    const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
    this.scene.add(mesh);
    return mesh;
  }

  /** Return mesh to pool (keep shared geo/mat). */
  private releaseBulletMesh(id: string) {
    const mesh = this.bulletMeshes.get(id);
    if (!mesh) return;
    mesh.visible = false;
    this.bulletPool.push(mesh);
    this.bulletMeshes.delete(id);
  }

  private updateCamera(snapshot: RenderSnapshot) {
    const p = snapshot.players.find((x) => x.id === snapshot.localPlayerId);
    if (!p) return;

    const free = snapshot.cameraMode === "free";
    const lookX = free ? (snapshot.freeCamX ?? p.x) : p.x;
    const lookZ = free ? (snapshot.freeCamZ ?? p.z) : p.z;

    this.camera.position.x += (lookX - this.camera.position.x) * 0.11;
    this.camera.position.z +=
      (lookZ + CAMERA_OFFSET - this.camera.position.z) * 0.11;
    this.camera.position.y = free ? CAMERA_HEIGHT + 4 : CAMERA_HEIGHT;
    this.camera.lookAt(lookX, 0.4, lookZ);

    // Spotlight always on local player (not free cam center)
    this.playerSpot.position.set(p.x, 14, p.z);
    this.playerSpot.target.position.set(p.x, 0, p.z);
    this.playerSpot.target.updateMatrixWorld();
  }
}
