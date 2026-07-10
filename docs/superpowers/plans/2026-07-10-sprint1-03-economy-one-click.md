# Sprint 1 · Entrega 3 — Economia 1-clique + timers + formato

**Prompt Claude Code** — colar como tarefa única. Locks F2, F3, F5, F6.

---

## Contexto

Locks: `docs/superpowers/specs/2026-07-10-game-design-v2-locks.md`

Arquivos âncora:

- Timers client: `src/domains/match/types.ts` (`DEFAULT_MATCH`), `phases.ts`  
- Timers server: `server/src/sim/phases.ts` (**manter sync**)  
- Economia: `src/domains/match/economy.ts` (+ tests), mirror server se existir  
- Kits: `src/domains/combat/kitSuggest.ts`, `ShopShowcase.tsx`  
- Buy UI: `src/presentation/game/BuyMenu.tsx`  
- Shop: `src/domains/combat/shop.ts`, `server/src/sim/shop.ts`  
- GameClient buy path / rebuy: `GameClient.ts`, room messages  
- Constants: `src/game/constants.ts` (`DEBUG_ROUNDS_TO_WIN`)  
- Bomb timings: `server/src/sim/bomb.ts` (`BOMB_TIMER = 40` já ok)

**Objetivo:** comprar bem em ≤2 inputs; partida encaixa em 10–16 min.

## Trabalho

### 1. Timers B2 (F5) — client **e** server

| Constante | Novo valor |
|-----------|------------|
| Warmup | até encher ou **30s** (ajustar default; manter early-start se sala cheia) |
| Buy / freezetime | **10s** |
| 1º round + pós-troca de lado | **12s** buy |
| Live | **100s** (1:40) |
| End pause | **5s** (já) |
| C4 fuse | **40s** (já) |
| Defuse | **5s** / **3,5s** com kit ($400 se kit existir no catálogo — senão documentar gap) |

### 2. Formato FT5 + half (F2, F3)

- `roundsToWin = 5` (máx. 9 rounds implícito).  
- Após round **4** completo: **troca de lado** (TR↔CT), economia reseta ao start money (ou regra CS half — documentar escolha; default: reset $800 start + limpar loadout para pistol team default).  
- Freezetime 12s no round 1 e no primeiro round pós-troca.  
- Overtime MR2 se 4–4: **fora de escopo** (P2) — se 4–4, próximo round decide até FT5 (round 9 max natural).  
- Atualizar `NEXT_PUBLIC_DEBUG_ROUNDS_TO_WIN` help se necessário.

### 3. Economia defaults B3 (F6)

Já perto do CS em `economy.ts` — confirmar e alinhar:

| Evento | $ |
|--------|---|
| Vitória | 3.250 |
| Derrota ladder | 1.400 → 1.900 → 2.400 → 2.900 (cap; v2 tabela para em 2.900 no 4º — **não** exigir 3.400 se doc v2 parar em 2.900; preferir tabela do design v2: 1400/1900/2400/2900) |
| Kill | 300 |
| Plant pessoal | +300 |
| Explosão time | +800 |
| **Piso absoluto** | nunca abaixo de **1.000** após payouts de round (clamp mínimo pós-round; não impedir gastar até 0 no buy) |

- Server deve aplicar a mesma lógica.  
- **Não** rebalancear preços do catálogo de armas.

### 4. Kits 1-clique + rebuy (F6)

- Topo do `BuyMenu`: 3 cartões **ECO / FORÇA / COMPLETO** com ícones do conteúdo + total.  
- Hotkeys **F1 / F2 / F3** compram kit válido pelo dinheiro atual (só itens affordáveis / kit recalculado).  
- **R** recompra loadout do último round (arma(s)+colete se existiam e cabem no $).  
- Loja granular continua abaixo.  
- Expandir `suggestKits` para sempre oferecer 3 tiers quando possível (já existe base).  
- Server-authoritative: cliente manda `buyKit` / `rebuy`; server valida fase buy/warmup, saldo, preços.  
- Loja **abre automática** no freezetime (config opcional para desligar; B reabre).

### 5. Telemetria tempo-no-buy

- Emitir evento analytics (infra existente `src/infrastructure/analytics/`) com `buy_open_ms` → `buy_close_or_live_ms` por round.  
- Meta produto <5s (só instrumentar; não bloquear UX).

## Não fazer

- Rebalancear preços de armas  
- Painel “economia do time” (P2)  
- Drop G (P1 — só se sobrar tempo e for trivial)  
- Vision cone  

## Acceptance criteria

- [ ] F1/F2/F3 compram kit válido pelo $ atual (server rejeita se inválido)  
- [ ] R recompra último loadout quando afford  
- [ ] Loja abre automática no freezetime  
- [ ] `DEFAULT_MATCH` client = server: buy 10, live 100, roundsToWin 5  
- [ ] Half após round 4 com side swap + buy 12s  
- [ ] Piso $1000 e ladder de loss alinhados; testes economy verdes  
- [ ] Telemetria tempo-no-buy implantada  
- [ ] Preços de catálogo inalterados  

## Verificação

```bash
bun test src/domains/match src/domains/combat
# server
cd server && bun test 2>/dev/null || npx tsc --noEmit
```

Playtest: freezetime → F3 → ready em <5s; derrota 2x → ladder sobe; após round 4 → troca de lado.
