# Friend Fire — Product & Architecture Design

**Status:** Approved (product decisions + architecture)  
**Date:** 2026-07-09  
**Codename:** friend-fire  
**Inspiration:** Browser CS-style top-down tactical shooter (RUSH B / CS2D vibe)

---

## 1. Problem & goal

Build a **free browser game** that people open quickly, play short tactical rounds, and return to — while monetizing primarily through **in-inventory advertising** (map billboards, lobby, end-of-match), later augmented by **rewarded ads** and eventually **cosmetics**.

This is a **product**, not a portfolio demo: retention and monetization paths are first-class.

### Success criteria (v1)

| Metric (qualitative / early) | Target |
|------------------------------|--------|
| Time-to-first-shot | &lt; 30s from landing on site |
| Session always playable | Yes (bots fill empty slots) |
| Ad inventory live | Lobby + map + end-match break |
| Private multiplayer | Create/join room by code |
| Measurable impressions | Per placement + creative + session |

### Non-goals (v1)

- Native/Steam client  
- Competitive ranked + heavy anti-cheat  
- Large map/weapon roster  
- Mid-combat interstitial ads  
- Full paid cosmetics store  
- Public matchmaking (deferred to v1.1)  
- LLM-driven bots in realtime (cost/latency)

---

## 2. Product decisions (locked)

### 2.1 Positioning

- **Genre:** Tactical top-down multiplayer shooter (TR vs CT, rounds, economy DNA from CS)  
- **Platform:** Web only (desktop keyboard + mouse first)  
- **Language:** Portuguese-first UI (BR audience), code/comments in English or PT as already mixed in repo  

### 2.2 Monetization

**v1 (launch window, ~1–2 months)**

1. **Primary: ads (strong)**  
   - Map billboards / wall posters (always-on, non-intrusive)  
   - Lobby banner (rotating creatives)  
   - End-of-match break (short; not every inter-round at launch if it hurts pace)  
2. **Secondary: B2B / direct sponsors**  
   - Configurable creatives and slots without mesh redeploys  
   - Simple commercial story: “your brand on the map for a week”  
3. **Instrumentation**  
   - Record impressions: `impression_id`, `placement`, `creative_id`, `session_id`, `timestamp`

**v1.1**

- **Rewarded (light):** player opts in → grant XP / weekly free skin / mission re-roll  
- Stub network OK at first; domain API stable for real ad network later  

**Later**

- Paid cosmetics / battle pass only after core loop retains  

**Hard rules**

- No ads mid-gunfight  
- Always show disclosure badge **AD** on creatives  
- Prefer optional rewarded over forced long interstitials  

### 2.3 Multiplayer rollout

| Phase | Scope |
|-------|--------|
| **v1** | Offline/local bots already exist → **private rooms** (code/link) + **bot fill** for empty slots; server-authoritative room |
| **v1.1** | Public **matchmaking** by region (BR / US) |
| **Later** | Horizontal scale (Redis / multi-region) as needed |

### 2.4 Core gameplay loop (v1)

```
Lobby → Create or join room → Warmup (bots fill)
  → Live rounds (eliminate / timer; bomb plant deferred if needed)
  → Round end economy tick
  → Match end → ad break + scoreboard
  → Optional rewarded → Back to lobby / rematch
```

**Must feel like CS lite:** teams TR/CT, buy-or-spawn loadout (can start simplified), killfeed, scoreboard, reload, short rounds.

**Maps:** one polished map first (`Dust FF` baseline), not many half-baked maps.

### 2.5 Retention (v1 light)

- Nickname + region (client-persisted; server account later)  
- Daily missions + XP (can be local-first, server later)  
- First-run controls help  
- Pause / scoreboard / clear HUD  

---

## 3. Architecture

### 3.1 Approach chosen

**Domain modules (modular domain-oriented layout)** inside a single repository.

- Not ceremonial DDD (no mandatory aggregates/event sourcing)  
- Domains = business capabilities with pure-ish logic and clear ports  
- React and Three.js stay in **presentation** and **infrastructure**  
- Add `server/` (Colyseus) for private rooms without forcing a full monorepo on day one  
- Extract shared `packages/game-core` only if client and server must share the same simulation code  

### 3.2 Rejected alternatives

| Approach | Why not (now) |
|----------|----------------|
| Keep growing technical layers only (`components/` + fat `GameEngine`) | Already ~1.3k-line engine; ads/session/combat will tangle further |
| Full monorepo (`apps/web`, `apps/server`, `packages/*`) immediately | Overhead before room multiplayer is proven |
| Client-only forever | Cannot sell real multiplayer or fair combat |

### 3.3 Target directory layout

