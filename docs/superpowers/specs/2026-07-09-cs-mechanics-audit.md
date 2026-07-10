# CS Mechanics Audit (Phase A) — Merged Multi-Agent Report

**Date:** 2026-07-09  
**Agents:** A1 Round/Bomb · A2 Combat/Movement · A3 Economy/Loadout  
**Status:** Complete (read-only exploration)  
**Next:** Design B → user approval → Implement C  

Plan: `docs/superpowers/plans/2026-07-09-cs-mechanics-audit-and-design.md`

---

## Executive summary

Friend Fire already has **strong CS skeleton**: MR13 rounds, buy/live/ended, $800/$16k economy, loss streak, bomb FSM timings, team pistols, strip-on-death / keep-on-survive, height-aware cover (server).

The **largest gaps** for “feels like CS” are:

1. **Gunfight skill** — multiplayer fire is perfect aim; no move/air/crouch accuracy; no first-bullet/bloom  
2. **Offline vs server rule drift** — planted bomb + round timer CT-wins offline; server already gates correctly  
3. **Objective continuity** — bomb stuck on dead carrier offline; no drop/pickup; bots never plant  
4. **Eco social layer** — no ground drops, no team drop, loss-bonus numbers off classic CS, weak eco HUD  

---

## P0 (fix before or with gunfight P0)

| ID | Area | Issue | Evidence |
|----|------|-------|----------|
| **R1** | Round | Offline/`tickPhase`: live timer → **CT win even if bomb planted** | `src/domains/match/phases.ts` live expiry; `GameClient.updateTimer` before bomb; server already special-cases in `GameRoom.tick` |
| **C1** | Combat | **Server hitscan = perfect aim**; no spread/velocity | `GameRoom.tryFire` / `hitscan`; `server/src/sim/weapons.ts` has no spread |
| **C2** | Combat | Offline-only flat random spread; **not shared with authority** | `GameClient.tryShoot` `(Math.random()-0.5)*spread` |
| **C3** | Combat | Dual models: offline projectile vs online hitscan | `updateBullets` vs `hitscan` |
| **C4** | Combat | No first-bullet / bloom / movement inaccuracy | No `shotsInBurst` / speed→σ anywhere |

---

## P1

| ID | Area | Issue |
|----|------|-------|
| **R2** | Bomb | Offline: dead carrier keeps bomb; no reassign/drop |
| **R3** | Bomb | TR bots never plant; human-only plant input on server |
| **R4** | Bomb | Server reassigns bomb (teleport) ≠ CS drop |
| **C5** | Combat | Server **instant reload**; offline timed reload |
| **C6** | Combat | Crouch/jump: mobility/cover only — no accuracy mult |
| **C7** | Combat | AWP not armor body-delete (generic 50% soak) |
| **E1** | Eco | No ground weapon drops / pickups |
| **E2** | Eco | No teammate drop |
| **E3** | Eco | Loss bonus ladder ≠ classic ($1900 first loss here vs $1400 CS) |
| **E4** | Eco | Shop not team-gated (TR can buy USP catalog freely) |
| **E5** | Eco | Buy phase is not freezetime (movement allowed) |
| **E6** | Eco | No half-time side swap at 12 |

---

## P2 (later)

- Round clock not frozen on plant (counts to 0:00 while bomb ticks)  
- Mutual wipe both teams dead underspecified on server  
- No plant $300 / defuse kit / helmet economy  
- Flat $300 kill reward (not weapon-tiered)  
- CT free armor 50 offline humans vs 0 on server  
- No sell/refund; HE max 2; doc timing drift  

---

## What already matches CS (keep)

- Warmup → buy → live → ended → buy → match_over  
- Buy ~20s, live ~115s, first to 13  
- Plant 3.5s / defuse 5s / bomb 40s  
- Wipe: CT all dead → TR; TR all dead **before** plant → CT; TR all dead **after** plant → must defuse  
- Server: round timer does **not** CT-win while bomb planted  
- Economy: $800 start, $16k cap, win $3250, kill $300, loss streak  
- Survivors keep guns; dead → knife + team pistol  
- Shop phase-gated (warmup/buy)  
- Weapon prices roughly CS-ish  
- Crouch ~34% speed; height-aware low cover peeks (server)  

---

## Recommended backlog order (for Design B)

### Slice C0 — Rule parity (small, high correctness)
1. Shared pure helper: live clock cannot end round if bomb planted  
2. Offline timer uses same gate as `GameRoom`  
3. Offline bomb reassign on carrier death (minimum; drop later)  

### Slice C1 — Gunfight P0 (skill)
1. Pure `shotInaccuracy(weapon, speed, airborne, crouching, burstIndex, dtSinceLast)`  
2. Server hitscan + offline shoot share helper  
3. Weapon knobs: baseSpread, firstShotSpread, bloomPerShot, recoveryMs, moveScale  
4. Timed reload on server  
5. Unit tests for stop < walk < air σ  

### Slice C2 — Eco / objective (post P0)
- Loss bonus table fix + HUD streak  
- Death drops + pickup  
- Team catalog filter  
- Optional freezetime lock  

### Explicit non-goals (v1 CS mechanics)
- Full CS2 recoil patterns  
- Half-time (can be P2)  
- Full util set (smoke/flash)  
- Helmet hitgroups (optional later)  

---

## Open product questions (need lock in Design B)

1. Solo-first or multiplayer-first for rule parity? (R1 still broken offline)  
2. Bomb: reassign-lite vs real drop/pickup?  
3. Bots plant or only human carriers?  
4. Top-down: skip headshots entirely in P0? (agents recommend yes)  
5. AWP: special armor damage or raise damage so full-armor body is decisive?  

---

## Agent source IDs (for resume)

- Round/Bomb: `019f49c0-2101-7e32-b08a-59423847db63`  
- Combat/Movement: `019f49c0-2102-74e1-9a13-632ba48e53c7`  
- Economy/Loadout: `019f49c0-2102-74e1-9a13-633b910d9293`  
