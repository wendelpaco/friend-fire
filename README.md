# Friend Fire

Shooter tático **top-down** no navegador, inspirado no vibe do [RUSH B](https://x.com/wescld) (CS 2D / multiplayer tático).

**Stack:** Next.js 16 · React 19 · TypeScript · Three.js · Tailwind CSS 4

## Rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

- **Menu** → `/`
- **Partida** → `/play` (ou botão *Jogo Rápido*)

## Multiplayer dev

Private rooms use a Colyseus server (`server/`, room name `game`).

```bash
# terminal A — Next.js client
npm run dev

# terminal B — Colyseus on ws://localhost:2567
npm run dev:server
# or: cd server && npm run dev
```

1. Open the lobby → **Criar sala** (needs server up) → share the 6-char code  
2. Second browser / profile → **Entrar por código** → same code  
3. Both land on `/play?mode=room&code=XXXXXX` with HUD **SALA XXXXXX** from server state  

Env (optional):

```bash
NEXT_PUBLIC_COLYSEUS_URL=ws://localhost:2567
```

**Hybrid v1:** create/join + roster/code sync go through Colyseus; movement/combat/bots still simulate locally in the browser until the server owns combat. If the server is down, create fails with a clear message; play mode still loads local combat with a disconnect banner.
## Controles

| Tecla | Ação |
|--------|------|
| WASD / setas | Mover |
| Mouse | Mirar |
| Clique esquerdo | Atirar |
| R | Recarregar |
| 1–4 | Trocar arma |
| Tab | Placar |
| Esc | Pausar / menu |
| H | Ajuda (controles) |
| F | Respawn manual (só no aquecimento, se morto) |

## O que já tem

- Câmera isométrica / top-down com Three.js (tone mapping, sombras, partículas)
- Mapa `Dust FF` com paredes, carros, barris, dumpsters e bomb sites A/B
- **Outdoors e posters de anúncio** in-game (monetização) + banners no lobby/pausa
- Jogador local + bots TR/CT com chat de rádio
- Tiro, faca, reload, hit marker, flash de dano
- Rounds: aquecimento → live → fim de round
- HUD profissional: vida, colete, munição, economia, minimapa, killfeed
- Menu de pausa, placar (Tab), ajuda na primeira partida
- Lobby com nickname, região BR/US e missões do dia

## Monetização (ads)

- Catálogo em `src/game/ads/catalog.ts` — troque creatives sem mexer na engine
- Slots 3D: `map.billboards` + `map.wallPosters` em `src/game/world/maps.ts`
- UI: `AdBanner` no menu e na pausa (`menu_banner`, `pause_banner`)
- Cada creative tem badge **AD** (disclosure)

## Estrutura

```
src/
  app/                 # rotas Next.js
  components/
    menu/              # lobby
    game/              # canvas + HUD
  game/
    engine/            # GameEngine, Input
    world/             # mapas e colisão
    constants.ts
    types.ts
```

## Próximos passos (roadmap)

1. **Multiplayer online** — Colyseus + Redis (salas BR/US)
2. **API** — Hono para conta, XP, missões
3. **Buy menu** entre rounds
4. **C4** plantar/desarmar de verdade
5. **Mais mapas** e modos
6. **Áudio** (passos, tiros, rádio)
7. **Bots com LLM** para callouts/xingos dinâmicos

## Build

```bash
npm run build
npm start
```
