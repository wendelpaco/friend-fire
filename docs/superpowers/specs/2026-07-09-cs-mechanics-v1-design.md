# Friend Fire — CS Mechanics v1 Design

**Status:** Complete (C0 + C1 + C2a freezetime/loss + C2b drops on main)  
**Date:** 2026-07-09  
**Prior:** `2026-07-09-cs-mechanics-audit.md` (multi-agent Phase A)  
**Product frame:** CS-lite **top-down** (not CS2 first-person clone)

---

## 1. Goal

Make match flow and gunfights **reward Counter-Strike decision-making**:

- Stop to shoot; don’t full-sprint spray  
- Eco rounds matter  
- Bomb rules match CS when the objective is live  
- Solo and multiplayer share the **same combat/round rules**

### Non-goals (v1)

- CS2 recoil patterns / spray transfer  
- Full utility (smoke/flash/molly)  
- Half-time side swap (deferred P2)  
- Head hitgroups (awkward top-down; deferred)  
- Teammate weapon drop UI (after ground drops)

---

## 2. Principles locked

| # | Principle | v1 interpretation |
|---|-----------|-------------------|
| 1 | Authority consistency | One pure rule + accuracy model for server **and** offline |
| 2 | Stop-shoot skill | Speed/air/crouch scale inaccuracy |
| 3 | First bullet > spray | Recovery window resets bloom |
| 4 | Objective integrity | Planted bomb overrides round clock |
| 5 | Eco DNA | Keep $800/$16k/win-loss; survivors keep guns |
| 6 | Top-down honesty | Hitscan + angle error; no fake FPS recoil camera |

---

## 3. Slice C0 — Round / bomb parity

### 3.1 Live timer vs bomb (P0 — R1)

**Rule:** If bomb state is `planted` or `defusing`, live round clock **must not** award CT win on expiry.

**Implementation:**

```ts
// domains/match — pure
function isBombPlantedActive(bomb: BombMatchState): boolean
function shouldLiveTimerEndRound(phase, bomb): boolean
// false when planted/defusing
```

- `tickPhase` either accepts bomb snapshot or offline/server **never** call live→CT via `tickPhase` while planted (mirror `GameRoom.tick` ~368–377).  
- Offline `updateTimer` must match server.  
- Tests: planted + timeLeft→0 stays live; explode/defuse still ends.

### 3.2 Optional UX (P2 in same PR if cheap)

- Freeze displayed round clock at plant (don’t count to 0:00 under bomb).

### 3.3 Bomb carrier death offline (P1 — R2)

**Minimum v1:** On carrier death pre-plant, reassign to random living TR (server already does).  
**Not v1:** Full ground drop (C2).

### 3.4 Carrier assignment (P1 — R3)

When assigning C4 at buy/live start: **prefer living human TR**, then bots.

---

## 4. Slice C1 — Gunfight P0

### 4.1 Shared accuracy helper

```ts
// domains/combat/accuracy.ts (pure)
type AccuracyInput = {
  weaponId: WeaponId;
  speed: number;       // horizontal m/s
  standSpeed: number;  // run cap
  airborne: boolean;
  crouching: boolean;
  shotsInBurst: number;
  msSinceLastShot: number;
};

/** Radians of aim error (half-angle); 0 = perfect */
function shotSpreadRadians(input: AccuracyInput): number
function applySpreadToYaw(yaw: number, spread: number, rng: () => number): number
```

### 4.2 Formula (design targets)

\[
\sigma = \sigma_{\mathrm{shot}} \cdot (1 + k_{\mathrm{move}} \cdot m) \cdot m_{\mathrm{air}} \cdot m_{\mathrm{crouch}}
\]

