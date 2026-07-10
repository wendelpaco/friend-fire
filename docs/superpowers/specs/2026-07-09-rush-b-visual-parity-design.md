# Friend Fire — RUSH B Visual Parity Design

**Date:** 2026-07-09  
**Status:** Approved — S1–S7 implemented (S7 uses CesiumMan stand-in; replace with military GLB when ready)  
**Goal:** Close the “prototype vs shippable commercial top-down shooter” gap using RUSH B reference screenshots as the quality bar, without abandoning Three.js, performance tiers, or the current domain architecture.

**Reference set (user-provided stills):**
- RUSH B: main menu + region modal (ping BR/US), loading key art, buy grid with 3D-style icons, in-match C4 banner, tracers/croshair, rocket explosion + crate debris  
- Friend Fire: in-match ROUND 2 outdoor (procedural soldiers, sparser plaza, functional HUD)

**Related (do not re-litigate):**
- `2026-07-09-movement-visual-polish-design.md` — orientation, GLTF soldiers, impact, environment (partially shipped: orientation polish + perf)  
- `2026-07-09-combat-feedback-visual-design.md` — muzzle/impact/wall damage  
- Performance already shipped: quality tiers, bullet pool, dust throttle, anim LOD, shared prop geos  

---

## 1. Problem

Friend Fire already has the **right game loop** (top-down, buy phase, money, weapons, C4 rules, multiplayer). Side-by-side with RUSH B, a playtester still reads FF as **earlier**:

| Layer | RUSH B (ref) | Friend Fire today |
|-------|----------------|-------------------|
| Meta / brand | Full key art, mascot silhouette, rank chip, missions card | Solid dark UI; less “poster” energy |
| Loading | Full-bleed art + title | Minimal / system |
| Buy menu | Dense **icon grid**, weapon silhouettes, gear tiles | Emoji + text cards |
| Characters | Readable low-poly soldier + gun silhouette | Box-stack procedural |
| World | Roads, elevation cues, dense props, billboards as scenery | Cleaner walls; outdoor can feel empty |
| Combat read | Tracer line, croshair, explosion flash, **debris** | Muzzle/impact exist; weaker “hero FX” |
| Chrome | Tight HUD, phase labels (AQUECIMENTO N) | Functional; some browser chrome noise |

**Root cause:** not missing mechanics — missing **art direction density** and **readability of silhouette/FX/UI icons**, under a hard FPS budget.

**Success bar:** a cold viewer watching 10s of FF and 10s of RUSH B still sees the same *genre*, and rates FF ≥ **7.5/10** on “looks intentional / shippable” (today ~5–6).

---

## 2. Principles

1. **Parity of feel, not pixel clone** — no copyrighted assets; match composition, contrast, density, feedback timing.  
2. **Performance is a design constraint** — every visual feature maps to Low / Med / High (`ff_graphics_quality`). High may show edge outlines + full dust; Low never trades FPS for beauty.  
3. **Readability first** — soldier outline, weapon, bullet path, money, phase timer must read at isometric distance in <200 ms.  
4. **Reuse systems** — extend `BuyMenu`, `GameHud`, `ThreeRenderer`, FX pools; no new engine.  
5. **Asset budget** — new textures/models total **&lt; 3 MB** gzipped client payload for this track.  
6. **Portuguese UI copy** stays; visual language can be bilingual-neutral (icons > walls of text).

---

## 3. Workstreams (priority order)

### WS1 — UI / meta chrome (highest ROI / lowest risk)

**Why first:** screenshots show RUSH B winning before combat starts.

