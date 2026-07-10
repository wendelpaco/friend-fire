# Sprint 1 · Entrega 4 — Bomba = drama

**Prompt Claude Code** — colar como tarefa única. Assume entrega 1 (ObjectiveChip) e timers da entrega 3 (40s fuse).

---

## Contexto

Locks: timers C4 40s / defuse 5s / 3,5s kit — **não** mudar além de padronizar se divergirem.

Arquivos âncora:

- Bomb sim: `src/domains/match/bomb.ts`, `server/src/sim/bomb.ts`  
- HUD: `src/presentation/game/GameHud.tsx` (timer C4 separado hoje ~L293–318; barras plant/defuse ~L383–408)  
- PhaseLabel / timer: `src/presentation/ui/PhaseLabel.tsx`  
- FX bomb: `src/infrastructure/render/fx/BombMarkerSystem.ts`  
- Audio: `src/infrastructure/audio/Sfx.ts`  
- HudSnapshot bomb fields: `src/game/types.ts`  
- Character world position for radial  

**Objetivo:** o plant reorganiza a atenção de todos **sem** banner persistente. Drama no relógio e no corpo.

## Trabalho

### 1. Timer central se transforma (P0)

- No plant: o **timer central** do topo (mesmo bloco do round clock) **vira** o timer da C4.  
- Remover o segundo timer C4 duplicado abaixo do placar (ou fundir visualmente).  
- Transição: âmbar → vermelho + pulso 1s; frame do timer com cantos chanfrados no estado bomb (acessibilidade além da cor).  
- PhaseLabel `"C4 PLANTADA"` ≤2s.  
- Site pulsa no minimapa (se API do minimapa permitir; senão marker world já existente).  
- Últimos 10s: pulso acelera.  
- Estados do componente Timer: `normal` | `low` (<10s round) | `bomb`.

### 2. Radial plant/defuse no personagem (P0)

- Anel de progresso **world-space** ao redor do player que planta/defusa (não barra no centro do HUD).  
- Microcopy pequena acima: `SEGURE F`.  
- Defuse com kit: anel mais rápido + cor distinta (ex. verde/success vs âmbar plant).  
- Inimigos veem o anel (fake plant legítimo).  
- Raio mínimo em **px de tela** (não some no zoom out).  
- Remover/ocultar barras HUD de plant/defuse centrais legadas.

### 3. Áudio da bomba (P0)

- Beep global com **atenuação por distância** ao plant site.  
- Acelera nos últimos **15s**.  
- Heartbeat nos últimos 10s (leve) se SFX permitir sem poluir.

### 4. ObjectiveChip (fechar com entrega 1)

- Portador da C4: chip âmbar “C4” acima da hotbar + slot 5 highlighted.  
- Zero banner vermelho persistente para “você tem a C4”.

### 5. Padronizar defuse times

- Confirmar server: plant hold, defuse 5.0 / kit 3.5.  
- Kit $400 se ainda não existir no shop — só se já houver item kit; senão manter defuse único e documentar.

## Não fazer

- Mudar duração do fuse (40s)  
- Vision cone  
- Mudar sites do mapa  
- Chat de mortos / death recap (Sprint 1 social só se já existir)  

## Acceptance criteria

- [ ] Radial plant/defuse legível no zoom padrão, world-space  
- [ ] Timer central transforma no plant (sem segundo relógio competindo)  
- [ ] Beep com atenuação + aceleração final  
- [ ] Banner vermelho antigo de C4 removido; ObjectiveChip no lugar  
- [ ] PhaseLabel “C4 PLANTADA” ≤2s  
- [ ] Teste mental/play: jogador novo entende plant sem ler texto longo  
- [ ] Server authority plant/defuse intacta  

## Verificação

```bash
bun test src/domains/match
```

Playtest: carregar C4 → só chip; segurar F no site → anel no corpo; plant → timer vermelho + beep; defuse visível ao inimigo.
