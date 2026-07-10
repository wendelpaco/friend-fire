import * as THREE from "three";
import { CAMERA_HEIGHT, CAMERA_OFFSET } from "@/game/constants";
import type { BulletState, PlayerState } from "@/game/types";
import { buildBillboardMesh, buildWallPoster } from "@/game/world/billboards";
import {
  FOG_ENABLED_KEY,
  configFromRuntimeKnobs,
  getFogEnabled as readFogEnabledPref,
  resolveQualityConfig,
  type GraphicsQualityConfig,
  type RuntimeKnobs,
} from "@/domains/prefs";
import type { GameMap, PropBox } from "@/domains/world";
import { Sfx } from "@/infrastructure/audio/Sfx";
import {
  createCharacter,
  type CharacterHandle,
  type CharacterLod,
  type WeaponCategory,
} from "./character";
import {
  AimReticleSystem,
  BombMarkerSystem,
  DamageNumberSystem,
  HESystem,
  ImpactParticleSystem,
  type ImpactSurface,
  MuzzleFlashSystem,
  TracerSystem,
  WallDamageSystem,
} from "./fx";
import {
  fxDensityFromBudget,
  isInstanceableKind,
  normalizePropKind,
  propBatchKey,
  shadowHalfExtent,
  shouldIncludePropKind,
  type InstanceableKind,
} from "./propBatch";

/** Enemy players beyond this distance from the local player are culled. */
export const FOG_VISION_RADIUS = 14;
/** Full procedural anim within this range of the local player. */
export const ANIM_LOD_FULL_DIST = 14;
/** Mid anim (every 2nd frame) up to this range; beyond = far (pose frozen). */
export const ANIM_LOD_MID_DIST = 24;

