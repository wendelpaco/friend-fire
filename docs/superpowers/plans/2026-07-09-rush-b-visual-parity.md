# RUSH B Visual Parity — Implementation Plan

> **For agentic workers:** Implement slice-by-slice. Prefer multi-agent only when file ownership does not overlap. TDD for pure helpers; visual slices verified with FPS overlay + manual QA checklist from the spec.

**Spec:** `docs/superpowers/specs/2026-07-09-rush-b-visual-parity-design.md`  
**Goal:** Ship UI + combat-read + silhouette A + map dress toward RUSH B quality bar under existing graphics quality tiers.

**Global constraints**
- Respect `ff_graphics_quality` (low / medium / high).  
- No unbounded FX pools; document caps.  
- No C4-in-shop / no RUSH brand assets.  
- `bun run test` + `bunx tsc --noEmit` green after each slice.  
- Comments English; UI strings Portuguese.  
- Do not regress crouch toggle / movement polish / perf work already on main.

---

## Slice S1 — Buy icons + phase chrome

**Files**
- Create: `src/presentation/game/shopIcons.tsx` (or `.ts` with SVG components)
- Modify: `src/presentation/game/BuyMenu.tsx`
- Modify: `src/presentation/game/GameHud.tsx` (phase label weight / AQUECIMENTO-style)

**Steps**
1. Map each `SHOP_CATALOG` id → simple SVG silhouette (glock, ak47, awp, armor, he, …).
2. Buy tiles: icon top, name, price; keep afford disable styles.
3. Footer hint: `B PARA FECHAR` (if not already).
4. Phase banner: larger type for warmup/buy (“AQUECIMENTO {n}” already similar — match weight/padding to ref).
5. Manual: open buy in warmup; unaffordable grey; money updates.

**Commit:** `feat(ui): shop weapon icons and phase chrome polish`

---

## Slice S2 — Ground croshair + tracers

**Files**
- Create: `src/infrastructure/render/fx/TracerSystem.ts`
- Create: `src/infrastructure/render/fx/AimReticleSystem.ts` (or both in one file if small)
- Modify: `src/infrastructure/render/fx/index.ts`
- Modify: `src/infrastructure/render/ThreeRenderer.ts` (`updateFx`, spawn on fire/impact)
- Modify: `src/infrastructure/render/GameClient.ts` (local fire → tracer; aim reticle each frame)

**Steps**
1. Aim reticle: ring + cross on ground plane at `aimWorldX/Z`; hide if dead/menu.
2. Tracer: pool ≤ 16 lines/quads; spawn muzzle→impact (or range end); life 80 ms.
3. Quality: Low may skip tracer or use thinner single line.
4. Wire local offline fire + network `fx_shot` for remote (optional remote tracer).
5. No server changes.

**Commit:** `feat(fx): aim reticle and bullet tracers`

---

## Slice S3 — Procedural silhouette A

**Files**
- Modify: `src/infrastructure/render/character/CharacterRig.ts`
- Modify: `src/infrastructure/render/character/WeaponAttach.ts`
- Optional: team color contrast in `createCharacter` / renderer

**Steps**
1. Bulk up torso/helmet/pack; leg proportions closer to “toy soldier.”
2. Longer rifle silhouette; pistol distinct.
3. TR/CT materials: warmer vs cooler base (keep team colors).
4. Do **not** break controller yaw / foot plant.
5. Optional High-only dark edge (skip if complex).

**Commit:** `feat(character): procedural soldier silhouette pass`

---

## Slice S4 — Explosion debris hero

**Files**
- Create or extend: `src/infrastructure/render/fx/HESystem.ts` / `ExplosionDebrisSystem.ts`
- Modify: `ThreeRenderer.spawnHE` / GameClient HE explode path

**Steps**
1. On explode: flash + N debris boxes (pool 16), gravity, short life, fade.
2. Low: flash only; Med: 8; High: 16 + optional camera punch.
3. No castShadow on debris (always).
4. Cap concurrent explosions.

**Commit:** `feat(fx): explosion debris and flash tiers`

---

## Slice S5 — Map prop density + ground dress

**Files**
- Modify: `src/domains/world/maps/dust.ts`, `yard.ts`, `favela.ts` (props only)
- Modify: `ThreeRenderer` ground/road paint if needed (subtle)

**Steps**
1. Add crate/barrel **clusters** on main lanes (shared geo path).
2. Prefer visual-only sizes already used; if new colliders needed, update collision lists in map helpers consistently client+server.
3. Ground: strengthen road dashes / dirt noise if cheap (canvas tex).
4. Do not bloat draw calls (no unique materials per prop).

**Commit:** `feat(maps): denser prop clusters and ground dress`

---

## Slice S6 — Menu poster + loading brand

**Files**
- Modify: `src/presentation/lobby/MainMenu.tsx`
- Optional: `src/app` loading UI if separate

**Steps**
1. Background: gradient + subtle grid/noise + soldier silhouette (CSS/SVG).
2. Keep existing buttons/missions/region.
3. Loading: title + spinner consistent with brand colors (amber/black).

**Commit:** `feat(ui): menu poster backdrop and load branding`

---

## Slice S7 — GLTF soldier (separate plan if large)

Defer to follow-up plan if S1–S6 land first. See movement-visual-polish §4.  
Do not block S1–S6 on asset pipeline.

---

## Multi-agent parallelization guide

| Parallel-safe | Conflict |
|---------------|----------|
| S1 (UI) ∥ S3 (rig) | S2 + S4 both touch FX/ThreeRenderer — serialize |
| S5 (maps) ∥ S1 | S2 then S4 sequential |
| S6 after S1 (shared visual language) | |

---

## Verification (each slice)

```bash
bun run test
bunx tsc --noEmit
```

Manual (overlay FPS on):
- Spec §6 checklist items for that slice only.

---

## Done when

S1–S6 merged (or stacked on main), checklist §6 pass on Medium quality, tests green. S7 tracked separately.
