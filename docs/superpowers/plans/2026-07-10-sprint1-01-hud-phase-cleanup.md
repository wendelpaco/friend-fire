# Sprint 1 · Entrega 1 — HUD por fase + limpeza

**Prompt Claude Code** — colar como tarefa única. Não implementar Sprint 2.

---

## Contexto

Friend Fire (repo monorepo Next.js + Colyseus). Design System v2 e locks em:

- `docs/superpowers/specs/2026-07-10-game-design-v2-locks.md`
- Design tokens: `src/app/design-tokens.css`
- HUD principal: `src/presentation/game/GameHud.tsx`
- Slots: `src/presentation/ui/WeaponSlot.tsx`
- Chat: `src/presentation/session/SquadChat.tsx`, domínio `src/domains/session/chat.ts`
- Phase/timer: `src/presentation/ui/PhaseLabel.tsx`
- Help/controls: `src/game/constants.ts` (`CONTROLS_HELP`)
- Snapshot: `src/game/types.ts` (`HudSnapshot`), publish `src/infrastructure/render/hudPublish.ts`

**Objetivo:** HUD de combate mínimo e legível; menus que respiram. Sem sistemas de gameplay novos.

## Regras do craft (obrigatórias)

1. Zona central (~60%) livre de UI **persistente** no live  
2. Uma informação nova por vez; banner só evento ≤3s  
3. Estado (C4 carregada, etc.) = chip, não banner vermelho  
4. XP/NV **fora** do live  
5. Microcopy: verbo primeiro, ≤4 palavras, CAPS em comandos; PT-BR  
6. Timer domina 1 nível visual acima dos placares TR/CT  

## Trabalho

### 1. Overlay de debug fora de produção

- Qualquer UI tipo `debugbot · arma · BOT nome` (se existir no canvas/HUD/renderer) só com flag de build/env (`NODE_ENV !== "production"` ou `NEXT_PUBLIC_DEBUG_*`).  
- Preferir tree-shake / dead-code em produção, não só `display: none`.  
- Procurar em `GameClient`, `botTick`, `ThreeRenderer`, `GameHud`, overlays de perf avançados.

### 2. Banner C4 persistente → ObjectiveChip (parcial)

- Remover/neutralizar `hud.bombPrompt` como banner vermelho/central **persistente** enquanto carrega C4.  
- Criar chip âmbar discreto **acima da hotbar** (ex. “C4”) quando o jogador carrega a bomba.  
- Banner central só em eventos (plant start/complete, etc.) ≤3s se já houver.  
- Slot 5 (C4) destacado quando presente — ver `WeaponSlot` states.  
- *Nota:* radial world-space e timer-transform ficam na entrega 4; aqui só limpar o ruído do HUD.

### 3. XP / NV fora do live

- Qualquer barra “NV n” / progresso de XP sob o timer ou no centro **não renderiza** em `phase === "live"` (nem planted se for o mesmo HUD de combate).  
- XP no fim de round/partida OK (já existente em end match / identity).

### 4. Atalhos contextuais

- Strip permanente (`B loja · C câmera · R · Tab · Esc` em `GameHud` ~L455–463) →  
  - Visível só nos **2 primeiros rounds jogados** pelo jogador (persistir contador localStorage ou campo de sessão).  
  - Depois some.  
  - Reaparece **segurando TAB** (além do placar) ou enquanto help aberto.  
- Não redesenhar o minimapa.

### 5. Hotbar: ocultar slots vazios

- `WeaponSlot` / `hud.weapons`: **não renderizar** slots sem item.  
- Manter numeração fixa dos existentes (1 primária · 2 secundária · 3 util · 4 faca · 5 C4) — memória muscular.  
- Estado `empty` = não monta no DOM.

### 6. Chat no live

- Default canal **TIME/team** no Enter (não “Todos”).  
- “Todos” só via comando explícito (`/todos` ou UI explícita).  
- Dock **colapsado** em combate: últimas 2 msgs, fade ~6s; Enter expande input.  
- Mortos: dock expandido (já parcialmente em `DeathSocialPanel`) — canal mortos; nunca vazar para vivos (regra existente — não regredir).

### 7. Hierarquia do topo

- Bloco TR | timer | CT: o **timer** (número mono) 1 nível acima (tamanho/peso/contraste) dos placares.  
- Não adicionar elementos novos ao HUD além de ObjectiveChip.

## Não fazer

- Redesenhar minimapa  
- Vision cone, sound pings, smoke  
- Mudar timers/economia (entrega 3)  
- Radial plant no personagem (entrega 4)  
- Contas / matchmaking público  

## Acceptance criteria (verificar antes de fechar)

- [ ] Slots vazios ocultos; numeração dos slots com item permanece 1–5 correta  
- [ ] Hints de teclas somem após 2 rounds do jogador; voltam segurando TAB  
- [ ] XP/NV ausente do HUD live  
- [ ] Zona central ~60% livre de UI persistente no live  
- [ ] Chat default TIME; colapsado em live; /todos explícito  
- [ ] Overlay de debug impossível em production build  
- [ ] Banner vermelho “você tem a C4…” sumiu; chip âmbar + slot 5 no lugar  
- [ ] Timer visualmente dominante vs placares TR/CT  
- [ ] Testes existentes relevantes passam; adicionar testes unitários onde houver lógica pura (chat default, contador de rounds de onboarding)

## Verificação

```bash
# client
bun test
# se houver lint
bun run lint
```

Jogar 1 round offline: confirmar visualmente AC acima.