/** Pure LOD pick — unit-tested, used by {@link ThreeRenderer.sync}. */
export function pickCharacterLod(
  isLocal: boolean,
  visible: boolean,
  dist: number,
  fullDist: number = ANIM_LOD_FULL_DIST,
  midDist: number = ANIM_LOD_MID_DIST,
): CharacterLod {
  if (isLocal) return "full";
  if (!visible) return "far";
  if (!(dist >= 0) || !Number.isFinite(dist)) return "full";
  const full = fullDist > 0 ? fullDist : ANIM_LOD_FULL_DIST;
  const mid = midDist > full ? midDist : full + 1;
  if (dist <= full) return "full";
  if (dist <= mid) return "mid";
  return "far";
}

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
  /** Reused each sync to avoid Set allocs (W2). */
  private syncAlivePlayers = new Set<string>();
  private syncAliveBullets = new Set<string>();
  private syncRemoveIds: string[] = [];
  /** Inactive bullet meshes ready for reuse (shared geo/mat). */
  private bulletPool: THREE.Mesh[] = [];
  private bulletGeo!: THREE.SphereGeometry;
  private bulletMat!: THREE.MeshBasicMaterial;
  /** Shared unit geometries for map props (scaled per instance). */
  private propGeo = {
    box: null as THREE.BoxGeometry | null,
    barrel: null as THREE.CylinderGeometry | null,
    pole: null as THREE.CylinderGeometry | null,
    debris: null as THREE.DodecahedronGeometry | null,
    wheel: null as THREE.CylinderGeometry | null,
  };
  private propMatCache = new Map<string, THREE.Material>();
  private crateEdgeMat: THREE.LineBasicMaterial | null = null;
  private wallGroup = new THREE.Group();
  private propGroup = new THREE.Group();
  private adGroup = new THREE.Group();
  private sceneryGroup = new THREE.Group();
  /** Optional scenery extras (windows, extra palms) — toggled by propDetail. */
  private sceneryMidGroup = new THREE.Group();
  private sceneryHighGroup = new THREE.Group();
  private instancedProps: THREE.InstancedMesh[] = [];
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
  private tracerFx: TracerSystem;
  private aimReticle: AimReticleSystem;
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
  private fxBudget = 1;
  private animLodFullDist = ANIM_LOD_FULL_DIST;
  private animLodMidDist = ANIM_LOD_MID_DIST;
  private propDetail = 1;
  private vignette!: THREE.Mesh;
  private wallTex!: THREE.CanvasTexture;
  private sandTex!: THREE.CanvasTexture;
  /** Limited-vision cull; from `ff_fog_enabled` (default true). */
  private fogEnabled = true;
  /** Fog only — quality knobs are owned by GameClient + QualityController. */
  private readonly onPrefsEvent = () => {
    this.fogEnabled = readFogEnabledPref();
  };
  private readonly onStorageEvent = (e: StorageEvent) => {
    if (e.key === null || e.key === FOG_ENABLED_KEY) {
      this.fogEnabled = readFogEnabledPref();
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

    // Larger maps need thinner fog so long angles stay readable (CS sightlines).
    const mapHalf = Math.max(map.size.width, map.size.depth) / 2;
    const fogDensity = Math.max(0.01, 0.018 * (24 / mapHalf));
    this.scene.fog = new THREE.FogExp2(map.fogColor, fogDensity);
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
    this.tracerFx = new TracerSystem(this.scene);
    this.aimReticle = new AimReticleSystem(this.scene);

    // Apply DPR / shadows / dust after lights & dust exist.
    this.applyQuality(this.quality);

    if (typeof window !== "undefined") {
      window.addEventListener("ff-prefs", this.onPrefsEvent);
      window.addEventListener("storage", this.onStorageEvent);
    }
  }

  /**
   * Apply graphics quality (runtime-safe knobs: DPR, shadows, dust, FX, LOD).
   * Antialias cannot toggle without recreating the WebGL context.
   */
  applyQuality(cfg: GraphicsQualityConfig = resolveQualityConfig()): void {
    this.quality = cfg;
    this.applyRuntimeKnobs(cfg);
  }

  /**
   * Apply effective runtime knobs from QualityController (or tier preset).
   * Safe to call every adaptation; skips no-op DPR/shadow rebuilds when possible.
   */
  applyRuntimeKnobs(knobs: RuntimeKnobs): void {
    this.quality = configFromRuntimeKnobs(knobs, this.quality.quality);
    this.propCastShadow = knobs.propCastShadow;
    this.fxBudget = knobs.fxBudget;
    this.animLodFullDist = knobs.animLodFullDist;
    this.animLodMidDist = knobs.animLodMidDist;
    this.propDetail = knobs.propDetail;

    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    this.renderer.setPixelRatio(Math.min(dpr, knobs.maxPixelRatio));

    this.renderer.shadowMap.enabled = knobs.shadowsEnabled;
    if (knobs.shadowType === "basic") {
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
    } else if (knobs.shadowType === "pcf") {
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
    } else {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.renderer.shadowMap.needsUpdate = true;

    if (this.sunLight) {
      this.sunLight.castShadow = knobs.shadowsEnabled;
      this.sunLight.shadow.mapSize.set(knobs.shadowMapSize, knobs.shadowMapSize);
      // Force shadow map rebuild at new resolution
      if (this.sunLight.shadow.map) {
        this.sunLight.shadow.map.dispose();
        this.sunLight.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      }
    }

    this.applyPropShadowFlag(knobs.propCastShadow);
    this.configureDust(knobs.dustCount, knobs.dustUpdateHz);
    this.applyShadowFrustum(knobs.propDetail);
    this.applySceneryLod(knobs.propDetail);
    this.applyFxDensity(knobs.fxBudget);
    // Tracers off when FX budget is low (covers low tier + auto degrade)
    this.tracerFx?.setEnabled(knobs.fxBudget >= 0.5);
    // Explosion debris scales with fxBudget (was tier-only)
    const debris =
      knobs.fxBudget < 0.5 ? 0 : knobs.fxBudget < 0.85 ? 8 : 16;
    this.heFx?.setDebrisBudget(debris);
  }

  private applyFxDensity(fxBudget: number): void {
    const d = fxDensityFromBudget(fxBudget);
    this.muzzleFx?.setDensity(d);
    this.impactFx?.setDensity(d);
    this.wallDamageFx?.setDensity(d);
    this.damageNumberFx?.setDensity(d);
  }

  /** Tighten directional shadow camera to map footprint (W1). */
  private applyShadowFrustum(propDetail: number): void {
    if (!this.sunLight) return;
    const half = shadowHalfExtent(
      this.map.size.width,
      this.map.size.depth,
      propDetail,
    );
    const cam = this.sunLight.shadow.camera;
    cam.near = 1;
    cam.far = Math.max(60, half * 2.4);
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.updateProjectionMatrix();
  }

  private applySceneryLod(propDetail: number): void {
    const d = Number.isFinite(propDetail) ? propDetail : 1;
    this.sceneryMidGroup.visible = d >= 1;
    this.sceneryHighGroup.visible = d >= 2;
    // Runtime prop kind filter (debris/poles hidden on detail 0)
    for (const mesh of this.instancedProps) {
      const kind = normalizePropKind(mesh.userData.propKind as string);
      mesh.visible = shouldIncludePropKind(kind, d);
    }
    this.propGroup.traverse((obj) => {
      if (obj.userData?.propKind) {
        const kind = normalizePropKind(obj.userData.propKind as string);
        obj.visible = shouldIncludePropKind(kind, d);
      }
    });
  }

  getRuntimeKnobs(): RuntimeKnobs {
    return {
      maxPixelRatio: this.quality.maxPixelRatio,
      shadowsEnabled: this.quality.shadowsEnabled,
      shadowMapSize: this.quality.shadowMapSize,
      shadowType: this.quality.shadowType,
      propCastShadow: this.quality.propCastShadow,
      dustCount: this.quality.dustCount,
      dustUpdateHz: this.quality.dustUpdateHz,
      fxBudget: this.fxBudget,
      animLodFullDist: this.animLodFullDist,
      animLodMidDist: this.animLodMidDist,
      propDetail: this.propDetail,
    };
  }

  getFxBudget(): number {
    return this.fxBudget;
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
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        // Keep receive; only toggle cast on prop meshes
        obj.castShadow = cast;
      }
    });
    for (const mesh of this.instancedProps) {
      mesh.castShadow = cast;
    }
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
    this.tracerFx.update(dt);
  }

  /** Bullet tracer muzzle → impact (or max range point). */
  spawnTracer(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
  ) {
    this.tracerFx.spawn(x0, y0, z0, x1, y1, z1);
  }

  /** Ground aim reticle (hide when dead / menus). */
  setAimReticle(x: number, z: number, visible: boolean) {
    this.aimReticle.setVisible(visible);
    if (visible) this.aimReticle.setPosition(x, z);
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
    const alivePlayerIds = this.syncAlivePlayers;
    const aliveBulletIds = this.syncAliveBullets;
    alivePlayerIds.clear();
    aliveBulletIds.clear();
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

      const rootY = p.y ?? 0;

      // Fog of war: local + same team always visible (if alive); enemies only within radius when on.
      let inVision = true;
      let distToLocal = 0;
      if (local) {
        distToLocal = Math.hypot(p.x - local.x, p.z - local.z);
      }
      if (
        this.fogEnabled &&
        local &&
        p.id !== local.id &&
        p.team !== local.team
      ) {
        inVision = distToLocal <= FOG_VISION_RADIUS;
      }
      handle.group.visible = p.alive && inVision;

      // Anim LOD: local always full; distant / culled bots cheaper.
      const lod = this.characterLod(
        p.id === snapshot.localPlayerId,
        p.alive && inVision,
        distToLocal,
      );

      // Far: position only (frozen pose) — skip weapon swap / controller / animator.
      if (lod === "far") {
        let lastFar = this.lastPos.get(p.id);
        if (!lastFar) {
          lastFar = { x: p.x, z: p.z, t: now };
          this.lastPos.set(p.id, lastFar);
        } else {
          lastFar.x = p.x;
          lastFar.z = p.z;
          lastFar.t = now;
        }
        handle.group.position.set(p.x, rootY, p.z);
        continue;
      }

      const cat = weaponCategoryOf(p.weaponId, p.weaponSlot);
      handle.setWeapon(cat);

      const last = this.lastPos.get(p.id);
      const dt = last ? Math.max(1 / 120, now - last.t) : 1 / 60;
      // World velocity from position delta (WASD result after collision).
      const moveX = last ? (p.x - last.x) / dt : 0;
      const moveZ = last ? (p.z - last.z) / dt : 0;
      if (last) {
        last.x = p.x;
        last.z = p.z;
        last.t = now;
      } else {
        this.lastPos.set(p.id, { x: p.x, z: p.z, t: now });
      }

      const shooting = this.shootFlags.has(p.id);
      const crouching = Boolean(p.crouching);
      const airborne = p.onGround === false;

      // CharacterController: body faces velocity when moving, aim when idle.
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
        lod,
      });

      // Foot SFX synced to walk-cycle plant (local player only — avoid spam).
      if (foot && p.id === snapshot.localPlayerId && p.alive) {
        Sfx.play("foot");
      }

      handle.group.position.set(p.x, rootY, p.z);
    }
    this.shootFlags.clear();

    const removeIds = this.syncRemoveIds;
    removeIds.length = 0;
    for (const id of this.characters.keys()) {
      if (!alivePlayerIds.has(id)) removeIds.push(id);
    }
    for (let i = 0; i < removeIds.length; i++) {
      this.removeCharacter(removeIds[i]!);
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

    removeIds.length = 0;
    for (const id of this.bulletMeshes.keys()) {
      if (!aliveBulletIds.has(id)) removeIds.push(id);
    }
    for (let i = 0; i < removeIds.length; i++) {
      this.releaseBulletMesh(removeIds[i]!);
    }

    this.updateCamera(snapshot);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Pick anim budget from distance / visibility (local always full). */
  private characterLod(
    isLocal: boolean,
    visible: boolean,
    dist: number,
  ): CharacterLod {
    return pickCharacterLod(
      isLocal,
      visible,
      dist,
      this.animLodFullDist,
      this.animLodMidDist,
    );
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
    this.tracerFx.dispose();
    this.aimReticle.dispose();
    for (const id of [...this.characters.keys()]) this.removeCharacter(id);
    this.renderer.dispose();
    this.sandTex.dispose();
    this.wallTex.dispose();
    this.bulletGeo.dispose();
    this.bulletMat.dispose();
    this.bulletPool.length = 0;
    this.bulletMeshes.clear();
    // Shared prop resources — dispose once (meshes only reference them).
    this.propGeo.box?.dispose();
    this.propGeo.barrel?.dispose();
    this.propGeo.pole?.dispose();
    this.propGeo.debris?.dispose();
    this.propGeo.wheel?.dispose();
    this.propGeo.box = null;
    this.propGeo.barrel = null;
    this.propGeo.pole = null;
    this.propGeo.debris = null;
    this.propGeo.wheel = null;
    this.crateEdgeMat?.dispose();
    this.crateEdgeMat = null;
    for (const m of this.propMatCache.values()) m.dispose();
    this.propMatCache.clear();
    this.instancedProps.length = 0;
    this.scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh ||
        obj instanceof THREE.Points ||
        obj instanceof THREE.InstancedMesh
      ) {
        // Skip shared prop / bullet assets (disposed above).
        if (obj.userData?.sharedResource) return;
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else (mat as THREE.Material).dispose();
      }
    });
  }

  // ─── world ───────────────────────────────────────────────

  private buildWorld() {
    // Brighter sky fill — RUSH-B sun-baked look
    const hemi = new THREE.HemisphereLight(0xc8e4ff, 0x9a7040, 0.55);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffe8cc, 0.38);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffe8c8, 1.85);
    sun.position.set(32, 42, 18);
    sun.castShadow = this.quality.shadowsEnabled;
    sun.shadow.mapSize.set(
      this.quality.shadowMapSize,
      this.quality.shadowMapSize,
    );
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
    this.sunLight = sun;
    this.applyShadowFrustum(this.propDetail);
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
      roughness: 0.92,
      metalness: 0.0,
      color: this.map.id === "favela" ? 0xc9a882 : 0xe8d0a8,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Scale environment to map size (72 maps → half ≈ 36)
    const half = Math.max(this.map.size.width, this.map.size.depth) / 2;

    // asphalt path strips (mid corridors)
    this.addRoad(0, 0, 5.5, half * 1.6, 0);
    this.addRoad(0, -half * 0.35, half * 1.1, 4.5, 0);
    this.addRoad(half * 0.35, half * 0.1, 4.2, half * 0.75, 0);
    this.addRoad(-half * 0.4, half * 0.2, half * 0.65, 4.2, 0);

    // Favela: open pitch near B/north
    if (this.map.id === "favela") {
      this.addSoccerPitch(0, half * 0.55, 11, 9);
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(half + 0.4, half + 14, 64),
      new THREE.MeshStandardMaterial({
        color: 0x5a8a4a,
        roughness: 1,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.03;
    this.scene.add(ring);

    const beach = new THREE.Mesh(
      new THREE.RingGeometry(half + 14, half + 28, 64),
      new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 1 }),
    );
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = -0.04;
    this.scene.add(beach);

    const ocean = new THREE.Mesh(
      new THREE.RingGeometry(half + 28, half + 55, 64),
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
      this.wallGroup.add(this.createBuildingBlock(w));
    }
    this.scene.add(this.wallGroup);

    this.buildProps();
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

  /**
   * Playable wall → house-like block: plaster walls + terracotta roof + windows.
   * Reads as favela/desert buildings instead of bare boxes (RUSH-B density).
   */
  private createBuildingBlock(w: {
    x: number;
    z: number;
    w: number;
    d: number;
    h?: number;
    color?: number;
  }): THREE.Group {
    const g = new THREE.Group();
    const h = w.h ?? 2.5;
    const color = w.color ?? 0xb89a6e;
    const isCover = h < 2.0;

    const mat = new THREE.MeshStandardMaterial({
      map: this.wallTex,
      color,
      roughness: 0.88,
      metalness: 0.02,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w.w, h, w.d), mat);
    body.position.set(w.x, h / 2, w.z);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    if (isCover) {
      // low cover — simple dark cap only
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(w.w + 0.08, 0.1, w.d + 0.08),
        new THREE.MeshStandardMaterial({ color: 0x4a4030, roughness: 0.85 }),
      );
      cap.position.set(w.x, h + 0.05, w.z);
      g.add(cap);
      return g;
    }

    // Terracotta / dark metal roof slab (overhang)
    const roofH = 0.28;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w.w + 0.45, roofH, w.d + 0.45),
      new THREE.MeshStandardMaterial({
        color: 0x6b3a28,
        roughness: 0.75,
        metalness: 0.08,
      }),
    );
    roof.position.set(w.x, h + roofH / 2 + 0.02, w.z);
    roof.castShadow = true;
    g.add(roof);

    // Ridge beam
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(w.w, w.d) * 0.15,
        0.12,
        Math.min(w.w, w.d) + 0.2,
      ),
      new THREE.MeshStandardMaterial({ color: 0x4a2818, roughness: 0.8 }),
    );
    if (w.w >= w.d) {
      ridge.scale.set(w.w / Math.max(w.w, w.d) + 0.5, 1, 1);
    }
    ridge.position.set(w.x, h + roofH + 0.08, w.z);
    g.add(ridge);

    // Window bands on long faces (cosmetic)
    const winMat = new THREE.MeshBasicMaterial({
      color: 0x1a2838,
      transparent: true,
      opacity: 0.65,
    });
    const longX = w.w >= w.d;
    const faceLen = longX ? w.w : w.d;
    const faceDepth = longX ? w.d : w.w;
    if (faceLen > 2.2 && h > 2.2) {
      const cols = Math.min(4, Math.max(1, Math.floor(faceLen / 2.2)));
      const rows = h > 3.2 ? 2 : 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ww = Math.min(0.7, faceLen / (cols + 1));
          const wh = 0.45;
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(ww, wh),
            winMat,
          );
          const along =
            -faceLen / 2 + (c + 1) * (faceLen / (cols + 1));
          const y = 1.1 + r * 1.15;
          if (longX) {
            win.position.set(w.x + along, y, w.z + faceDepth / 2 + 0.02);
          } else {
            win.rotation.y = Math.PI / 2;
            win.position.set(w.x + faceDepth / 2 + 0.02, y, w.z + along);
          }
          g.add(win);
        }
      }
    }

    // Door hint on wider buildings
    if (Math.min(w.w, w.d) > 1.5 && h > 2.4) {
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 1.1),
        new THREE.MeshBasicMaterial({
          color: 0x2a2018,
          transparent: true,
          opacity: 0.7,
        }),
      );
      if (w.w >= w.d) {
        door.position.set(w.x, 0.55, w.z + w.d / 2 + 0.02);
      } else {
        door.rotation.y = Math.PI / 2;
        door.position.set(w.x + w.w / 2 + 0.02, 0.55, w.z);
      }
      g.add(door);
    }

    return g;
  }

  /** Green pitch with white lines (favela campo). */
  private addSoccerPitch(x: number, z: number, w: number, d: number) {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        color: 0x4a9a3a,
        roughness: 0.95,
      }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(x, 0.04, z);
    grass.receiveShadow = true;
    this.scene.add(grass);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e0 });
    // outer box
    const mkLine = (lw: number, ld: number, lx: number, lz: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x + lx, 0.05, z + lz);
      this.scene.add(m);
    };
    mkLine(w - 0.3, 0.08, 0, -d / 2 + 0.15);
    mkLine(w - 0.3, 0.08, 0, d / 2 - 0.15);
    mkLine(0.08, d - 0.3, -w / 2 + 0.15, 0);
    mkLine(0.08, d - 0.3, w / 2 - 0.15, 0);
    // center line + circle (approx)
    mkLine(0.08, d - 0.4, 0, 0);
    const circle = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.22, 32),
      lineMat,
    );
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(x, 0.05, z);
    this.scene.add(circle);

    // goals
    const postMat = new THREE.MeshStandardMaterial({
      color: 0xe8e8e8,
      roughness: 0.5,
    });
    for (const side of [-1, 1] as const) {
      const gz = z + side * (d / 2 - 0.2);
      for (const sx of [-1.1, 1.1]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6),
          postMat,
        );
        post.position.set(x + sx, 0.7, gz);
        this.scene.add(post);
      }
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.08, 0.08),
        postMat,
      );
      cross.position.set(x, 1.4, gz);
      this.scene.add(cross);
    }
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

  /**
   * Tropical horizon backdrop.
   * Base always visible; mid = windows + extra palms; high = bushes.
   * Visibility toggled by {@link applySceneryLod} via propDetail.
   */
  private buildScenery() {
    this.sceneryMidGroup.name = "sceneryMid";
    this.sceneryHighGroup.name = "sceneryHigh";
    this.sceneryGroup.add(this.sceneryMidGroup);
    this.sceneryGroup.add(this.sceneryHighGroup);

    // Keep backdrop outside playable bounds for any map size (72 → half ≈ 36).
    const half = Math.max(this.map.size.width, this.map.size.depth) / 2;

    const buildingColors = [
      0xd4a574, 0xc97b63, 0x7a9eb5, 0xe8d5b0, 0xa8b89a, 0xe07060, 0x6a9a70,
    ];
    const roofColors = [0x5c3828, 0x6b4030, 0x4a3020, 0x703828];
    const buildingCount = 20;
    for (let i = 0; i < buildingCount; i++) {
      const ang = (i / buildingCount) * Math.PI * 2 + 0.15;
      const dist = half + 7 + (i % 4) * 2.5;
      const bx = Math.cos(ang) * dist;
      const bz = Math.sin(ang) * dist;
      const bh = 3.5 + (i % 5) * 1.2;
      const bw = 2.8 + (i % 3) * 0.8;
      const bd = 2.4 + (i % 2) * 0.6;
      const wallCol = buildingColors[i % buildingColors.length]!;
      // Outer half of buildings only on mid+ (cheap low: 10 blocks)
      const target = i < 10 ? this.sceneryGroup : this.sceneryMidGroup;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, bd),
        new THREE.MeshStandardMaterial({
          color: wallCol,
          roughness: 0.85,
        }),
      );
      b.position.set(bx, bh / 2 - 0.15, bz);
      b.castShadow = true;
      target.add(b);

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(bw + 0.5, 0.32, bd + 0.5),
        new THREE.MeshStandardMaterial({
          color: roofColors[i % roofColors.length],
          roughness: 0.7,
        }),
      );
      roof.position.set(bx, bh + 0.05, bz);
      roof.castShadow = true;
      target.add(roof);

      // windows only on mid+ (many draw calls)
      if (i < 10) {
        const winMat = new THREE.MeshBasicMaterial({
          color: 0x1a3040,
          transparent: true,
          opacity: 0.55,
        });
        for (let wy = 1.1; wy < bh - 0.6; wy += 1.15) {
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(bw * 0.55, 0.4),
            winMat,
          );
          win.position.set(bx, wy, bz + bd / 2 + 0.03);
          this.sceneryMidGroup.add(win);
        }
      }
    }

    // palms: 10 always, rest on mid — ring just outside walls
    for (let i = 0; i < 22; i++) {
      const ang = (i / 22) * Math.PI * 2;
      const dist = half + 3.5 + (i % 5) * 0.8;
      const palm = this.makePalm(
        Math.cos(ang) * dist,
        Math.sin(ang) * dist,
        0.9 + (i % 3) * 0.15,
      );
      (i < 10 ? this.sceneryGroup : this.sceneryMidGroup).add(palm);
    }

    // flowering bushes — high detail only
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + 0.4;
      const dist = half + 2 + (i % 3) * 0.4;
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.85 + (i % 3) * 0.25, 8, 6),
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0xd45a8a : 0x3d8a38,
          roughness: 0.9,
        }),
      );
      bush.position.set(Math.cos(ang) * dist, 0.55, Math.sin(ang) * dist);
      this.sceneryHighGroup.add(bush);
    }

    this.applySceneryLod(this.propDetail);
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

  /** Unit box shared by crates / containers / dumpsters / car parts (scaled). */
  private unitBoxGeo(): THREE.BoxGeometry {
    if (!this.propGeo.box) this.propGeo.box = new THREE.BoxGeometry(1, 1, 1);
    return this.propGeo.box;
  }

  private unitBarrelGeo(): THREE.CylinderGeometry {
    // Radius ~0.45–0.48 unit, height 1 — scale by w/h at mesh.
    if (!this.propGeo.barrel) {
      this.propGeo.barrel = new THREE.CylinderGeometry(0.48, 0.45, 1, 12);
    }
    return this.propGeo.barrel;
  }

  private unitPoleGeo(): THREE.CylinderGeometry {
    if (!this.propGeo.pole) {
      this.propGeo.pole = new THREE.CylinderGeometry(0.1, 0.08, 1, 6);
    }
    return this.propGeo.pole;
  }

  private unitDebrisGeo(): THREE.DodecahedronGeometry {
    if (!this.propGeo.debris) {
      this.propGeo.debris = new THREE.DodecahedronGeometry(0.45, 0);
    }
    return this.propGeo.debris;
  }

  private sharedPropMat(
    key: string,
    params: THREE.MeshStandardMaterialParameters = {},
  ): THREE.Material {
    const cheap = this.propDetail <= 0;
    const cacheKey = cheap ? `L:${key}` : key;
    let m = this.propMatCache.get(cacheKey);
    if (!m) {
      if (cheap) {
        m = new THREE.MeshLambertMaterial({
          color: params.color,
          transparent: params.transparent,
          opacity: params.opacity,
        });
      } else {
        m = new THREE.MeshStandardMaterial(params);
      }
      this.propMatCache.set(cacheKey, m);
    }
    return m;
  }

  private markShared(mesh: THREE.Mesh): THREE.Mesh {
    mesh.userData.sharedResource = true;
    return mesh;
  }

  /**
   * Batch simple props into InstancedMesh; complex multi-mesh props stay Groups.
   * Respects propDetail LOD (drops debris/poles on detail 0).
   */
  private buildProps(): void {
    this.instancedProps = [];
    type Batch = { kind: InstanceableKind; color: number; items: PropBox[] };
    const batches = new Map<string, Batch>();
    const complex: PropBox[] = [];

    for (const p of this.map.props) {
      const kind = normalizePropKind(p.kind);
      if (!shouldIncludePropKind(kind, this.propDetail)) continue;
      if (isInstanceableKind(kind)) {
        const key = propBatchKey(kind, p.color);
        let batch = batches.get(key);
        if (!batch) {
          batch = { kind, color: p.color, items: [] };
          batches.set(key, batch);
        }
        batch.items.push(p);
      } else {
        complex.push(p);
      }
    }

    const dummy = new THREE.Object3D();
    for (const batch of batches.values()) {
      const geo = this.geometryForInstanceKind(batch.kind);
      const mat = this.materialForInstanceKind(batch.kind, batch.color);
      const mesh = new THREE.InstancedMesh(geo, mat, batch.items.length);
      mesh.userData.sharedResource = true;
      mesh.userData.propKind = batch.kind;
      mesh.castShadow = this.propCastShadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;

      for (let i = 0; i < batch.items.length; i++) {
        const p = batch.items[i]!;
        dummy.position.set(p.x, p.h / 2, p.z);
        if (batch.kind === "debris") {
          const s = Math.max(p.w, p.d);
          dummy.scale.set(s, s, s);
          dummy.rotation.set(p.x * 0.7, p.z * 0.5, p.x + p.z);
        } else if (batch.kind === "barrel") {
          dummy.scale.set(p.w, p.h, p.d);
          dummy.rotation.set(0, 0, 0);
        } else {
          // crate / dumpster — unit box
          dummy.scale.set(p.w, p.h, p.d);
          dummy.rotation.set(0, 0, 0);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.propGroup.add(mesh);
      this.instancedProps.push(mesh);
    }

    for (const p of complex) {
      this.propGroup.add(this.createProp(p));
    }
  }

  private geometryForInstanceKind(
    kind: InstanceableKind,
  ): THREE.BufferGeometry {
    if (kind === "barrel") return this.unitBarrelGeo();
    if (kind === "debris") return this.unitDebrisGeo();
    return this.unitBoxGeo();
  }

  private materialForInstanceKind(
    kind: InstanceableKind,
    color: number,
  ): THREE.Material {
    const colorKey = (color >>> 0).toString(16);
    if (kind === "barrel") {
      return this.sharedPropMat(`barrel:${colorKey}`, {
        color,
        roughness: 0.5,
        metalness: 0.4,
      });
    }
    if (kind === "debris") {
      return this.sharedPropMat(`debris:${colorKey}`, {
        color,
        roughness: 0.95,
      });
    }
    if (kind === "dumpster") {
      return this.sharedPropMat(`dumpster:${colorKey}`, {
        color,
        roughness: 0.7,
        metalness: 0.25,
      });
    }
    return this.sharedPropMat(`crate:${colorKey}`, {
      color,
      roughness: 0.8,
    });
  }

  private createProp(p: GameMap["props"][number]): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(p.x, 0, p.z);
    const kind = p.kind ?? "crate";
    group.userData.propKind = kind;
    // Props are numerous — casting shadows is high-only (toggle via applyQuality).
    const cast = this.propCastShadow;
    const boxGeo = this.unitBoxGeo();
    const colorKey = (p.color >>> 0).toString(16);

    if (kind === "barrel") {
      const body = this.markShared(
        new THREE.Mesh(
          this.unitBarrelGeo(),
          this.sharedPropMat(`barrel:${colorKey}`, {
            color: p.color,
            roughness: 0.5,
            metalness: 0.4,
          }),
        ),
      );
      // Unit barrel r≈0.48 h=1 → scale to prop footprint / height
      body.scale.set(p.w, p.h, p.d);
      body.position.y = p.h / 2;
      body.castShadow = cast;
      body.receiveShadow = true;
      group.add(body);
    } else if (kind === "car") {
      // Body + cabin read better from iso cam (RUSH-B parked cars)
      const chassis = this.markShared(
        new THREE.Mesh(
          boxGeo,
          this.sharedPropMat(`car:${colorKey}`, {
            color: p.color,
            roughness: 0.38,
            metalness: 0.5,
          }),
        ),
      );
      chassis.scale.set(p.w, p.h * 0.48, p.d);
      chassis.position.y = p.h * 0.32;
      chassis.castShadow = cast;
      group.add(chassis);
      const cabin = this.markShared(
        new THREE.Mesh(
          boxGeo,
          this.sharedPropMat("car:cabin", {
            color: 0x152030,
            roughness: 0.2,
            metalness: 0.35,
            transparent: true,
            opacity: 0.9,
          }),
        ),
      );
      cabin.scale.set(p.w * 0.5, p.h * 0.5, p.d * 0.85);
      cabin.position.set(-p.w * 0.08, p.h * 0.78, 0);
      cabin.castShadow = cast;
      group.add(cabin);
      // hood stripe
      const hood = this.markShared(
        new THREE.Mesh(
          boxGeo,
          this.sharedPropMat(`car:hood:${colorKey}`, {
            color: p.color,
            roughness: 0.35,
            metalness: 0.55,
          }),
        ),
      );
      hood.scale.set(p.w * 0.42, p.h * 0.12, p.d * 0.9);
      hood.position.set(p.w * 0.22, p.h * 0.52, 0);
      group.add(hood);
      const wheelMat = this.sharedPropMat("car:wheel", {
        color: 0x111111,
        roughness: 0.9,
      });
      if (!this.propGeo.wheel) {
        this.propGeo.wheel = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 10);
      }
      const wheelGeo = this.propGeo.wheel;
      for (const [ox, oz] of [
        [-p.w * 0.3, p.d * 0.55],
        [p.w * 0.3, p.d * 0.55],
        [-p.w * 0.3, -p.d * 0.55],
        [p.w * 0.3, -p.d * 0.55],
      ] as const) {
        const wheel = this.markShared(new THREE.Mesh(wheelGeo, wheelMat));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(ox, 0.28, oz);
        group.add(wheel);
      }
    } else if (kind === "container") {
      const body = this.markShared(
        new THREE.Mesh(
          boxGeo,
          this.sharedPropMat(`container:${colorKey}`, {
            color: p.color,
            roughness: 0.55,
            metalness: 0.35,
          }),
        ),
      );
      body.scale.set(p.w, p.h, p.d);
      body.position.y = p.h / 2;
      body.castShadow = cast;
      body.receiveShadow = true;
      group.add(body);
      const ridge = this.markShared(
        new THREE.Mesh(
          boxGeo,
          this.sharedPropMat("container:ridge", {
            color: 0x111111,
            metalness: 0.5,
          }),
        ),
      );
      ridge.scale.set(p.w * 0.98, 0.08, p.d * 0.98);
      ridge.position.y = p.h + 0.02;
      group.add(ridge);
    } else if (kind === "debris") {
      const s = Math.max(p.w, p.d);
      const rock = this.markShared(
        new THREE.Mesh(
          this.unitDebrisGeo(),
          this.sharedPropMat(`debris:${colorKey}`, {
            color: p.color,
            roughness: 0.95,
          }),
        ),
      );
      rock.scale.setScalar(s);
      rock.position.y = p.h * 0.4;
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = cast;
      group.add(rock);
    } else if (kind === "pole") {
      const pole = this.markShared(
        new THREE.Mesh(
          this.unitPoleGeo(),
          this.sharedPropMat(`pole:${colorKey}`, {
            color: p.color,
            metalness: 0.5,
            roughness: 0.5,
          }),
        ),
      );
      pole.scale.set(1, p.h, 1);
      pole.position.y = p.h / 2;
      pole.castShadow = cast;
      group.add(pole);
      const wire = this.markShared(
        new THREE.Mesh(
          boxGeo,
          this.sharedPropMat("pole:wire", { color: 0x222222 }),
        ),
      );
      wire.scale.set(2.4, 0.03, 0.03);
      wire.position.set(1.0, p.h * 0.92, 0);
      group.add(wire);
    } else if (kind === "dumpster") {
      const body = this.markShared(
        new THREE.Mesh(
          boxGeo,
          this.sharedPropMat(`dumpster:${colorKey}`, {
            color: p.color,
            roughness: 0.7,
            metalness: 0.25,
          }),
        ),
      );
      body.scale.set(p.w, p.h, p.d);
      body.position.y = p.h / 2;
      body.castShadow = cast;
      group.add(body);
    } else {
      // crate (default) — unit box scaled; edge lines only on high quality
      const box = this.markShared(
        new THREE.Mesh(
          boxGeo,
          this.sharedPropMat(`crate:${colorKey}`, {
            color: p.color,
            roughness: 0.8,
          }),
        ),
      );
      box.scale.set(p.w, p.h, p.d);
      box.position.y = p.h / 2;
      box.castShadow = cast;
      box.receiveShadow = true;
      group.add(box);
      // Edge outlines are expensive — only at highest propDetail (rarely used for crates now that we instance).
      if (this.propDetail >= 2) {
        if (!this.crateEdgeMat) {
          this.crateEdgeMat = new THREE.LineBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.22,
          });
        }
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(boxGeo),
          this.crateEdgeMat,
        );
        edges.userData.sharedResource = true;
        edges.scale.set(p.w, p.h, p.d);
        edges.position.y = p.h / 2;
        group.add(edges);
      }
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
    mesh.userData.sharedResource = true;
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