| Deliverable | Spec |
|-------------|------|
| **Buy menu grid** | 3–4 columns desktop; each tile: static **SVG or canvas icon** (weapon silhouette), name, `$price`, afford state. Drop emoji as primary. Footer: `B PARA FECHAR`. Header: `// COMPRAR` + money (already close). |
| **Phase banner** | Match RUSH “AQUECIMENTO N” / round pill: high-contrast amber bar, large tabular timer. |
| **C4 / bomb prompts** | Keep red banner pattern; ensure single high-contrast strip (already good). |
| **Main menu “poster”** | Optional full-bleed gradient + soldier **silhouette** (procedural canvas or static PNG CC0), not full 3D in menu. Rank chip top-right stays. Region modal already good — keep ping. |
| **Loading** | Simple branded load: dark bg + logo/title + spinner (no need for RUSH-level key art in v1). |
| **HUD polish** | Weapon slots as pill group with active gold border (FF close); ensure minimap frame matches amber system; hide non-game browser prompts where possible. |

**Out:** Cosmetics store, new mission types, expanding shop to bazuca/smoke unless product decides later (catalog scope separate).

### WS2 — Combat read (tracers, croshair, hero explosion)

**Why:** stills 7–10 sell “this is a shooter.”

| Deliverable | Spec |
|-------------|------|
| **World croshair** | Ground-projected aim marker (ring + cross) at aim hit on floor/walls — RUSH orange reticle feel. Client-only; no net. |
| **Tracer** | Short-lived line or stretched quad from muzzle to impact (or max range). Pool ≤ 16. Duration ~60–100 ms. High/Med only optional on Low (or simplified). |
| **Impact** | Keep existing sparks; ensure sand vs wall tint (already surface enum). |
| **Explosion “hero” FX** | One system for HE/rocket-class: flash sphere + radial dust + **8–16 debris boxes** (pooled, no shadow on Low). Reuse for HE grenade if rocket not in catalog. |
| **Screen juice (optional)** | Very light camera punch on explosion (≤ 0.08 units, 80 ms) — High only. |

**API:** extend `ThreeRenderer` / FX modules; fire from existing `spawnImpact` / HE paths.

### WS3 — Character silhouette (without waiting for full GLTF)

**Why:** box men are the #1 “prototype” signal in FF still #2.

| Phase | Spec |
|-------|------|
| **A — Silhouette pass (fast)** | Improve procedural rig: wider shoulders, helmet mass, backpack block, longer rifle mesh, stronger team color contrast (TR warm / CT cool). Soft **rim or outline** optional via second material or dark edge (High). |
| **B — GLTF path** | As in movement-visual-polish §4: CC0 low-poly soldier + mixer; fallback procedural. Team skins. |

Ship **A** in this track even if **B** is a follow-up PR.

### WS4 — Environment density (dress the set)

**Why:** RUSH maps feel “busy”; FF plazas can read empty.

| Deliverable | Spec |
|-------------|------|
| **Ground** | Stronger sand variation (existing canvas tex OK): add road paint, tire streaks, subtle dirt patches — still one material/atlas preferred. |
| **Props** | 20–40% more crates/barrels/poles **using shared geo path** already shipped (no new draw-call explosion). Prefer clusters (3-crate stacks). |
| **Vertical interest** | Keep existing buildings/scenery; add 2–4 low walls / ramps **only if collision updated** (maps + server walls). Prefer pure-visual props without collision first. |
| **Billboards** | Keep; ensure 2–3 high-contrast ads per map (already present on dust). |
| **Shadows** | Already tiered; do **not** force High shadows for density — use color contrast and AO fake (dark plane under props) on Low. |

**Non-goal:** full multi-floor CS maps or Rapier on server.

### WS5 — Audio-visual sync (light)

Foot plants, shoot, buy, plant/defuse already exist. Ensure new tracer/explosion have matching short SFX hooks if clips exist; else skip.

---

## 4. Performance mapping

| Feature | Low | Medium | High |
|---------|-----|--------|------|
| Buy icons | 2D SVG | 2D SVG | 2D SVG (+ optional subtle hover) |
| Croshair | on | on | on |
| Tracer | off or 1 thin line | on | on + brighter |
| Explosion debris | flash only | 8 debris | 16 debris + punch |
| Character outline | off | off | optional |
| Extra props | full set | full set | full set (shared geo) |
| Dust / shadows | existing low tier | med | high |

