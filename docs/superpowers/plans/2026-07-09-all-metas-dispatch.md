# All metas dispatch (2026-07-09)

## Session Meta Flow (D)

| ID | Name | Status |
|----|------|--------|
| **M1** | Splash + Operator + Skins | ✅ Done |
| **M2** | Shop Showcase + FF Tactical DS | 🔄 Agent |
| **M3** | Death social + Squad chat | ✅ Done |

## CS Mechanics

| ID | Name | Status |
|----|------|--------|
| **C0** | Bomb-aware timer + carrier | ✅ Done |
| **C1** | Gunfight accuracy + reload | ✅ Done |
| **C2a** | Loss bonus table CS + freezetime lock | 🔄 Agent |
| **C2b** | Ground weapon drops + pickup | 🔄 Agent |

## Ownership (reduce merge conflicts)

| Agent | Primary paths |
|-------|----------------|
| M2 | `presentation/ui/*`, `presentation/session/ShopShowcase.tsx`, `BuyMenu.tsx`, kit helper |
| M3 | `GameHud` death/chat, `ChatEntry`, `server` chat/partyId, `roomClient` |
| C2a | `domains/match/economy*`, buy-phase movement freeze client+server |
| C2b | `domains/combat` drops, GameClient death drop + pickup interact |
