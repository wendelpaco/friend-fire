# Friend Fire — Wave 2 (next after v1)

**Date:** 2026-07-09  
**Branch base:** `feature/friend-fire-v1`

## Done in visual mini-wave

- Stronger sun + fill light, Exp2 fog  
- Sand texture, wall stucco, asphalt strips  
- Ocean/beach rim, palm trees, distant buildings, flower bushes  
- Containers, debris, poles, denser props on Dust FF  
- Screen vignette (camera-attached) + local spotlight  
- Richer player voxels (arms, pouches, shadow blob)  
- Play page soft tropical chrome  

## Done in Track A (feel)

- **Buy menu** (`B`) in warmup / between rounds — shop domain + UI  
- Extra weapons: MP5, Galil, AWP + colete  
- **SFX** procedural (shoot, reload, buy, hit, foot, UI) via Web Audio  
- **Camera** (`C`) locked vs free pan  
- Humans start with pistol only (bots full kit) to force buy loop  

## Gap still vs RUSH B videos (backlog visual)

| Item | Priority |
|------|----------|
| Buy menu overlay (B) with weapon cards | High product |
| Fog-of-war / LOS instead of only vignette | Medium |
| Destruction / rubble after explosions | Medium |
| Weapon models more detailed + tracers | Medium |
| Real skybox gradient / HDRI | Low |
| Soccer pitch / second map (favela) | Medium |
| Cinematic letterbox with live palm video | Low / brand |

## Wave 2 product tracks (can parallelize with worktrees)

### Track A — Feel = RUSH B product loop
1. Buy menu between rounds / warmup (`B`)  
2. Minimal SFX (shot, reload, footstep, UI, plant)  
3. Camera free/locked toggle (`C`)  

### Track B — Real multiplayer combat ✅ (base shipped)
1. Server-side movement + hitscan + bots + round wipe  
2. Client prediction for local move + SFX; applyNetworkState reconcile  
3. hybridLocalCombat=false when authoritative  
**Still open:** per-weapon stats on server, lag comp, buy loadout sync to server  

### Track C — Retention + monetization
1. Daily missions wired to identity domain  
2. Rewarded_xp impression on complete  
3. Optional second map  

**Recommended order:** A (buy + SFX) for “parece o vídeo” → B for product truth → C for growth.