Anim LOD and quality prefs remain source of truth.

---

## 5. Architecture

```
presentation/
  BuyMenu.tsx          → icon tiles (WS1)
  GameHud.tsx          → phase chrome, croshair is 3D not HUD
  MainMenu.tsx         → poster background (WS1)
infrastructure/render/
  ThreeRenderer.ts     → croshair mesh, tracer spawn, env dress call sites
  fx/TracerSystem.ts   → NEW pooled tracers
  fx/ExplosionDebrisSystem.ts → NEW or extend HESystem
  character/           → silhouette pass A; later GLTF B
domains/
  combat/shop.ts       → unchanged catalog unless product adds items
  world/maps/*.ts      → more prop placements (WS4)
```

No Colyseus schema changes for pure cosmetics. Tracers/impacts remain client FX (local prediction + existing `fx_shot` for remote).

---

## 6. Acceptance criteria

### Visual QA (side-by-side checklist)

1. **Buy:** open B in warmup — tiles show weapon **icons**, not emoji as hero; money updates; unaffordable greyed.  
2. **Phase:** warmup/buy/live labels readable at a glance (RUSH-like weight).  
3. **Aim:** croshair visible on ground while mouse moves.  
4. **Shoot:** tracer or clear bullet path + impact; no multi-second lag.  
5. **HE/explosion:** flash + debris, crate debris readable once.  
6. **Soldier:** from isometric cam, team + weapon readable at 20–30 units.  
7. **Map:** outdoor dust no longer “empty plaza” — at least one prop cluster per major lane.  
8. **Perf:** Medium ≥ 50 FPS on M1/iGPU class in 10-player bot match with overlay on; Low ≥ 60.

### Automated

- Existing vitest suite green; new pure helpers (icon map, lod already tested) covered where cheap.  
- `tsc --noEmit` clean.  
- No new unbounded pools (hard caps documented in each FX class).

---

## 7. Out of scope (explicit)

- Cloning RUSH B brand/name/assets  
- Full shop expansion (bazuca, flash, smoke, mine) — product/catalog decision  
- Server-side VFX simulation  
- Photoreal lighting / SSR / post stack heavy bloom  
- Replacing Colyseus or Next shell  

---

## 8. Delivery slices (for plan)

| Slice | WS | Est. effort | Depends |
|-------|-----|-------------|---------|
| **S1** UI buy icons + phase chrome | 1 | S | — |
| **S2** Croshair + tracer | 2 | M | — |
| **S3** Procedural silhouette A | 3A | M | — |
| **S4** Explosion debris hero | 2 | M | HE path |
| **S5** Map prop density + ground dress | 4 | M | shared props (done) |
| **S6** Menu poster + loading brand | 1 | S | — |
| **S7** GLTF soldier B | 3B | L | S3 optional |

Recommended first PR stack: **S1 → S2 → S3 → S5 → S4 → S6**, S7 separate.

---

## 9. Open decisions (defaults if not answered)

| Topic | Default |
|-------|---------|
| Shop catalog expansion | **No** (icons for existing items only) |
| Croshair style | Orange ring + cross on ground |
| Outline on soldiers | High only, subtle dark edge |
| Menu art | Canvas gradient + simple silhouette (no external art license) |

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Icon art quality weak | Simple geometric silhouettes > emoji; consistent stroke |
| Debris kills FPS | Cap 16, no castShadow Low/Med, pool |
| Map props break collision | Visual-only props use no collider; collision props only via map schema |
| GLTF delays whole track | Ship silhouette A first |

---

**Next:** Implementation plan `docs/superpowers/plans/2026-07-09-rush-b-visual-parity.md`.  
After user approves this spec, execute slice-by-slice (multi-agent OK where files don’t conflict).
