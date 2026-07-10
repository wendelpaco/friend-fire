# Friend Fire

Shooter tático **top-down** no navegador, inspirado no vibe do [RUSH B](https://x.com/wescld) (CS 2D / multiplayer tático).

**Stack:** Next.js 16 · React 19 · TypeScript · Three.js · Tailwind CSS 4 · Colyseus · Vitest

## Specs & plan

- Product design: [`docs/superpowers/specs/2026-07-09-friend-fire-product-design.md`](docs/superpowers/specs/2026-07-09-friend-fire-product-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-07-09-friend-fire-v1-implementation.md`](docs/superpowers/plans/2026-07-09-friend-fire-v1-implementation.md)
- Maps: [`docs/maps.md`](docs/maps.md)
- Sponsor one-pager: [`docs/sponsors.md`](docs/sponsors.md)
- Wave 3 features: [`docs/superpowers/specs/2026-07-09-wave3-product-features-design.md`](docs/superpowers/specs/2026-07-09-wave3-product-features-design.md) · short runbook [`docs/wave3.md`](docs/wave3.md)
- Wave 4 features: [`docs/superpowers/specs/2026-07-09-wave4-product-features-design.md`](docs/superpowers/specs/2026-07-09-wave4-product-features-design.md) · short runbook [`docs/wave4.md`](docs/wave4.md)
- Wave 5 features: [`docs/superpowers/specs/2026-07-09-wave5-product-features-design.md`](docs/superpowers/specs/2026-07-09-wave5-product-features-design.md) · short runbook [`docs/wave5.md`](docs/wave5.md)

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Next.js client (http://localhost:3000) |
| `npm run dev:server` | Colyseus multiplayer server (ws://127.0.0.1:2567) |
| `npm run dev:all` | Next + Colyseus (two processes; prefer two terminals) |
| `npm test` | Vitest unit tests (domains + infra) |
| `npm run test:watch` | Vitest watch mode |
| `npm run build` | Production Next.js build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |

```bash
npm install
npm run dev
```

- **Menu** → `/`
- **Partida** → `/play` (ou botão *Jogo Rápido*)

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_COLYSEUS_URL` | `ws://127.0.0.1:2567` | WebSocket URL for Colyseus (`src/infrastructure/realtime/roomClient.ts`) |
| `NEXT_PUBLIC_DEBUG_ROUNDS_TO_WIN` | *(unset)* | QA only. Positive integer overrides `roundsToWin` (prod default **8**). Example: `1` to force `match_over` quickly. Unset in production. |

```bash
# optional .env.local
NEXT_PUBLIC_COLYSEUS_URL=ws://127.0.0.1:2567
# NEXT_PUBLIC_DEBUG_ROUNDS_TO_WIN=1   # QA only
```

## Architecture

Layered layout: pure **domains** (rules), **presentation** (React UI), **infrastructure** (Three.js, storage, realtime, analytics), **server** (Colyseus authority path).

```
friend-fire/
├── src/
│   ├── app/                    # Next.js routes (/, /play)
│   ├── domains/                # Pure game rules (no React / Three)
│   │   ├── ads/                # catalog, impressions, rewarded port
│   │   ├── combat/             # damage, weapons, reload
│   │   ├── identity/           # nick, XP, missions (local)
│   │   ├── match/              # phases, economy, roundsToWin
│   │   ├── session/            # room codes, roster, bot fill
│   │   └── world/              # Dust FF map, collision
│   ├── presentation/           # React UI
│   │   ├── ads/                # AdBanner
│   │   ├── game/               # GameCanvas, GameHud, EndMatchBreak
│   │   └── lobby/              # MainMenu, RoomPanel
│   ├── infrastructure/         # Adapters
│   │   ├── analytics/          # impression queue → localStorage
│   │   ├── realtime/           # Colyseus roomClient
│   │   ├── render/             # GameClient, ThreeRenderer, input
│   │   └── storage/            # local identity
│   ├── game/                   # Thin shims + engine entry (legacy paths)
│   └── shared/                 # ids, math, team types
└── server/                     # Colyseus (rooms, schema, phase sim)
    └── src/
        ├── rooms/GameRoom.ts
        ├── schema/MatchState.ts
        └── sim/                # codes, phases (server-side)
```

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ presentation │ ──► │ domains (pure)   │ ◄── │ infrastructure  │
│ lobby / HUD  │     │ match, combat,   │     │ Three, Colyseus │
│ ads UI       │     │ ads, session…    │     │ storage, queue  │
└──────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                       ┌──────────────────┐            │
                       │ server/ (Colyseus)│ ◄──────────┘
                       │ rooms + combat   │  authoritative
                       └──────────────────┘
```

## Monetization (ads)

**Rule:** no mid-fight ad UI. Ads only on lobby, pause, map scenery, and end-of-match break.

| Placement | Surface | When |
|-----------|---------|------|
| `lobby_banner` | `AdBanner` no menu | mount / rotate |
| `pause_banner` | `AdBanner` na pausa | Esc pause |
| `map_billboard` | 3D outdoor towers | match start (Dust FF) |
| `map_poster` | 3D wall posters | match start |
| `end_match_break` | painel pós-partida | `match_over` |
| `rewarded_xp` | stub opt-in | end break → grants XP |

### How to swap creatives

1. Edit **`src/domains/ads/catalog.ts`** (`AD_CATALOG`) — change brand, colors, CTA, `placements[]`. No engine changes needed.
2. Map slots reference creative **ids** in `src/domains/world/maps/dust.ts` (`billboards`, `wallPosters`).
3. Shim re-export: `src/game/ads/catalog.ts` → domains (keep imports stable).
4. Impressions: `recordImpression` + queue → `localStorage` key `ff_ad_impressions`.
5. Sponsor sales one-pager: [`docs/sponsors.md`](docs/sponsors.md) · contact **anuncie@friendfire.gg**

## Multiplayer (dev)

Rooms use Colyseus (`server/`, room name `game`). **Public** rooms appear in the server browser; **private** rooms are invite/code-only (not listed by default).

Full wave 3 product notes: [`docs/wave3.md`](docs/wave3.md) · design: [`docs/superpowers/specs/2026-07-09-wave3-product-features-design.md`](docs/superpowers/specs/2026-07-09-wave3-product-features-design.md).  
Wave 4 (prefs, region filter, reconnect, queue UI): [`docs/wave4.md`](docs/wave4.md) · design: [`docs/superpowers/specs/2026-07-09-wave4-product-features-design.md`](docs/superpowers/specs/2026-07-09-wave4-product-features-design.md).  
Wave 5 (C4, HE, spectator, ranks, banners): [`docs/wave5.md`](docs/wave5.md) · design: [`docs/superpowers/specs/2026-07-09-wave5-product-features-design.md`](docs/superpowers/specs/2026-07-09-wave5-product-features-design.md).

```bash
# terminal A — Next.js
npm run dev

# terminal B — Colyseus (required for multiplayer / room mode)
npm run dev:server
# health check: curl http://127.0.0.1:2567/health
# or: cd server && npm run dev
```

1. Lobby → **Criar sala** (server must be up) → toggle **Sala pública** (default on) or keep private → share the 6-char code **or** **Copiar link do convite**  
2. Second browser / profile → **Entrar por código**, open the invite URL, **Procurar salas**, or **Jogo rápido online** (Quick Match)  
3. Both play with `/play?mode=room&code=XXXXXX&host=0` · HUD shows **SALA XXXXXX** + copy-link chip  

### Public / private rooms

| Visibility | Browser list | Join |
|------------|--------------|------|
| `public` (default) | Shown when listing | Code, invite link, browser, Quick Match |
| `private` | Hidden from default list | Code or invite link only |

Create passes `visibility` into Colyseus room options/metadata. Private rooms avoid spam in the public browser.

### Quick Match & filters

- **Jogo rápido online:** `listRooms({ hasSlots: true, visibility: "public" })` → prefer last map (`ff_last_map`) → else fullest public room with slots → if none, `create({ mapId, visibility: "public" })` as host.  
- **Procurar salas** filters: map dropdown (all + each map), checkbox **Só com vaga** (`hasSlots`), refresh. Optional ping RTT in browser header when the Colyseus HTTP host is reachable.  
- Offline **Jogo rápido** (solo) still runs full local sim without the server.

### Invite link

```
${origin}/play?mode=room&code=XXXXXX&host=0
```

Built by `buildInviteUrl` / `CopyInviteLink` (`src/domains/session/invite.ts`). Guests use `host=0`; the create host path uses `host=1` when entering the room.

### Maps

| id | Name |
|----|------|
| `dust` | Dust FF (default) |
| `favela` | Favela |
| `yard` | Yard |

- Map list / ids: [`docs/maps.md`](docs/maps.md)  
- Last pick stored in `localStorage` key **`ff_last_map`** via `getLastMapId` / `setLastMapId`  
- Solo: `/play?map=dust|favela|yard` · rooms carry `mapId` from create / server state  

### Server browser & `GET /rooms`

- **Lobby UI:** **Procurar salas** → live list (nome, mapa, jogadores, fase, código, visibility, entrar) with filters + refresh.  
- **HTTP API** (Colyseus process, default `http://localhost:2567`):

```http
GET /rooms?mapId=&hasSlots=1&visibility=public
```

| Query | Effect |
|-------|--------|
| *(none)* / `visibility=public` | Default: **public** rooms only |
| `visibility=private` | Private rooms (if ever needed for tooling) |
| `mapId=dust\|favela\|yard` | Exact map match |
| `hasSlots=1` | `clients < maxClients` only |

Example payload (open `game` rooms):

```json
[
  {
    "roomId": "…",
    "code": "ABC234",
    "mapId": "dust",
    "mapName": "Dust FF",
    "roomName": "",
    "clients": 3,
    "maxClients": 10,
    "phase": "warmup",
    "visibility": "public"
  }
]
```

Create accepts optional `mapId`, room label, and `visibility`; room metadata exposes the same fields for the browser.

**Authoritative combat (room mode):** when Colyseus is connected, movement, hitscan fire, bots, and round wipes run on the server. The client predicts local motion and plays SFX; HP/positions reconcile from state. If the server is down, room create / Quick Match fails with a clear message.

### Match stats & daily leaderboard (local)

- **Match end:** on `match_over`, stats card for local player (kills, deaths, K/D, money, win/loss/draw, map) before/alongside the end-match ad break. History: `localStorage` **`ff_match_history`** (last ~20).  
- **Ranking do dia:** lobby top 5 by kills (tie-break wins), key **`ff_leaderboard_v1`**, resets when `dayKey` (`YYYY-MM-DD`) changes. No accounts — pure client storage.

### Fog of war (client-only)

Local vision radius (~14 world units): distant enemies hidden / area dimmed. **Presentation only** — does not change server authority or hitscan. Default ON; toggle in pause / Settings (`ff_fog_enabled`). See wave 3 design §2.5 · wave 4 §2.1.

### Wave 4 lobby & pause polish

| Feature | Notes |
|---------|--------|
| Settings (pause) | Volume (`ff_volume`), fog, camera default locked/free (`ff_camera_default`) |
| Region on rooms | `BR` \| `US` on create/metadata/list; filter `GET /rooms?region=`; default from identity |
| Map chips | Accent color swatches in ServerBrowser + RoomPanel (no image assets) |
| Rejoin | `ff_last_room_code` after leave/disconnect; lobby **Reentrar na última sala** |
| Quick Match queue | “Procurando partida…” overlay + cancel |
| Room full | Join error “Sala cheia”; Entrar disabled when `clients >= maxClients` |
| Kill feed | Max ~6 lines, fade polish, death/spectate hint |

Runbook: [`docs/wave4.md`](docs/wave4.md).

### Wave 5 combat loop & retention

| Feature | Notes |
|---------|--------|
| C4 | Plant/defuse/explode on bomb sites; **F** hold; 40s timer; HUD marker + timer |
| Round banners | Toast: TR/CT win, bomb exploded / defused |
| Spectator | Death → follow killer / free cam (Space) |
| HE grenade | Shop $300; throw **G**; AoE damage |
| Soft ranks | Local XP tiers (Recruta→Lenda) on profile |
| Scoreboard | TAB K/D + MVP; hit damage numbers |

Runbook: [`docs/wave5.md`](docs/wave5.md).

## Controles

| Tecla | Ação |
|--------|------|
| WASD / setas | Mover (ou pan da câmera no modo livre) |
| Mouse | Mirar |
| Clique esquerdo | Atirar |
| R | Recarregar |
| B | Loja (aquecimento / entre rounds) |
| C | Câmera travada / livre |
| 1–4 | Trocar arma |
| G | Arremessar HE (se comprada) |
| Tab | Placar |
| Esc | Pausar / fechar loja |
| H | Ajuda (controles) |
| F | Plantar / desarmar C4 (live no site) · respawn manual (só aquecimento, se morto) |
| Espaço | Spectator: soltar câmera (free follow) quando morto |

## O que já tem (v1 + wave 2 + wave 3 + wave 4 + wave 5)

- Câmera isométrica / top-down (Three.js) + polish visual Dust FF
- Buy menu, SFX procedural, câmera livre
- Ads in-game + lobby/pausa + end-match break + rewarded XP stub
- Solo local com bots **e** salas **públicas/privadas** com **combate no server**
- Server browser (filtros map/slots/region, ping, map chips) · Quick Match queue UI · invite · multi-map
- Match-end stats + ranking local do dia · fog toggle + Settings (volume, camera)
- Rejoin última sala · room full UX · kill feed polish
- **C4** plant/defuse/explode · **HE** · **spectator** · round **banners** · soft **ranks**
- Rounds: aquecimento → live → fim → **match_over**
- HUD completo · lobby · domínios com `npm test`
- Wave 3: [`docs/wave3.md`](docs/wave3.md) · Wave 4: [`docs/wave4.md`](docs/wave4.md) · Wave 5: [`docs/wave5.md`](docs/wave5.md)

## Roadmap

1. Lag compensation / reconciliation mais fina · armas no server  
2. Redis multi-node / ranked matchmaking (ELO server)  
3. Real ad network SDK  
4. Full utility set · missões diárias de verdade  
5. Mais mapas · cosmetics store  
6. Mobile touch controls  

## Build

```bash
npm test
npm run build
npm start
```
