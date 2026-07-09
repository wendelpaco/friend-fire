# Friend Fire — Rapier Physics + Buy Phase

**Date:** 2026-07-09  
**Status:** Implementing  

## 1. Rapier (client)

- Package: `@dimforge/rapier3d-compat` (WASM, browser-safe).
- Module: `src/infrastructure/physics/RapierWorld.ts`
- Static colliders from map walls + props (cuboids).
- Infinite ground half-space / large floor box.
- Player: capsule + **KinematicCharacterController**
  - Grounded via `computedGrounded()` + downward ray
  - Jump: set vertical velocity when grounded
  - Crouch: shorter capsule + speed mult
- Orientation still from **horizontal** velocity only.
- Server keeps AABB `tickMotor` (authoritative, no WASM dependency).

## 2. Buy phase

Flow:

```
warmup → buy (round N) → live → ended (banner) → buy → live → …
```

| Phase | Duration | Shop B? |
|-------|----------|---------|
| warmup | 20s | yes |
| buy | **18s** | yes |
| live | 90s | no |
| ended | 4s | no (banner only) |
| match_over | 8s | no |

## 3. Crouch

Toggle on Control edge (press once to crouch, again to stand).

## 4. Success

- No floor fall-through / wall clip with Rapier controller  
- Buy timer visible; shop locks after buy ends  
- Money never negative  
- Tests + build green  