- \(m = \mathrm{clamp}(speed / standSpeed, 0, 1)\); full stop when \(speed < 0.12 \cdot standSpeed\) → \(m = 0\)  
- \(m_{\mathrm{air}} = 3.0\) when airborne else \(1\)  
- \(m_{\mathrm{crouch}} = 0.75\) when crouching and grounded else \(1\)  
- \(\sigma_{\mathrm{shot}} = \sigma_{\mathrm{first}}\) if `msSinceLastShot >= recoveryMs`, else \(\sigma_{\mathrm{base}} + bloomPerShot \cdot \min(shotsInBurst, maxBloomShots)\)

### 4.3 Per-weapon knobs (extend WeaponDef)

| Field | Role |
|-------|------|
| `spread` (existing) | Base continuous fire (radians scale as today offline) |
| `firstShotSpread` | Default `spread * 0.25` if omitted |
| `bloomPerShot` | Default `spread * 0.15` |
| `recoveryMs` | Default 280 rifles / 180 pistols / 500 AWP |
| `moveInaccuracyScale` | Default 1; AWP 1.8; SMG 0.7 |

**Feel targets:**

- **AWP** stopped first ≈ hit mid-range body; moving/jump terrible  
- **AK** stopped taps tight; spray blooms  
- **Pistols** usable stopped; worse move scale than rifles  
- **MP5** more forgiving move, shorter effective range (existing range)

### 4.4 Armor (P0 keep simple)

Keep current formula. **Optional one-liner for AWP:** if `weaponId === 'awp'`, apply damage with armorRatio 1.0 (full pen) or set AWP damage so full armor still kills — **decision: AWP ignores half of armor soak (armorRatio 0.15 effective)** so body + full armor is still one-shot or ~lethal.  

**Locked recommendation:** AWP damage path uses `armorPen = 1.0` (ignore armor for HP calc, still chip armor lightly) — classic sniper feel top-down.

### 4.5 Integration

| Path | Change |
|------|--------|
| Server `hitscan` | Offset aim yaw by `applySpreadToYaw` before ray |
| Offline `tryShoot` | Same helper; keep projectile or migrate hitscan later — **P0: same angle error on projectile spawn dir** |
| Network cosmetics | Tracer uses same final angle |
| Player state | Track `shotsInBurst`, update on fire / reset on recovery |

### 4.6 Reload parity (P1 bundled if small)

Server `tryReload` uses `reloadTime` + `reloadingUntil`; block fire while reloading; share domain `beginReload`/`completeReload`.

### 4.7 Tests

- stop σ < walk σ < air σ  
- first shot < burst shot N  
- recovery restores first  
- crouch σ < stand at same speed  
- AWP + 100 armor outcome (one-shot body)  

---

## 5. Slice C2 — Deferred (not this implementation batch)

- Ground weapon drops + pickup  
- Loss bonus table exact CS ladder + HUD streak  
- Team-gated shop  
- Freezetime movement lock  
- Plant bonus $300  
- Defuse kit  
- Half-time swap  

---

## 6. Implementation order (Phase C)

1. **C0** bomb-aware timer (domain + client + tests) + offline carrier reassign + human carrier prefer  
2. **C1** accuracy module + weapon knobs + server/offline wire + tests  
3. **C1b** server timed reload  
4. **C1c** AWP armor pen special case  
5. Manual smoke: stop-tap feels better than run-spray  

---

## 7. Success criteria

- [ ] Solo: plant bomb, round clock hits 0 → round continues until explode/defuse  
- [ ] Multi: running full-spray misses more than stopped taps (felt + metrics)  
- [ ] First AK bullet when stopped tighter than 5th in spray  
- [ ] Jump-shooting is clearly punished  
- [ ] Server reload not instant  
- [ ] Unit tests green for accuracy + timer rule  

---

## 8. Approval gate

**Approve this design to start Phase C**, or request changes on:

- AWP armor rule  
- Exact stop-speed threshold (12% run)  
- Whether C1b reload is in same PR as accuracy  

---

## 9. Multi-agent note

Phase A used three parallel explore subagents (round, combat, eco).  
Phase C may use worktree-isolated implementers for C0 vs C1 if desired after approval.
