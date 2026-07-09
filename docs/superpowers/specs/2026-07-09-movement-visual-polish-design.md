# Movement & Visual Polish — Design

**Date:** 2026-07-09
**Status:** Approved by user
**Goal:** Make character movement feel fluid and grounded (no snap turns, no back-facing, no animation pops), make bullet impacts read as real hits, and raise visual fidelity of soldiers and environment to match the reference screenshot (isometric tactical shooter: textured sand, hard shadows, detailed low-poly soldiers with gear and team skins).

## Context

The codebase already solves the core "walks forward but shows back" (moonwalk) bug:

- `src/domains/fx/locomotion.ts` — pure math: `bodyYawTarget` (face velocity while moving, face aim while idle), `smoothYaw`, `locomotionWeights` (idle/forward/backward/strafeL/strafeR blend from angle between move vector and body facing), `MODEL_YAW_OFFSET_*` constants.
- `src/infrastructure/render/character/CharacterController.ts` — per-frame body yaw smoothing + clamped torso twist toward aim.
- `src/infrastructure/render/character/CharacterAnimator.ts` — procedural sin-wave locomotion on a box rig.
- `src/infrastructure/render/fx/ImpactParticleSystem.ts` — pooled sphere sparks/dust (480 individual meshes).

Confirmed remaining symptoms: robotic snap turns, occasional back-facing flicker, state-change animation pops, weak impact FX. Plus a visual-fidelity gap vs. the reference (procedural box rig, untextured world).

## Scope

Four workstreams, delivered in this order:

1. Movement orientation & animation blending polish
2. GLTF soldier characters with team skins
3. Impact FX upgrade
4. Environment visual upgrade

Out of scope: server/network changes, new gameplay mechanics, map layout changes.

## 1. Orientation polish

Files: `src/domains/fx/locomotion.ts` (+ tests), `src/infrastructure/render/character/CharacterController.ts`.

- **Velocity smoothing:** EMA (lambda ≈ 20) on the world move vector inside `CharacterController` before yaw/weight math. Kills frame-to-frame noise from snapshot position deltas — the root cause of aim/velocity target flicker ("shows back sometimes").
- **Move/idle hysteresis:** replace the single `DEFAULT_RUN_THRESHOLD` comparison with an enter/exit pair (enter moving at speed ≥ 0.6, exit at ≤ 0.3 world units/s). State lives in the controller; `bodyYawTarget` gains an explicit `moving` boolean parameter (pure function stays pure).
- **Turn-rate cap:** `smoothYaw` gains an optional `maxRadPerSec` parameter (default ≈ 12.5 rad/s ≈ 720°/s). Combined with lowering `TURN_LAMBDA` 14 → 9, a W→S reversal becomes a visible ~250 ms pivot instead of a 3-frame flip.
- All new math is pure and unit-tested in `locomotion.test.ts` (hysteresis transitions, rate cap at large deltas, NaN guards).

## 2. Animation blending polish

- **Per-channel weight smoothing:** exponential smoothing (~120 ms settle) of `LocomotionWeights`, renormalized to sum 1 while moving. State lives in `CharacterController`; the animator keeps receiving ready-to-use weights. Kills the 0→1 weight jumps ("pops").
- **Cadence smoothing:** EMA on the walk-cycle cadence in `CharacterAnimator` so phase speed ramps instead of jumping when speed changes.

## 3. Impact FX upgrade

File: `src/infrastructure/render/fx/ImpactParticleSystem.ts` — internal rewrite, public API `spawn(x, y, z, nx, ny, nz, surface)` unchanged.

- **Instanced rendering:** one `InstancedMesh` per particle kind (sparks, dust/smoke, flash) + a small decal pool. Cuts worst-case ~480 draw calls to ~4.
- **Stretched sparks:** elongated quads oriented along per-particle velocity, tapering with age. Warm additive palette (existing colors).
- **Muzzle-side flash at impact point:** one camera-facing additive quad, ~70 ms.
- **Smoke puff:** 2–3 billboards that grow and fade, 400–700 ms, surface-tinted (sand vs. wall).
- **Bullet-hole decals:** dark circular plane aligned to the surface normal, `polygonOffset` against z-fighting, pool of 64, FIFO reuse, fade-out after ~8 s.
- Particle budget stays ≤ 500 live particles.

## 4. GLTF soldier characters

New: low-poly rigged soldier replaces the procedural box rig as the default player visual.

- **Asset:** CC0 rigged low-poly military character (Quaternius or Kenney family; final pick during planning after inspecting actual clips and file size — target < 1 MB per model). Must include at least idle / walk-or-run clips; shoot clip nice-to-have.
- **Animation:** `THREE.AnimationMixer` per character. Clip weights driven by the existing `locomotionWeights()` output. If the asset lacks strafe clips, reuse the walk clip with a subtle hip yaw offset for strafe channels.
- **Orientation:** existing `CharacterController` output applies unchanged — `visualYaw` on the model root (using `MODEL_YAW_OFFSET_GLTF_NEG_Z = Math.PI` when the asset faces −Z), `torsoTwist` on the spine bone. This is the same anti-moonwalk correction, now on a real rig.
- **Team skins:** material/texture swap per team (CT vs. TR palette). Optional per-player tint variation.
- **Weapon attach:** adapt `WeaponAttach` to parent weapons to the model's hand bone.
- **Fallback:** the procedural rig stays in the codebase and is used if the GLTF fails to load (network error, decode error). Loading is async; characters spawn on the procedural rig and hot-swap when the GLTF is ready.

## 5. Environment visual upgrade

Match the reference: textured sand ground, hard directional shadows, dressed props.

- **Ground:** tileable sand texture (CC0, small JPG or KTX2), tone variation via a second low-frequency tint. 
- **Props:** wood texture on crates, corrugated shipping container, barrels. Simple geometry, light textures.
- **Lighting:** `DirectionalLight` with shadows (2048 map, PCFSoft), shadow casting limited to relevant meshes (players, crates, walls); ground receives only.
- **Existing billboards/ad posters** (`billboards.ts`) stay as-is.
- **Budget:** total new texture payload < 2 MB; static world geometry merged where practical to keep draw calls flat.

## Error handling

- All locomotion math keeps existing NaN/non-finite guards.
- GLTF load failure → procedural rig fallback, logged once.
- Decal/particle pools are fixed-size with FIFO reuse — no unbounded growth.

## Testing

- Unit tests (vitest): hysteresis enter/exit, turn-rate cap, weight smoothing normalization, decal pool FIFO.
- Manual verification in the browser: reproduce each original symptom (snap turn on W→S, back-facing flicker at low speed, blend pops, impact quality) and compare against the reference screenshot.

## Delivery order

1. Orientation + blending polish (sections 1–2) — small, immediately felt.
2. GLTF soldiers (section 4) — biggest visual jump.
3. Impact FX (section 3).
4. Environment (section 5).
