# Friend Fire — Wave 3 Product Features Design

**Status:** Approved for implementation (user: implement + always spec first)  
**Date:** 2026-07-09  
**Branch:** `feature/friend-fire-v1`  
**Prior product specs:**  
- `2026-07-09-friend-fire-product-design.md`  
- `2026-07-09-combat-feedback-visual-design.md`

---

## 1. Priority decision (controller)

Chosen order of value for a free browser tactical shooter with rooms + ads:

| Priority | Feature | Why now |
|----------|---------|---------|
| P0 | **Public / private rooms + browser filters** | Completes server browser; avoids spam/empty private rooms in list |
| P0 | **Quick Match** | One-click join: lowest friction after “Procurar salas” |
| P1 | **Match end stats card** | Feedback loop; feeds missions/XP narrative |
| P1 | **Daily local leaderboard** | Retention without accounts |
| P2 | **Fog of war (local vision)** | Competitive readability (called out on RUSH B thread); scoped cosmetic |
| P2 | **Ping display in browser** | Trust multiplayer quality |

**Deferred (not this wave):** voice, ranked ELO, anti-cheat, fog shared across network authority, map editor.

---

## 2. Feature specs

### 2.1 Room visibility + browser filters

**Server**

- Room options / metadata: `visibility: "public" | "private"` (default `public` for browser, `private` if creator toggles).
- `GET /rooms?mapId=&hasSlots=1&visibility=public`
  - Default list: `visibility=public` only.
  - Filter `mapId` exact match when provided.
  - `hasSlots=1` → `clients < maxClients`.
- Response fields (extend existing):  
  `{ roomId, code, mapId, mapName, roomName, clients, maxClients, phase, visibility, region? }`

**Client lobby**

- ServerBrowser filters UI: map dropdown (all + each map), checkbox “Só com vaga”, refresh.
- Create room: toggle “Sala pública” (default on) → passed to `create({ visibility })`.

### 2.2 Quick Match

**Client**

- Button **JOGO RÁPIDO ONLINE** (or enhance existing flow):  
  1. `listRooms({ hasSlots: true, visibility: "public" })`  
  2. Prefer rooms with same `ff_last_map` if any  
  3. Else fullest public room with slots  
  4. If none → `create({ mapId: lastMap, visibility: "public" })` and enter as host  

**Failure:** show toast/error if server down (reuse existing messages).

### 2.3 Match end stats card

**When:** transition to `match_over` (solo or networked).

**Stats (local player):**

| Field | Source |
|-------|--------|
| kills | player.kills |
| deaths | player.deaths |
| K/D | kills / max(1,deaths) |
| money end | player.money |
| result | win / loss / draw from team scores |
| map | map.displayName |
| duration optional | skip if not tracked |

**UI:** panel before or above EndMatchBreak ads (or tab “Stats” on end break). Must not block ad break permanently—stats + continue + rewarded.

**Persistence:** append to `ff_match_history` (last 20 matches) for leaderboard.

### 2.4 Daily local leaderboard

**Storage key:** `ff_leaderboard_v1`  
**Shape:**

```ts
{
  dayKey: string; // YYYY-MM-DD
  entries: Array<{ nickname: string; kills: number; wins: number; matches: number }>
}
```

- On match_over: upsert local nickname with +kills, +1 match, +1 win if won.
- Reset when dayKey changes.
- Lobby UI: section “Ranking do dia” top 5 by kills (tie-break wins).

No server account required.

### 2.5 Fog of war (local vision) — scoped

**Intent:** Darken areas far from local player (and optionally teammates later). Not full CS smoke LOS.

**Rules (client render):**

- Vision radius default **14** world units around local player.
- Outside radius: dim overlay or reduce light (keep vignette compatible).
- Enemies outside radius: hide mesh or show only if shot recently (optional: hide other teams outside radius).
- Does **not** change server authority; pure presentation.
- Toggle: settings or default ON in solo; ON in room mode.

**Implementation sketch:**

- SpotLight already exists—tighten range + add second “black fog” plane or shader disc.
- Or: for each non-local enemy, `mesh.visible = dist < radius || sameTeam`.

Prefer **enemy culling by distance** + stronger spotlight for P2 speed.

### 2.6 Ping in server browser

- Client probes `GET /health` or lightweight `GET /rooms` timing RTT once per refresh.
- Display “Ping ~XXms” in ServerBrowser header (same host as Colyseus HTTP).
- Not per-room geo ping in this wave.

---

## 3. Architecture notes

| Area | Touch |
|------|--------|
| `server/src/index.ts` | Query filters for `/rooms` |
| `server/src/rooms/GameRoom.ts` | visibility + metadata |
| `roomClient.ts` | listRooms query params, create visibility, quickMatch helper |
| `domains/identity` or `domains/stats` | history + leaderboard pure helpers + tests |
| `presentation/lobby/*` | filters, quick match, leaderboard |
| `presentation/game/*` | match stats on end |
| `ThreeRenderer` / `GameClient` | fog of war visibility |

---

## 4. Parallel implementation plan (agents)

| # | Owner | Deliverable |
|---|--------|-------------|
| 1 | Server | visibility + filtered GET /rooms |
| 2 | Domain stats | match history + daily leaderboard pure + tests |
| 3 | roomClient | filters, quickMatch(), create visibility |
| 4 | Lobby UI | ServerBrowser filters + quick match button + leaderboard widget |
| 5 | Match end stats | Stats card + write history |
| 6 | Fog of war | enemy hide + spotlight radius |
| 7 | Ping | measure RTT in browser header |
| 8 | Docs | README + this wave shipped notes |

Wire conflicts: agents 4–5 may both touch MainMenu—prefer 4 owns MainMenu, 5 only game end UI.

---

## 5. Testing

- Unit: leaderboard day reset, upsert, filters pure functions  
- Manual: create private room → not in public list; public appears; quick match joins; stats after match_over; fog hides distant enemies  
- `npm test` + `npm run build` + server `tsc`

---

## 6. Success criteria

- [ ] Public browser never lists private rooms  
- [ ] Filters map + hasSlots work  
- [ ] Quick Match joins or creates public room  
- [ ] Match end shows K/D/result  
- [ ] Daily top kills in lobby  
- [ ] Distant enemies hidden (fog)  
- [ ] Ping shown when server reachable  

---

## 7. Approval

User authorized: implement important features, controller prioritizes, **always write spec first**.  
This document is the wave-3 spec; implementation may proceed immediately after commit of this file.
