# Wave 5 — features runbook

**Spec:** [`superpowers/specs/2026-07-09-wave5-product-features-design.md`](superpowers/specs/2026-07-09-wave5-product-features-design.md)  
**Date:** 2026-07-09

## Shipped themes

| Area | What |
|------|------|
| C4 | Plant / defuse / explode on map bomb sites; TR plant **F** 3.5s; CT defuse **F** 5s; timer **40s** → TR win / defuse → CT win |
| Round banners | Full-width toast ~2.5s: TR/CT win, bomb exploded, bomb defused |
| Spectator | On death (live): follow killer or free cam; Space toggles free follow |
| HE grenade | Shop `he` $300; throw **G** (or slot 5); arc, explode ~1.8s, radius 4, max dmg 80 |
| Soft ranks | Local XP → tiers: Recruta / Prata / Ouro / Ás / Lenda (`ff_xp`; 0/500/1500/4000/10000) |
| Scoreboard | TAB: K/D column, MVP highlight, latency stub |
| Map cards | Lobby create: accent gradient + blurb from registry |
| Hit feedback | Damage numbers “-XX” + existing hit marker |

## Dev smoke

```bash
npm run dev          # :3000
npm run dev:server   # :2567
```

1. As TR on site → hold **F** plant → HUD bomb timer + world marker.  
2. As CT near bomb → hold **F** defuse → banner “BOMBA DESARMADA” / explode → “BOMBA EXPLODIU”.  
3. Round end banners show win reason.  
4. Die mid-round → spectator follow; Space free cam.  
5. Buy HE in shop → **G** throw → AoE damage.  
6. Profile shows rank tier + XP bar; TAB shows K/D + MVP.

## Out of scope (this wave)

Full utility set (flash/smoke), defuse kit, real voice, anti-cheat, true ranked ELO server, multi-node matchmaking.
