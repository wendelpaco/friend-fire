# Friend Fire — Performance measurement checklist

**Spec:** `docs/superpowers/specs/2026-07-09-browser-performance-design.md`  
**Purpose:** Reproducible QA for Reference / Floor / Ceiling SLOs (W5).

---

## Hard SLOs

| Profile | Hardware (approx.) | Viewport | Quality ceiling | p95 `frameMs` |
|---------|-------------------|----------|-----------------|---------------|
| **Reference** | Laptop iGPU ~2020–22, Chrome | 1920×1080 | **medium** | ≤ **16.7 ms** (~60 FPS) |
| **Floor** | Weak laptop / old iGPU | 1366×768 or 1080p DPR-capped | **low** | ≤ **22.2 ms** (~45 FPS) |
| **Ceiling** | dGPU or Apple Silicon | native (DPR ≤ 2) | **high** | ≤ **16.7 ms** |

Pass/fail uses **session p95 of window p95s** from the JSON export (or overlay p95 over ≥30 s combat).

---

## Official protocol

1. **Close DevTools** (official runs only).  
2. **Warm-up 3 s** after map load before counting.  
3. **Live match**, ≥8 players/bots, active combat (shoot + FX), not lobby-only.  
4. Sample **≥30 s** continuous (soak Floor: **5 min** low tier).  
5. Note: tab must stay **focused** (auto-quality freezes when `document.hidden`).

### Settings for each profile

| Profile | Qualidade (limite) | Auto | Overlay avançado |
|---------|-------------------|------|------------------|
| Reference | Média | On (also test Off) | On |
| Floor | Baixa | On | On |
| Ceiling | Alta | On (machine should stay high) | On |

---

## Export session JSON (no server)

1. Enter a match (`/play`).  
2. Pause → **Ajustes** → Desempenho → **Exportar sessão de performance**.  
   - Or from the advanced FPS overlay button **JSON**.  
3. File: `friend-fire-perf-<iso>.json`  
4. Fields of interest:
   - `summary.p95Ms`, `summary.cpuMsP95`, `summary.renderMsP95`
   - `slo.reference` / `slo.floor` / `slo.ceiling` → `pass`
   - `samples[]` for soak drift (p95 should not climb for 5 min)

Recorder keeps up to **5 minutes** of 1 Hz samples (ring buffer).

---

## Regression smoke (after merge)

- [ ] Reference medium combat 30 s — p95 ≤ 16.7 **or** gap ≤ 2 ms documented  
- [ ] Floor low 5 min — p95 ≤ 22.2, no progressive climb (leak)  
- [ ] Ceiling high 30 s — p95 ≤ 16.7 with high knobs  
- [ ] Auto on: stress → `AUTO ↓` without shadow flicker  
- [ ] Auto off: preset fixed  
- [ ] Leave match / remount — no WebGL context leak (dispose)  
- [ ] Room mode: p95 ≤ solo + 2 ms on same hardware  

---

## What not to count

- DevTools open / CPU throttling profiles  
- Background tab  
- First 3 s after load  
- Lobby-only idle  

---

## Related code

| Module | Role |
|--------|------|
| `src/infrastructure/perf/` | Sampler, QualityController, session export |
| `GameClient` | Frame marks, recorder, dispose |
| Settings / HUD | Export trigger (`ff-export-perf`) |
