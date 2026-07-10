# Sprint 1 · Entrega 2 — Gunfeel pack (+ remover crouch F4)

**Prompt Claude Code** — colar como tarefa única. Depende de entrega 1 (HUD limpo) de forma fraca; pode seguir em paralelo se não tocar os mesmos arquivos de UI.

---

## Contexto

Locks: `docs/superpowers/specs/2026-07-10-game-design-v2-locks.md` (**F4 = remover crouch**)

Arquivos âncora:

- Accuracy: `src/domains/combat/accuracy.ts` (+ tests), mirror server se houver  
- Armas: `src/domains/combat/weapons.ts`, `server/src/sim/weapons.ts`  
- Reticle: `src/infrastructure/render/fx/AimReticleSystem.ts`  
- FX: `src/infrastructure/render/fx/` (`MuzzleFlashSystem`, `TracerSystem`, `ImpactParticleSystem`, `DamageNumberSystem`)  
- Motor: `src/domains/world/motor.ts`, `server/src/sim/motor.ts`  
- Input: `src/game/engine/Input.ts`, `src/infrastructure/render/input.ts`  
- Character: `src/infrastructure/render/character/`  
- GameClient / fire path: `src/infrastructure/render/GameClient.ts`  
- Network: `GameCanvas.tsx` envia `crouch` hoje  

**Objetivo:** cada tiro e cada dano legíveis em 1 frame. **Não** rebalancear armas (valores de dano/cadência/preço).

## Trabalho

### A. Círculo de dispersão no mundo (P0)

- Círculo fino (1px, ~60% opacidade) no chão em torno do ponto de aim / cursor world, raio = cone real do **primeiro tiro** (usar `shotSpreadRadians` / knobs da arma atual).  
- Abre ao mover/atirar; fecha parado ~150ms (alinhado a recovery/stop).  
- Some ou colapsa no mínimo quando spread efetivo ≈ first-shot mínimo.  
- Custo frame: desprezível (<1ms total do pack em laptop médio).  
- Estender `AimReticleSystem` **ou** sistema irmão — preferir reutilizar reticle existente se fizer sentido.

### B. Pacote hit feedback (P0)

1. **Hitflash** branco ≤80ms no inimigo atingido (mesh/outline).  
2. **Arco direcional de dano** world-space no **seu** personagem, 300ms, aponta origem do dano; **máx. 1 arco** (o mais recente).  
3. **Kill confirm:** SFX seco + linha do killfeed com destaque se você é killer (borda âmbar — pode já existir parcialmente em `KillFeedItem`).  

Não spammar damage numbers flutuantes (anti-padrão do design v2 — se `DamageNumberSystem` poluir o live, reduzir ou desligar no combate padrão).

### C. Stop-shoot window (P1, se couber sem creep)

- Soltar tecla de movimento: zerar/acelerar recovery de spread para first-shot em ~100ms (counter-strafe simplificado).  
- Deve ser legível via círculo de dispersão.  
- Testes unitários em `accuracy.ts`.

### D. Remover crouch (F4 LOCKED)

- Remover estado de crouch do motor client + server (raio único standing, sem `CROUCH_*`).  
- Remover input CTRL toggle/hold e bits de rede `crouch` (ou ignorar no server com depreciação limpa).  
- Remover mult de accuracy por crouch em `accuracy.ts`.  
- Atualizar help text (`CONTROLS_HELP`), docs de motor se tocados, testes de motor/crouch.  
- Cover/mapas: hitbox único standing — não redesenhar mapas neste prompt.  
- **Não** deixar código morto de crouch “comentado”.

### E. Peek legibility (P1 opcional se tempo)

- Muzzle flash 1 raio curto, tracer 2–3u, lean sutil do corpo na direção da mira.  
- Se estourar escopo, deferir e documentar TODO — AC mínimo é A+B+D.

## Não fazer

- Alterar dano, fire rate, preços, mag sizes  
- Vision cone / fog  
- Mudar timers de round  

## Acceptance criteria

- [ ] Círculo de dispersão reflete cone real do 1º tiro e responde a movimento/tiro  
- [ ] Hitflash ≤80ms no alvo  
- [ ] Arco direcional de dano 300ms, 1 por vez  
- [ ] Kill confirm áudio + feed  
- [ ] Crouch removido end-to-end (client motor, server, net, UI help, accuracy)  
- [ ] Pack FX total < ~1ms/frame em laptop médio (sanity: sem alocações por frame em loop quente)  
- [ ] Testes accuracy/motor atualizados e verdes  

## Verificação

```bash
bun test
# server package if separate
cd server && bun test 2>/dev/null || true
```

Playtest: parar → círculo fecha → first shot acerta; tomar dano de flanco → girar na direção do arco.
