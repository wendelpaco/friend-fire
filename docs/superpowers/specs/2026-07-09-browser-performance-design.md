# Friend Fire — Browser Performance Design

**Status:** Implemented (W0–W5)  
**Date:** 2026-07-09  
**QA checklist:** `docs/performance-measurement.md`  
**Branch:** `main` (or feature branch as needed)  
**Context:** Free browser tactical shooter (Three.js + Colyseus). Performance is a product requirement, not a polish pass.

---

## 1. Problem & goal

Friend Fire runs entirely in the browser. Retention and ad inventory depend on the match feeling fluid on **typical BR laptop hardware**, not only on developer machines.

The project already has useful foundations:

- Graphics tiers `low` / `medium` / `high` (`domains/prefs/quality.ts`) controlling DPR cap, shadows, dust, antialias
- FPS overlay (FPS + draw calls + triangles)
- Character anim LOD (`full` / `mid` / `far`) and fog vision culling
- Shared prop geometries/materials, bullet mesh pool, dust update throttling

Gaps:

- No measured frame-time SLOs (p50/p95)
- No auto adaptation when the machine cannot hold the chosen tier
- Props are individual meshes (draw-call pressure)
- Fat main-thread loop (`GameClient` + render + FX + React HUD)
- No wave-based performance program with exit criteria

### Product decisions (locked)

| Topic | Choice |
|-------|--------|
| Success model | **Measured SLOs** (not “feels smooth”) |
| Adaptation | **Auto-quality + fine knobs** (DPR, shadows, FX, LOD, etc.) |
| Scope shape | **Multi-wave program** with exit criteria per wave |
| Hardware matrix | **Reference / Floor / Ceiling** profiles |
| Architecture approach | **Perf as infrastructure** (Frame Budget + QualityController) |

### Non-goals (v1 performance program)

- WebGPU renderer migration
- Full simulation in Web Worker (only revisit if Floor SLO fails after W2)
- Heavy glTF asset pipeline (props are procedural/primitives today)
- Production remote telemetry backend (optional local JSON export in W5 only)
- Ultra / RT shadows / heavy post stack
- Pixel-perfect visual parity across quality tiers (tiers **must** diverge)
- CI headless WebGL FPS benchmarks (flaky; optional later)

---

## 2. Architecture

### 2.1 Approach: Perf as infrastructure

A **Frame Budget System** owns sampling, aggregation, and knob decisions. Render and sim code **apply** knobs; they do not invent their own ad-hoc quality logic.

```
GameClient rAF loop
  t0 → sim / network / bots
  t1 → three.sync + updateFx
  t2 → three.render()
  t3 → hud snapshot (throttled)
       │
       ▼
FrameSampler  → rolling window (e.g. 120 frames)
       │         frameMs, cpuMs, renderMs
       ▼
PerfMetrics   → fps, p50, p95, drawCalls, triangles
       │
       ▼
QualityController
  input:  userTierMax + autoEnabled + metrics
  output: RuntimeKnobs (effective)
       │
       ▼
ThreeRenderer.applyRuntimeKnobs(knobs)
```

### 2.2 Component boundaries

| Unit | Responsibility | Must not |
|------|----------------|----------|
| **FrameSampler** | Timestamp marks; sliding window | Decide quality |
| **PerfMetrics** | Aggregate p50/p95/FPS/draw stats | Touch Three.js |
| **QualityController** | Hysteresis, cooldowns, sacrifice order, user cap | Implement rendering |
| **RuntimeKnobs** | Immutable effective knob contract | Persist by itself |
| **ThreeRenderer** | Apply knobs (generalize `applyQuality`) | Compute p95 |
| **Prefs (domain)** | User intent: tier cap, auto on/off, show FPS | Hold “effective” runtime state |

### 2.3 Repository layout

```
src/domains/prefs/           # presets + user intent (extend existing)
src/infrastructure/perf/     # NEW: sampler, metrics, controller, types
src/infrastructure/render/
  GameClient.ts              # instrument loop; tick controller
  ThreeRenderer.ts           # applyRuntimeKnobs
src/presentation/game/
  SettingsPanel.tsx          # auto-quality UX
  GameHud.tsx                # enriched perf overlay
```

