# Friend Fire — Jump / Crouch Motor Design

**Status:** Implementing  
**Date:** 2026-07-09  
**Reference:** CS-style feel + RUSH B top-down video  

## Goals

- SPACE jump (ground only), CTRL hold crouch  
- Keep velocity-facing character orientation (XZ only)  
- Solid wall collision; no fall-through ground  
- Local solo + Colyseus authoritative  

## Constants (CS-ish, top-down scale)

| Param | Value |
|-------|-------|
| Gravity | −28 u/s² |
| Jump speed | 9.5 u/s |
| Ground Y | 0 |
| Crouch speed | 34% of stand |
| Stand radius | 0.45 |
| Crouch radius | 0.38 |

## Rules

1. **Jump:** edge SPACE only if `onGround`; sets `vy = JUMP`; not while dead.  
2. **Crouch:** hold Control; release stands; slows XZ; lower visual + smaller radius.  
3. **Ground:** after vertical integrate, if `y <= 0 && vy <= 0` → snap ground, `onGround`.  
4. **Orientation:** body yaw from horizontal velocity only (ignore Y).  
5. **Input:** preventDefault Space + Control so browser doesn’t scroll/menu.  

## Modules

- `domains/world/motor.ts` — pure tick  
- `CharacterAnimator` — crouch / airborne poses  
- `GameClient` + server `GameRoom` — apply motor  
- Schema: `y`, `vy`, `crouching`  

## Out

- Climb onto crates / multi-floor  
- Full Rapier rigid bodies (AABB walls keep working)  
