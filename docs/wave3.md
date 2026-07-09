# Wave 3 — features runbook

**Spec:** [`superpowers/specs/2026-07-09-wave3-product-features-design.md`](superpowers/specs/2026-07-09-wave3-product-features-design.md)  
**Date:** 2026-07-09

## Shipped themes

| Area | What |
|------|------|
| Rooms | `visibility: public \| private`; private hidden from default browser |
| Browser | Filters: `mapId`, `hasSlots`, public-only default |
| Quick Match | Join best public room with slots (prefer `ff_last_map`) or create public |
| API | `GET /rooms?mapId=&hasSlots=1&visibility=public` |
| Stats | Match-end card + `ff_match_history` |
| Leaderboard | Daily local top kills — `ff_leaderboard_v1` |
| Fog | Client vision radius; not network authority |
| Ping | Optional RTT in server browser header |

## Dev smoke

```bash
npm run dev          # :3000
npm run dev:server   # :2567
```

1. Create **private** room → not in **Procurar salas** public list; join via code/invite.  
2. Create **public** room → appears; filter by map / “só com vaga”.  
3. **Jogo rápido online** joins or creates public room.  
4. Finish a match → stats card + ranking do dia updates.  
5. Distant enemies culled when fog is on.

## Out of scope (this wave)

Voice, ranked ELO, anti-cheat, server-authoritative fog, multi-node Redis matchmaking.