Domain `prefs` stays pure (localStorage intent). Adaptation lives under `infrastructure/perf` (depends on rAF / wall clock).

### 2.4 RuntimeKnobs

User tier remains a **preset ceiling**. The controller emits effective knobs (discrete levels, not free floats every frame):

| Knob | Role |
|------|------|
| `maxPixelRatio` | DPR cap (e.g. 1.0 → 1.25 → 1.5 → 2.0) |
| `shadowsEnabled`, `shadowMapSize`, `shadowType` | Shadow cost |
| `propCastShadow` | Expensive prop shadow casters |
| `dustCount`, `dustUpdateHz` | Atmospheric particles |
| `fxBudget` | 0–1 scale for combat FX density / max particles / decals |
| `animLodFullDist`, `animLodMidDist` | Character anim LOD bands |
| `propDetail` | W1+: instancing / prop LOD / cast policy |

**Invariant:** `effectiveKnobs ⊆ allowedBy(userTierMax)`.  
Example: user on **medium** never gets `maxPixelRatio: 2` or `propCastShadow: true`.

`GraphicsQualityConfig` / tier presets map to **maximum levels** per axis. Auto-quality only lowers (or restores up to) those levels.

### 2.5 Loop integration (intent)

```ts
// Pseudocode — design intent, not final API
const t0 = performance.now();
update(dt);
const t1 = performance.now();
three.sync(...);
three.updateFx(dt);
three.render();
const t2 = performance.now();

sampler.push({ frameMs: t2 - t0, cpuMs: t1 - t0, renderMs: t2 - t1 });
const metrics = sampler.snapshot(); // every N frames or ~500ms
const next = controller.tick(metrics, userTierMax, autoEnabled);
if (next.changed) three.applyRuntimeKnobs(next.knobs);
```

Antialias stays fixed at WebGL context creation (cannot toggle without recreating the context).

### 2.6 Prefs (localStorage)

| Key | Default | Meaning |
|-----|---------|---------|
| `ff_graphics_quality` | `medium` | User **ceiling** tier (existing) |
| `ff_auto_quality` | `true` | Enable QualityController |
| `ff_show_fps` | `false` | Perf overlay (existing; enriched) |

When `ff_auto_quality = false`, knobs equal the exact tier preset (current behavior).

---

## 3. SLOs & hardware profiles

### 3.1 Official profiles

| Profile | Who | Viewport | Target tier | Hard SLO |
|---------|-----|----------|-------------|----------|
| **Reference** | Laptop iGPU ~2020–2022, stable Chrome | **1920×1080** | **medium** ceiling | p95 `frameMs` ≤ **16.7** (~60 FPS) |
| **Floor** | Weak laptop / old iGPU | **1366×768** or 1080p with DPR cap | **low** | p95 `frameMs` ≤ **22.2** (~45 FPS) |
| **Ceiling** | Desktop dGPU or Apple Silicon | Native, DPR up to 2 | **high** | p95 ≤ **16.7** with full high knobs |

### 3.2 Measurement protocol

- Measure in a **live match** with ≥8 players/bots and active combat (shots + FX), not lobby-only.
- Continuous sample **≥30 s**; report **p50 and p95** of `frameMs` (not average FPS alone).
- DevTools open / non-official “debug runs” do not count as pass/fail.
- **3 s warm-up** after scene load before the metric window.
- Prefer measuring with the official overlay or W5 local export.

### 3.3 Internal sub-budgets (guidance, not hard-fail in W0)

| Slice | Reference (medium) | Floor (low) | Guides wave |
|-------|--------------------|-------------|-------------|
| **frameMs p95** | ≤ 16.7 | ≤ 22.2 | Hard SLO |
| **cpuMs** (sim+bots+input) | ≤ 6 | ≤ 10 | W2 |
| **renderMs** (sync+FX+WebGL) | ≤ 10 | ≤ 12 | W1 |
| **draw calls** (order of magnitude) | ≤ ~150–200 | ≤ ~80–120 | W1 GPU |
| **triangles** | trend / regression | same | W1 |

Pass/fail for a profile is always **p95 frameMs**. Draw/tris are engineering targets.

