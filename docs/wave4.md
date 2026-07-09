# Wave 4 — features runbook

**Spec:** [`superpowers/specs/2026-07-09-wave4-product-features-design.md`](superpowers/specs/2026-07-09-wave4-product-features-design.md)  
**Date:** 2026-07-09

## Shipped themes

| Area | What |
|------|------|
| Fog toggle | Pause/settings: “Visão limitada”; key `ff_fog_enabled` (default on) |
| Region | Rooms tag `BR` \| `US`; create/quickMatch from identity; `GET /rooms?region=` |
| Map chips | Accent hex + blurb on maps; swatches in browser & create |
| Settings | Pause panel: volume (`ff_volume`), fog, camera default (`ff_camera_default`) |
| Kill feed | Max 6 entries; fade polish; death/spectate hint |
| Reconnect | Store `ff_last_room_code`; lobby **Reentrar na última sala** |
| Queue UI | Quick match “Procurando partida…” + cancel (min display) |
| Room full | Clear “Sala cheia”; browser disables Entrar when full |

## Dev smoke

```bash
npm run dev          # :3000
npm run dev:server   # :2567
```

1. Pause → toggle fog / open Settings (volume, fog, camera) → prefs persist.  
2. Create room → region from identity; browser filter All / BR / US.  
3. Map list/create shows color chips per map.  
4. **Jogo rápido online** shows searching overlay; cancel aborts.  
5. Full room → Entrar disabled / join error “Sala cheia”.  
6. Leave room → **Reentrar na última sala** on lobby (clears on fail).

## Out of scope (this wave)

Cross-region game servers, voice, ranked ELO, mobile touch, real matchmaking queue backend.
