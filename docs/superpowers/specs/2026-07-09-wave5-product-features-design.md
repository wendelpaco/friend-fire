# Friend Fire — Wave 5 Product Features Design

**Status:** Approved for implementation (user: wave 5 GO)  
**Date:** 2026-07-09  
**Branch:** `feature/friend-fire-v1`  
**Prior:** product, combat feedback, wave3, wave4  

---

## 1. Priority (controller)

| Prio | Feature | Why |
|------|---------|-----|
| P0 | **C4 plant / defuse / explode** | Core CS loop still missing; bomb sites already on maps |
| P0 | **Round banners** (won/lost/plant/defuse) | Clarity mid-match |
| P1 | **Spectator cam on death** (follow killer / free orbit simple) | Feel premium after death |
| P1 | **Utility: HE grenade** (buy + throw arc + damage) | Depth without full CS inventory |
| P1 | **Scoreboard TAB polish** (ping stub, MVPs) | Competitive feel |
| P2 | **Map card previews** (gradient art per map in lobby) | Faster map choice |
| P2 | **Soft ranked: season XP → rank tiers** (local) | Retention without server accounts |
| P2 | **Hit markers + damage numbers** | Combat feedback gap |

**Out:** full utility set, real voice, anti-cheat, true ranked ELO server.

---

## 2. Feature specs

### 2.1 C4 plant / defuse / explode

**State (match domain + client + server mirror):**

| Field | Meaning |
|-------|---------|
| `bombCarrierId` | TR player holding C4 (spawn: random TR or first TR) |
| `bombState` | `carried` \| `planting` \| `planted` \| `defusing` \| `exploded` \| `defused` |
| `bombX/Z` | world pos when planted |
| `plantProgress` / `defuseProgress` | 0–1 |
| `bombTimer` | seconds to explode when planted (default **40**) |

**Rules:**

- Only TR can plant on bomb site radius (existing `bombSites` on map).
- Plant: hold **F** 3.5s stationary inside site while carrying.
- After plant: all can see bomb marker; CTs hold **F** 5s in radius 2.5 to defuse (no kit for simplicity; optional 2.5s later).
- If timer hits 0 → TR win round (`onRoundWin TR`); if defused → CT win.
- Round wipe still works; if bomb planted and all CT dead → TR win (already wipe).
- Local solo first; server: same rules in GameRoom when networked.

**UI:**

- Prompt when can plant/defuse.
- World marker on bomb when planted.
- HUD bomb timer when planted.

### 2.2 Round banners

- On round end: full-width toast 2.5s — “TR VENCEU” / “CT VENCEU” / “BOMBA EXPLODIU” / “BOMBA DESARMADA”.
- Driven by phase transition + optional reason enum.

### 2.3 Spectator on death

- When local dead and phase live: camera follows killer if known, else free cam forced.
- HUD: “ESPECTANDO · espaço para soltar câmera” (space toggles free follow).
- No respawn until next round (except warmup — keep current).

### 2.4 HE grenade

- Shop item `he` price 300, category gear.
- Slot 5 or use key **G** to throw if owned (count in player.heCount).
- Throw: arc projectile, explode after 1.8s or on ground, radius 4, max damage 80 falloff.
- Local + server simplified.

### 2.5 Scoreboard polish

- TAB: add column K/D ratio; highlight MVP (most kills).
- Optional latency “—” until real ping per player.

### 2.6 Map cards

- Lobby map select: larger card with accent gradient + blurb from registry.
- ServerBrowser already has chips—extend create UI.

### 2.7 Soft rank tiers (local)

- Map total XP (`ff_xp`) to tiers: Recruta, Prata, Ouro, Ás, Lenda (thresholds 0/500/1500/4000/10000).
- MainMenu profile shows tier name + XP bar.

### 2.8 Hit markers + damage numbers

- On local damage dealt: floating “-XX” at hit pos + existing hit marker.
- Pool of sprites, life 0.6s.

---

## 3. Parallel agents

| # | Deliverable |
|---|-------------|
| 1 | Domain bomb state machine pure + tests |
| 2 | Domain grenade physics pure + tests |
| 3 | Soft rank tiers domain + tests |
| 4 | Server bomb + HE + round reason |
| 5 | GameClient plant/defuse/HE local |
| 6 | ThreeRenderer bomb marker + HE mesh + damage numbers |
| 7 | HUD bomb timer, banners, spectator |
| 8 | Shop HE + map cards + rank UI |
| 9 | Scoreboard polish |
| 10 | Docs wave5 |

---

## 4. Success criteria

- [ ] Plant/defuse/explode wins rounds solo  
- [ ] Banners show reason  
- [ ] Dead player spectates  
- [ ] HE throwable damages  
- [ ] Rank tier from XP  
- [ ] Hit damage numbers  
- [ ] npm test + build green  

---

## 5. Approval

User: “wave 5! GO” — implement after this spec is committed.