```
src/
  app/                            # Next.js routes only (thin)
  domains/
    match/                        # round phase, timer, score, round economy
    combat/                       # weapons, fire, damage, reload, kill events
    bots/                         # targeting, movement intents, voice lines
    world/                        # map data, collision, bomb sites, prop bounds
    session/                      # room code, roster, bot-fill policy
    ads/                          # catalog, placements, impressions, rewarded grants
    identity/                     # nickname, region, XP, daily missions (local-first)
  presentation/                   # React: lobby, HUD, pause, room UI
  infrastructure/
    render/                       # Three.js adapter (meshes, camera, billboard visuals)
    realtime/                     # Colyseus client SDK wrapper
    storage/                      # localStorage / future HTTP API
    analytics/                    # emit gameplay + ad events
  shared/                         # math, ids, Result types, constants shared

server/                           # Colyseus rooms (v1 private session)
  src/
    rooms/
    index.ts
```

Existing code under `src/game/` and `src/components/` is the **migration source**, not the end state.

### 3.4 Domain responsibilities

| Domain | Does | Does not |
|--------|------|----------|
| **match** | Phase machine (warmup/live/ended), round win, team scores, round rewards | Draw HUD, open WebGL |
| **combat** | Apply damage, ammo, reload timers, produce kill/hit events | Network transport |
| **bots** | Choose targets, issue move/aim/shoot intents, chatter lines | Resolve wall collision details (uses world) |
| **world** | Map definitions, collision resolution helpers, site positions | Ad pricing or creatives |
| **session** | Create/join room model, max players, bot-fill, host flags | Rendering |
| **ads** | Creative catalog, placement registry, impression records, rewarded rules | Three materials |
| **identity** | Nick, region, XP, daily mission progress | Match authority |

### 3.5 Dependency rules

```
presentation → domains, infrastructure (UI only)
infrastructure/render → domains (read snapshots / world) 
infrastructure/realtime → domains session/match DTOs
domains/* → shared only (no React, no Three, no Colyseus imports)
server → shared domain logic (or duplicated thin ports until package extract)
```

**Allowed:** `match` imports `combat` events; `bots` imports `world` queries.  
**Forbidden:** `ads` imports `render`; `combat` imports React; domains import `next/*`.

### 3.6 Runtime architecture

#### Client

1. **Presentation** mounts canvas + HUD.  
2. **Render adapter** owns WebGL lifecycle.  
3. **Match loop** (client prediction for local player) steps domain state at fixed tick or rAF with clamped dt.  
4. When in online room, **realtime** sends inputs; applies server snapshots / corrections.  
5. **Ads** domain receives view events (billboard entered view frustum optional later; v1: match start + lobby mount + end-match = impression).

#### Server (v1 private room)

1. Colyseus `GameRoom`: roster, bot-fill, authoritative positions/HP/rounds.  
2. Clients are not trusted for damage validation long-term; v1 may start simpler but design assumes **server authority** for HP and round outcomes.  
3. Region selection (BR/US) is a connection endpoint choice; v1 may be single region with UI toggle stored for v1.1.

### 3.7 Key interfaces (conceptual)

```ts
// domains/ads
type AdPlacement =
  | "lobby_banner"
  | "map_billboard"
  | "map_poster"
  | "end_match_break"
  | "rewarded_xp";

interface AdCreative {
  id: string;
  brand: string;
  headline: string;
  subline?: string;
  bg: string;
  bg2?: string;
  accent: string;
  text: string;
  cta?: string;
  url?: string;
  placements: AdPlacement[];
}

interface AdImpression {
  id: string;
  placement: AdPlacement;
  creativeId: string;
  sessionId: string;
  at: number;
}

// domains/match
type RoundPhase = "warmup" | "live" | "ended" | "match_over";

interface MatchSnapshot {
  phase: RoundPhase;
  round: number;
  timeLeft: number;
  scoreTR: number;
  scoreCT: number;
  // ...
}

// domains/session
interface RoomSession {
  code: string;
  region: "BR" | "US";
  maxPlayers: number;
  humanIds: string[];
  botFill: boolean;
}
```

Presentation consumes **snapshots**, never mutates domain internals directly except via explicit commands (`fire`, `reload`, `joinRoom`, `recordImpression`).

### 3.8 Tech stack

| Layer | Choice |
|-------|--------|
| Web framework | Next.js (App Router) + TypeScript |
| UI | React + Tailwind |
| 3D | Three.js behind `infrastructure/render` |
| Multiplayer | Colyseus (WebSocket rooms) |
| Scale later | Redis presence / multiple Colyseus nodes |
| Light API | Next route handlers or Hono (ads config, future accounts) |
| Audio (soon) | Web Audio / Howler — not blocking architecture |
| Analytics v1 | Domain events → `infrastructure/analytics` (console / local queue / later vendor) |

---

## 4. Feature breakdown by phase

### Phase 0 — Foundation (refactor, no product regression)

- Introduce `domains/*`, `presentation/*`, `infrastructure/*`, `shared/*`  
- Move catalog/maps/types into domains without breaking `/` and `/play`  
- Split fat engine: domain step vs render sync  
- Keep current single-player + bots playable  

### Phase 1 — Monetization v1

