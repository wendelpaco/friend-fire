# Friend Fire — Combat Feedback & Character Animation Design

**Status:** Draft for approval (post video analysis)  
**Date:** 2026-07-09  
**Branch context:** `feature/friend-fire-v1`  
**Reference:** [RUSH B demo — @wescld/status/2074522710852370541](https://x.com/wescld/status/2074522710852370541)  
**Related product spec:** `docs/superpowers/specs/2026-07-09-friend-fire-product-design.md`

---

## 1. Problem

Friend Fire already runs a **Three.js top-down (2.5D/3D) combat loop**, but combat and characters still feel like a prototype:

- Characters are mostly static box stacks (little locomotion).
- Shots are hitscan with weak muzzle feedback and almost no impact VFX.
- Walls never react to bullets (no hole, dust, or temporary chunk).

The reference video shows the same stack class (Three.js, browser, top-down) with **dense feedback**: walk pose, muzzle flash, impact sparks/dust, and **temporary wall damage that later regenerates**. That feedback gap is the main “realism” gap—not leaving Three.js.

### Goal

Ship a **combat feedback layer** that makes shooting, walking, and surface hits feel as legible and “alive” as the reference, while remaining:

- Procedural / low-asset (align with “almost no assets, textures for FX”)
- Performant at 60fps mid-range browsers
- Compatible with solo local sim and server-authoritative room mode
- Cosmetic wall damage only (collision topology stays stable)

### Non-goals

- Full physical destruction of navigation mesh / permanent map holes  
- Photoreal humanoids or Mixamo-grade faces  
- GPU particle engine dependency (keep Three.js built-ins / small custom systems)  
- Server-side particle simulation (VFX are client-predicted + optional hit events)

---

## 2. Reference findings (locked from analysis)

Video: ~14.1s, 60fps, 3804×2160, Three.js, ambient particles, camera control, refined map.

| System observed | Behavior in reference |
|-----------------|------------------------|
| **Dimension** | 3D top-down isometric; not 2D sprites |
| **Character** | Low-poly humanoid; walk cycle / combat stance; weapon silhouette in hand |
| **Muzzle** | Bright short flash at barrel (1–2 frames visual) |
| **Impact** | Orange/yellow sparks + dust at wall/ground hit; scorch marks |
| **Wall chunk** | Local “missing piece” / crater look on surface |
| **Regen** | Chunk/mark does not permanently redefine the map (user intent: restores after delay) |
| **Ammo UI** | Mag count drops per shot (feedback consistency) |
| **Atmosphere** | Strong vignette, floating dust, long shadows |

Author note (thread): almost no classic game assets; textures mainly for explosion/FX.

---

## 3. Product decisions

| Decision | Choice |
|----------|--------|
| Stack | Stay on **Three.js** + existing domains |
| Character style | **Stylized low-poly animatable rig** (procedural first; GLB optional later) |
| Wall damage | **Cosmetic only** — does not open walkable gaps |
| Regen | Default **5s** fade/despawn of chunk; decal may last longer or same |
| Authority | Simulation of hits remains local or server hitscan; **VFX always client-side** |
| Scope phases | P0 impact+muzzle → P1 locomotion → P2 weapon swap visuals |

---

## 4. Architecture

### 4.1 New / extended modules

```
src/domains/fx/                 # pure types + rules (no Three)
  types.ts                      # ImpactKind, DecalSpec, ChunkSpec, lifetimes
  wallDamage.ts                 # createImpact, shouldExpire, no collision change
  locomotion.ts                 # speed → anim state (idle|run)

src/infrastructure/render/
  fx/
    MuzzleFlashSystem.ts
    ImpactParticleSystem.ts
    WallDamageSystem.ts         # decals + temporary chunk meshes
  character/
    CharacterRig.ts             # hierarchical Object3D bones
    CharacterAnimator.ts        # idle/run/shoot overlay
    WeaponAttach.ts             # knife | pistol | rifle meshes on hand
  ThreeRenderer.ts              # orchestrates FX + characters
  GameClient.ts                 # emits hit events into renderer
```

### 4.2 Dependency rules

- `domains/fx` and `domains/combat` stay free of Three/React.
- Renderer consumes **events** from sim:

```ts
type FxEvent =
  | { type: "muzzle"; x: number; z: number; rot: number; weaponId: string }
  | { type: "impact"; x: number; y: number; z: number; nx: number; ny: number; nz: number; surface: "wall" | "ground" | "prop" }
  | { type: "footstep"; x: number; z: number }; // optional dust
```

- Server room mode: on fire, client still spawns muzzle locally; on confirmed hit (or local raycast for wall-only), client spawns impact. Wall VFX need not be networked in v1 (each client can raycast walls identically for cosmetics).

### 4.3 Hit pipeline (local solo)

```
tryShoot / bullet update
  → if wall/prop hit: resolve point + normal
  → emit impact FX
  → register temporary wall damage id (renderer)
  → do NOT mutate mapCollisionWalls
```

### 4.4 Hit pipeline (networked)

```
input.fire → server hitscan (players)
client: always muzzle on local fire
client: raycast walls for cosmetics (same map geometry)
// optional later: server sends impact events for consistency
```

---

## 5. System specs

### 5.1 Muzzle flash

| Param | Value |
|-------|--------|
| Duration | 40–60 ms |
| Visual | Additive yellow-white mesh or billboard + optional PointLight |
| Position | hand/gun tip along facing (`sin(rot)`, `cos(rot)`) * offset |
| Light | intensity peak then 0 within same window |
| Audio | existing `Sfx.play("shoot")` timed with flash |

### 5.2 Impact particles

| Param | Value |
|-------|--------|
| Sparks | 6–14 particles, velocity along normal + random cone, life 150–350 ms, color warm |
| Dust | 4–10 brown/tan particles, gravity, life 300–600 ms |
| Ground vs wall | dust heavier on ground; sparks heavier on wall |
| Cap | max 40 concurrent impact bursts (pool/reuse) |

### 5.3 Wall decals

| Param | Value |
|-------|--------|
| Size | 0.12–0.22 m quad |
| Look | dark scorch / hole texture (canvas procedural OK) |
| Placement | slightly offset along normal to avoid z-fight |
| Life | 8–12 s fade, or match chunk life |
| Cap | max 80 decals; oldest removed |

### 5.4 Temporary wall chunk (“tira pedaço”)

| Param | Value |
|-------|--------|
| Shape | small box or irregular convex (2–4 boxes) inset into wall |
| Size | ~0.15–0.35 m |
| Material | darker than wall, high roughness |
| Life | **5.0 s** default then fade 0.4 s |
| Collision | **none** (visual only) |
| Stacking | multiple chunks per wall allowed; cap 40 active |
| Regen | remove mesh → wall looks intact again |

**Explicit:** never subtract from `mapCollisionWalls` / server walls.

### 5.5 Character rig (procedural)

Bones (Object3D hierarchy):

```
root
  hips
    legL, legR
  torso
    armL, armR
      handR → weaponSlot
    head
      helmet
```

| Anim | Rules |
|------|--------|
| Idle | micro bob on torso Y; arms ready |
| Run | `legL.rot.x = sin(t)*A`, `legR = -legL`; arms opposite phase; stride speed scales with `speed` |
| Shoot overlay | brief arm/torso kick opposite aim (80–120 ms) |
| Knife mode | `weaponSlot` shows knife mesh; gun hidden |
| Pistol/rifle | swap mesh by `weaponId` category |

Locomotion state machine:

```
speed < 0.3 → idle
speed >= 0.3 → run
```

`speed` = horizontal displacement / dt (local prediction or server-corrected position delta).

### 5.6 Weapon attach

| Category | Examples | Mesh |
|----------|----------|------|
| knife | faca | short blade box/group |
| pistol | glock, usp, deagle | compact gun |
| rifle | ak, galil, mp5, awp | longer gun |

On `weaponSlot` / network loadout change: update `weaponSlot` child mesh within 1 frame.

---

## 6. Integration points

| File / area | Change |
|-------------|--------|
| `GameClient.tryShoot` / bullet wall hit | emit impact + muzzle events |
| Server hitscan (players only) | unchanged for wall FX (client cosmetic ray optional) |
| `ThreeRenderer.sync` | update character anims from player vel + weapon |
| `ThreeRenderer` wall build | keep static walls; FX layers separate groups |
| Sfx | shoot/hit already; optional surface impact click |

### 6.1 Solo vs room

| Mode | Character anim | Muzzle | Wall FX |
|------|----------------|--------|---------|
| Local | from local velocity | local fire | local wall ray / bullet collide |
| Networked | from position delta + input | local fire | local wall ray for cosmetics |

---

## 7. Performance budgets

| Budget | Limit |
|--------|--------|
| FX particles total | ≤ 500 sprites/points |
| Active wall chunks | ≤ 40 |
| Active decals | ≤ 80 |
| Character bones per player | ≤ 12 |
| Extra draw calls per shot | prefer pooled meshes |

If over budget: skip oldest decals/chunks first; reduce spark count.

---

## 8. Phased delivery

### P0 — “O tiro existe” (must ship first)

1. Muzzle flash system  
2. Impact sparks + dust  
3. Wall decals  
4. Temporary chunk + 5s regen  
5. Wire from bullet/wall collision path  

**Exit criteria:** shooting a wall produces flash, sparks, hole mark, visible chunk that disappears ~5s later; 60fps on reference laptop; `npm test` + build green.

### P1 — “O boneco vive”

1. CharacterRig replaces box player mesh  
2. Idle + run cycles  
3. Shoot recoil overlay  
4. Footstep dust optional  

**Exit criteria:** walking shows leg cycle; stop returns to idle; no T-pose slide.

### P2 — “Arma na mão”

1. WeaponAttach by category  
2. Knife pose + mesh swap on slot 4  
3. Reload pose stub (optional clip)  

**Exit criteria:** switching 1/2/4 changes held item silhouette clearly from top-down.

### P3 — Polish (optional)

- Shell casings  
- Camera 180 snap polish  
- Network impact events  
- GLB upgrade path  

---

## 9. Testing

| Layer | Cases |
|-------|--------|
| Unit | `wallDamage`: expire after life; caps; no collision mutation helpers |
| Unit | `locomotion`: speed thresholds idle/run |
| Manual | Solo: spray wall → chunks → wait regen |
| Manual | Walk in circle → leg cycle visible |
| Manual | Slot 4 knife → mesh change; fire muzzle on pistol |
| Manual | Room mode: both clients see own wall FX; no desync crash |

---

## 10. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Z-fighting decals | bias along normal 0.01–0.03 |
| Chunk looks like real hole (players walk “through”) | keep collision solid; don’t oversize chunks |
| Perf drop with 6 players spraying | pools + hard caps |
| Networked double FX | don’t server-spam particles; cosmetic local only |
| Procedural anim looks silly | tune amplitudes; top-down hides a lot of sin-wave |

---

## 11. Success metrics (qualitative)

- Side-by-side with reference video: **readable muzzle + impact + wall scar**  
- Character no longer “ice skates”  
- Knife vs gun readable in &lt;0.5s  
- No collision bugs introduced by wall VFX  

---

## 12. Open parameters (defaults locked for plan)

| Param | Default |
|-------|---------|
| Chunk life | 5.0 s |
| Decal life | 10.0 s |
| Muzzle life | 0.05 s |
| Max chunks | 40 |
| Max decals | 80 |
| Run speed threshold | 0.3 m/s |

---

## 13. Approval gate

This document defines **what** to build for combat feedback parity with the analyzed X video.

**Next after user approval:**

1. Implementation plan under `docs/superpowers/plans/` (P0→P2 tasks, ≤3 agents per phase recommended)  
2. Implementation starting at **P0 wall + muzzle + impact**  

**Does not authorize implementation until this spec is explicitly approved.**

---

## 14. Self-review checklist

- [x] No TBD blockers for P0–P2  
- [x] Cosmetic wall damage explicit (no collision change)  
- [x] Solo + networked paths defined  
- [x] Performance caps defined  
- [x] Reference post linked  
- [x] Phases ordered by player-visible ROI  