### 3.4 Discrete knob levels

Controller steps discrete levels 0…N per axis, mapped to concrete values. Tier presets define **max level** per axis.

Illustrative mapping (implementation may tune values; order and ceilings are normative):

| Axis | Cheap (N0) | … | Expensive (Nmax, tier-capped) |
|------|------------|---|-------------------------------|
| pixelRatio | 1.0 | 1.25 | 1.5 / 2.0 (high only) |
| shadows | off | basic 512 | pcf 1024 / pcfsoft 2048 + prop cast |
| dust | 0 | 100 @ 20 Hz | 280 @ 60 Hz |
| fxBudget | 0.35 | 0.7 | 1.0 |
| animLod | full 8 / mid 16 | full 14 / mid 24 (current) | full 18 / mid 28 |
| propDetail (W1+) | instanced low | full mid | cast shadows high |

### 3.5 QualityController hysteresis

**Goal:** no flicker (shadows/DPR thrashing every few seconds).

**Evaluation cadence:** every **1.0 s** (not every frame).

**Degrade** (frame too expensive):

1. If p95(`frameMs`) over the recent **2–3 s** window is **> targetMs × 1.15** for **2 consecutive evaluations** → drop **1 step** on the next sacrifice axis.
2. **Cooldown after degrade: 4 s.**

**Upgrade** (headroom):

1. If p95 **< targetMs × 0.85** and p50 **< targetMs × 0.75** for **4 consecutive evaluations** (~4 s) → raise **1 step**.
2. **Cooldown after upgrade: 6 s** (more conservative than degrade).

**targetMs by user ceiling:**

| `userTierMax` | `targetMs` |
|---------------|------------|
| high | 16.7 |
| medium | 16.7 |
| low | 22.2 |

**Sacrifice order (degrade first):**

1. `fxBudget`
2. `dust`
3. `animLod` (shorten full/mid distances)
4. `pixelRatio`
5. `shadows` (soft → pcf → size down → off)
6. `propDetail` / prop cast (W1+)

**Restore order (upgrade first):**

1. `pixelRatio`
2. `shadows`
3. `propDetail`
4. `animLod`
5. `dust`
6. `fxBudget`

Rationale: under stress, cut particles first; when recovering, restore sharpness and lighting before polish FX.

### 3.6 Safety states

| Situation | Behavior |
|-----------|----------|
| Load / first 3 s | Sampler runs; **controller does not adapt** |
| `document.hidden` | Pause adaptation; do not upgrade while rAF is throttled |
| Manual tier change | Reset knobs to new tier preset; clear cooldowns; **3 s grace** |
| Extreme stress (p95 > 33 ms for 5 s) | Force step-down toward low-floor knobs; overlay may show `AUTO ↓` |
| Auto off | Fixed preset; no adaptation |

### 3.7 Explicit non-SLOs (for now)

- 60 FPS at 4K Retina high
- Pixel-perfect parity across tiers
- Production population percentiles (future optional remote telemetry)
- Formal input-lag / audio-latency SLOs

---

## 4. Implementation waves

### Dependency graph

```
W0 (foundation) ──► W1 (GPU) ──► W2 (CPU) ──► W3 (HUD)
                       │                      │
                       └──────────► W4 (net) ─┘
                                │
                                ▼
                              W5 (harness + polish)
```

**W0 is a hard gate.** Suggested merge order: W0 → W1 → (W3 quick wins if HUD is hot) → W2 → W4 → W5.

### W0 — Foundation (Frame Budget + Auto-quality)

**Goal:** instrument the loop and adapt knobs with hysteresis; no scene micro-opts required.

| Deliverable | Detail |
|-------------|--------|
| `infrastructure/perf/*` | FrameSampler, PerfMetrics, QualityController, types |
| Loop integration | Timestamps in GameClient rAF; `applyRuntimeKnobs` |
| Prefs | `ff_auto_quality` default `true`; tier = ceiling |
| Overlay | FPS, p50/p95, draws, tris, effective knobs, AUTO state |
| Unit tests | Hysteresis, user cap, sacrifice order, prefs parse |
| Config surface | Extend quality config with fine knobs (`fxBudget`, anim LOD distances) even if only partially applied |