- Ads domain as source of truth for creatives + placements  
- Lobby banner + map slots + **end-match break UI**  
- Impression logging (local queue; optional `POST` later)  
- Sponsor-facing config shape documented in README or `docs/`  

### Phase 2 — Session v1 (private multiplayer)

- UI: create room, show code, join by code  
- Colyseus `GameRoom` + bot fill  
- Wire identity nick into roster  
- Disconnect / host leave rules (simple: room closes or promote)  

### Phase 3 — Retention polish

- Daily missions + XP grants (including rewarded stub hook)  
- Onboarding + pause + scoreboard already baseline — harden  
- Minimal SFX  

### Phase 4 — v1.1

- Public matchmaking  
- Rewarded real provider  
- Second map only if retention justifies  

---

## 5. Ads system design

### Placements

| Placement | Surface | When counted |
|-----------|---------|----------------|
| `lobby_banner` | HTML in lobby | Mount / rotate |
| `map_billboard` | 3D tower boards | Match start (v1); optional visibility later |
| `map_poster` | 3D wall posters | Match start |
| `end_match_break` | Full-screen/side panel after match | Match over |
| `rewarded_xp` | Modal opt-in | On complete callback |

### Creative pipeline

- Creatives live in domain catalog (code or CMS JSON later)  
- Render builds textures from creative fields (canvas) OR loads image URL if provided later  
- Changing a sponsor = data change, not gameplay change  

### Rewarded (v1.1 stub OK in Phase 1 as no-op UI)

- Command: `requestRewarded(placement)`  
- Port: `RewardedAdPort.show(): Promise<"completed" | "skipped" | "error">`  
- On `completed`, `identity.grantXp(amount)` or mission bonus  

---

## 6. Session / multiplayer design (v1)

### Room

- Code: 6 alphanumeric chars, case-insensitive  
- Max humans: e.g. 10 (configurable); bots fill to configured match size (e.g. 6 total for denser fights — exact numbers in implementation plan)  
- Modes: practice (local, no server) vs room (server)  

### Trust

- Server owns: HP, alive, round phase, scores, authoritative transform at low rate  
- Client owns: prediction for local movement, rendering, input sampling  

### Latency

- UI region BR/US stored for future endpoints  
- v1 may deploy one region; do not block launch on dual-region infra  

---

## 7. Migration strategy from current codebase

Current notable paths:

- `src/game/engine/GameEngine.ts` — monolith loop  
- `src/game/ads/catalog.ts`, `src/game/world/*`  
- `src/components/{menu,game,ads}`  

Migration order:

1. Create skeleton folders + re-export shims so imports keep working  
2. Move pure data (`maps`, `catalog`, `weapons`) into domains  
3. Extract `combat` and `match` pure functions; engine calls them  
4. Move React to `presentation/`  
5. Introduce `infrastructure/render` by wrapping Three setup from engine  
6. Delete shims when call sites updated  

No big-bang rewrite: each step leaves `/play` runnable.

---

## 8. Testing strategy

| Layer | What |
|-------|------|
| Unit | `combat` damage/armor; `match` phase transitions; `ads` impression shape; collision helpers |
| Integration | Room join mock; rewarded port fake |
| Manual | Lobby → play → death → pause → end match break; create/join room when server exists |

Prefer domain tests without WebGL.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Refactor stalls features | Phase 0 time-boxed; shims keep game running |
| Empty multiplayer | Bot fill always |
| Ad backlash | No mid-fight ads; short end break; rewarded optional |
| Cheating in rooms | Server authority path from v1 design |
| Scope creep (CS parity) | One map; bomb optional; YAGNI list enforced |

---

## 10. Open items (resolved enough for implementation planning)

| Item | Decision for plan |
|------|-------------------|
| Exact match size / bot count | Default 6 players (e.g. 1–5 humans + bots); adjustable constant |
| Bomb plant v1 | Optional nicety; elimination + timer sufficient for v1 if time-boxed |
| Account system | Local identity v1; no mandatory auth |
| Ad network vendor | None locked; port interface only |
| Colyseus hosting | Implementation plan picks simplest deploy (Fly/Railway/local Docker) |

---

## 11. Implementation sequencing (for the plan doc)

1. **Phase 0** — Domain restructure + engine split  
2. **Phase 1** — Ads metrics + end-match break + rewarded port stub  
3. **Phase 2** — Session UI + Colyseus private rooms + bot fill  
4. **Phase 3** — Retention (missions/XP) + audio minimum  
5. **Phase 4** — Matchmaking + real rewarded (post-v1)

Each phase ends with a playable build.

---

## 12. Approval

- Product direction (monetize + retain, browser): **approved**  
- Monetization A-strong + rewarded later: **approved**  
- Multiplayer private rooms then matchmaking: **approved**  
- Domain-module architecture: **approved**  
- User confirmation to write this spec: **2026-07-09**

Next step after human review of this file: **implementation plan** under `docs/superpowers/plans/` (no production code until that plan is accepted for execution).
