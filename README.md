# Friend Fire

Shooter tático **top-down** no navegador, inspirado no vibe do [RUSH B](https://x.com/wescld) (CS 2D / multiplayer tático).

**Stack:** Next.js 16 · React 19 · TypeScript · Three.js · Tailwind CSS 4 · Colyseus · Vitest

## Specs & plan

- Product design: [`docs/superpowers/specs/2026-07-09-friend-fire-product-design.md`](docs/superpowers/specs/2026-07-09-friend-fire-product-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-07-09-friend-fire-v1-implementation.md`](docs/superpowers/plans/2026-07-09-friend-fire-v1-implementation.md)
- Sponsor one-pager: [`docs/sponsors.md`](docs/sponsors.md)

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Next.js client (http://localhost:3000) |
| `npm run dev:server` | Colyseus multiplayer server (ws://localhost:2567) |
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
| `NEXT_PUBLIC_COLYSEUS_URL` | `ws://localhost:2567` | WebSocket URL for Colyseus (`src/infrastructure/realtime/roomClient.ts`) |
| `NEXT_PUBLIC_DEBUG_ROUNDS_TO_WIN` | *(unset)* | QA only. Positive integer overrides `roundsToWin` (prod default **8**). Example: `1` to force `match_over` quickly. Unset in production. |

```bash
# optional .env.local
NEXT_PUBLIC_COLYSEUS_URL=ws://localhost:2567
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

Private rooms use Colyseus (`server/`, room name `game`).

```bash
# terminal A — Next.js
npm run dev

# terminal B — Colyseus
npm run dev:server
# or: cd server && npm run dev
```

1. Lobby → **Criar sala** (server must be up) → share the 6-char code  
2. Second browser / profile → **Entrar por código**  
3. Both open `/play?mode=room&code=XXXXXX` · HUD shows **SALA XXXXXX** from server state  

**Authoritative combat (room mode):** when Colyseus is connected, movement, hitscan fire, bots, and round wipes run on the server. The client predicts local motion and plays SFX; HP/positions reconcile from state. Offline **Jogo rápido** still runs full local sim. If the server is down, room create fails with a clear message.

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
| Tab | Placar |
| Esc | Pausar / fechar loja |
| H | Ajuda (controles) |
| F | Respawn manual (só no aquecimento, se morto) |

## O que já tem (v1 + wave 2A/B)

- Câmera isométrica / top-down (Three.js) + polish visual Dust FF
- Buy menu, SFX procedural, câmera livre
- Ads in-game + lobby/pausa + end-match break + rewarded XP stub
- Solo local com bots **e** salas privadas com **combate no server**
- Rounds: aquecimento → live → fim → **match_over**
- HUD completo · lobby · domínios com `npm test`

## Roadmap

1. Lag compensation / reconciliation mais fina · armas no server  
2. Public matchmaking + Redis multi-node  
3. Real ad network SDK  
4. C4 plant/defuse · missões diárias de verdade  
5. Mais mapas · cosmetics store  
6. Mobile touch controls  

## Build

```bash
npm test
npm run build
npm start
```