**Likely files:** `src/infrastructure/perf/**`, `GameClient.ts`, `ThreeRenderer.ts`, `domains/prefs/*`, `SettingsPanel.tsx`, `GameHud.tsx`, `game/types.ts`.

**Exit criteria:**

- Overlay shows real p95
- Under stress, knobs drop in sacrifice order
- User medium never receives high-only knobs
- Auto off → fixed preset
- No flicker over 60 s soak (cooldowns hold)

**Out of W0:** instancing, material swaps, workers, remote telemetry.

### W1 — GPU / draw path

**Goal:** reduce fill-rate and draw calls on Reference medium.

| Deliverable | Detail |
|-------------|--------|
| Prop instancing / batching | Homogeneous kinds → `InstancedMesh` where safe |
| Shadow budget | Tighten sun shadow camera to top-down useful volume; size via knobs |
| FX pools / caps | Scale max active FX by `fxBudget` |
| Materials | Consider cheaper materials for distant/low props; keep Standard where it matters |
| Prop LOD / cull | Skip cast/draw for far or off-cone props |
| Wire `propDetail` into controller | Degrade/restore per §3.5 |

**Exit criteria:**

- Reference medium combat 30 s: **p95 ≤ 16.7 ms**, or documented gap ≤ 2 ms with follow-up issue
- Draw calls within medium band
- Low remains readable (no absurd prop pop in FOV)

**Risks:** instancing breaks special props; shadow cropping; high-tier visual regression.

### W2 — Main-thread / CPU sim

**Goal:** fit `cpuMs` on Floor without starving render; local player always full rate.

| Deliverable | Detail |
|-------------|--------|
| Stable cpu/render split in sampler | Reliable sub-metrics |
| Bot update scaling | Far bots lower Hz without breaking local authority |
| Character sync | Skip more work on LOD `far` |
| Allocation hygiene | Reduce churn in `update` (reuse arrays/snapshots) |
| Physics | Avoid redundant per-frame work |

**Exit criteria:**

- Floor low: **p95 ≤ 22.2 ms** with full map + bots
- `cpuMs` p95 within Floor band
- Local input feel unchanged

**Out of W2:** full Worker sim (spike only if Floor still fails).

### W3 — React / HUD

**Goal:** presentation layer must not own the frame budget.

| Deliverable | Detail |
|-------------|--------|
| HudSnapshot throttle | e.g. 10–15 Hz for counters; immediate for hit/kill/banner |
| Component split / memo | Avoid full GameHud re-render every frame |
| Perf overlay refresh | ≤ ~4 Hz |
| Settings copy (PT-BR) | Clear auto-quality + ceiling semantics |

**Exit criteria:**

- p95 delta HUD-full vs HUD-minimal **≤ 1 ms** on Reference
- No perceived delay on killfeed/hit (critical events still immediate)

### W4 — Network / multiplayer path

**Goal:** networked path must not tank local FPS or allocate excessively.

| Deliverable | Detail |
|-------------|--------|
| Cheap snapshot apply | Prefer patch/diff; avoid full mesh rebuilds |
| Bounded interpolation cost | No per-entity/frame allocations |
| Solo vs room profile | Same hardware Reference comparison |

**Exit criteria:**

- Room with N players: p95 ≤ Reference solo + **≤ 2 ms**
- No GC spikes at ~20 Hz state apply

**Out of W4:** anti-cheat, global interest management unless N forces it.

### W5 — Ceiling polish + regression harness

**Goal:** high looks good and holds 60; Floor does not regress; reproducible QA.

| Deliverable | Detail |
|-------------|--------|
| Ceiling high stable | p95 ≤ 16.7 with high knobs on Ceiling hardware |
| Floor soak | 5 min low without progressive degradation (leaks) |
| Measurement checklist | Doc: how to run Reference / Floor / Ceiling |
| Optional local session export | Download JSON for QA (no server required) |
| Dispose audit | Map change / leave match resource cleanup |

**Exit criteria:** all three profiles meet hard SLOs; auto-quality validated; checklist in `docs/`; unit tests green.

### Suggested first implementation slice

Ship **W0 complete** first, then W1 (highest ROI for browser 3D).

