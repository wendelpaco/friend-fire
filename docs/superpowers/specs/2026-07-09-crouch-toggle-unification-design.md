# Friend Fire — Crouch Toggle Unification

**Date:** 2026-07-09  
**Status:** Approved  
**Scope:** Gap-fix Design A (movement + buy already exist)

## Context

Most movement / shop / impact systems already ship. The product gap is **crouch semantics**:

| Layer | Before |
|-------|--------|
| Solo client (`GameClient.applyPlayerMotor`) | **Toggle** on Control edge |
| Net payload (`GameCanvas` 20 Hz) | **Hold** (`isCrouchDown`) |
| Server (`GameRoom` + `tickMotor`) | **Hold** (`crouch: input.crouch`) |

Docs disagreed (jump-crouch-motor = hold; rapier-buy = toggle). Help text = toggle.

## Decisions (product)

1. **Crouch = toggle** everywhere (solo + multiplayer). Press Control once to crouch; press again to stand. Releasing Control does **not** stand.
2. **C4 is not a shop item** — CS rule: TR bomb carrier per round. Shop keeps weapons / armor / HE only.
3. No new posture enum; keep `crouching` + `onGround` + `vy`.

## Behavior

- Rising edge on Control (L or R) toggles `player.crouching`.
- Holding Control does not re-toggle until release + press again (edge-detect).
- Jump / land does not clear crouch.
- Motor input `crouch` means **desired crouch state this frame**, not “key held”. Toggle is applied **before** `tickMotor` / Rapier step.
- `preventDefault` on Control/Space unchanged.

### Network (mirror jump edge)

```
Client 20 Hz:  crouch: isCrouchDown()   // hold bit (same wire as today)
Server tick:   crouchEdge = crouch && !crouchHeld
               crouchHeld = crouch
               if crouchEdge: p.crouching = !p.crouching
               tickMotor(..., crouch: p.crouching)
```

Jump already uses this hold→edge pattern; crouch reuses it for **toggle** instead of “while held”.

### Client prediction

Keep Control **edge** toggle in `applyPlayerMotor` (both offline and networked prediction). Pass `crouch: p.crouching` into motor / `crouching: p.crouching` into Rapier.

## Out of scope

- C4 in shop  
- Rapier on server  
- Explicit `standing | crouching | jumping` enum  
- Movement feel retune / GLTF soldiers / video polish  

## Success

- Solo and multiplayer: same toggle feel  
- Velocity-facing orientation unchanged with crouch/jump  
- Buy phase / shop / money tests still green  
- `bun run test` + `tsc --noEmit` clean  