---

## 5. Testing strategy

| Layer | What | How |
|-------|------|-----|
| Unit | QualityController (hysteresis, cap, order, cooldown, hidden tab) | vitest + fake clock |
| Unit | FrameSampler p50/p95 | Synthetic frame series |
| Unit | Prefs parse (`ff_auto_quality`, tier) | Existing prefs test style |
| Unit | Pure GPU helpers (batch keys, LOD pick) | vitest, no WebGL |
| Manual QA | Three profiles | Checklist; 30 s combat + 5 min soak |
| Visual | Tiers still readable | PR notes / side-by-side; no mandatory pixel-diff in v1 |
| CI FPS bench | — | **Not** required for v1 |

**Rule:** unit tests lock **logic**; **SLO pass/fail** is measured in a real browser with overlay or export.

---

## 6. Settings UX (PT-BR)

**Settings → Desempenho:**

| Control | Behavior |
|---------|----------|
| Qualidade gráfica (low/medium/high) | User **ceiling**. Help: “Limite máximo; com Auto ligado o jogo pode baixar para manter FPS.” |
| Qualidade automática (default on) | Toggles QualityController |
| Overlay de FPS | FPS, p50/p95 ms, draws, tris, effective knobs, `AUTO` / `AUTO ↓` / `MANUAL` |

**Copy:**

- Auto on: “Ajusta sombras, nitidez e efeitos para manter o jogo fluido.”
- Auto off: “Usa exatamente o preset da qualidade escolhida.”

---

## 7. Rollout

| Phase | Action |
|-------|--------|
| Development | W0 without heavy feature flags; auto default **true** |
| Internal playtest | Flicker, shadow pop, ceiling respect |
| Incremental ship | Merge per wave; note p95 before/after on Reference when possible |
| Escape hatch | User disables auto or forces low (localStorage only) |
| Remote config | **None** in v1 |

### Local observability shape (overlay / optional W5 export)

```ts
{
  fps: number;
  p50Ms: number;
  p95Ms: number;
  cpuMsP95?: number;
  renderMsP95?: number;
  drawCalls: number;
  triangles: number;
  userTierMax: "low" | "medium" | "high";
  autoEnabled: boolean;
  effectiveKnobs: RuntimeKnobs;
  lastAdaptReason?: "degrade" | "upgrade" | "user" | "grace";
}
```

---

## 8. Cross-cutting risks

| Risk | Mitigation |
|------|------------|
| Shadow/DPR flicker | Hysteresis, cooldowns, discrete levels |
| Dirty metrics (DevTools, background tab) | Ignore `document.hidden`; QA protocol without DevTools |
| Auto too aggressive on good hardware | Conservative upgrade thresholds |
| Instancing breaks special props | Instance only homogeneous kinds; keep complex props as meshes |
| HUD throttle delays ammo/money | Immediate publish for critical fields |
| Scope creep (Worker, WebGPU) | Hard non-goals |
| Monolithic GameClient diffs | Isolate `infrastructure/perf`; touch loop only at edges |
| Memory leaks over soak | W5 dispose audit + 5 min Floor soak |

---

## 9. Definition of done (v1 performance program)

1. W0–W5 exit criteria met, or gaps ≤ 2 ms documented with issues.
2. Reference medium combat: p95 ≤ 16.7 ms.
3. Floor low: p95 ≤ 22.2 ms.
4. Ceiling high: p95 ≤ 16.7 ms with high visuals.
5. Auto-quality stable (no flicker) and user-disableable.
6. Measurement checklist in `docs/`.
7. Controller/sampler unit tests green.

---

## 10. Rejected alternatives

| Approach | Why not (now) |
|----------|----------------|
| Optimization backlog only (no budget system) | Gains regress silently; fails measured-SLO goal |
| Worker-first rewrite | High cost; does not fix GPU fill-rate; premature before W2 data |
| Single “60 FPS on my machine” profile | Not portable to BR laptop audience |
| Population-first SLOs without local foundation | Needs telemetry backend; comes after local instrumentation |

---

## 11. Next step

1. Implementation plan via writing-plans skill, **starting at W0**.
2. Execute W0 → measure → W1 → …
