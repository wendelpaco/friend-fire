# Friend Fire — Game Design v2 · Decisões travadas

**Status:** LOCKED  
**Date:** 2026-07-10  
**Base:** Game Design v2 & Design System UI/UX + confirmação do produto

---

## F1–F8 (locks)

| ID | Decisão | Lock |
|----|---------|------|
| **F1** | Vision cone | Sprint 2 default ON + “modo clássico” por sala; interest management **server-side** (nunca hide-only no cliente) |
| **F2** | Formato | Primeiro a **5** (máx. 9 rounds) |
| **F3** | Half | Troca de lado após round **4**; economia reseta; freezetime **12s** no 1º e pós-troca |
| **F4** | Crouch | **Remover** no Sprint 1 (gunfeel / motor) |
| **F5** | Timers | Tabela B2 integral (warmup 30s ou cheio · buy 10s · live 1:40 · C4 40s · defuse 5s/3,5s kit · end 5s) |
| **F6** | Economia | Kits F1–F3 + rebuy R + defaults B3 (piso $1000, win 3250, loss ladder 1400→2900, kill 300) |
| **F7** | Rádio → ping | Sprint 2, após sound pings; mortos nunca pingam para vivos |
| **F8** | Smoke | Só se cone passou AC; flash só depois do smoke |

---

## Sprint 1 · ordem de entrega

1. HUD por fase + limpeza  
2. Gunfeel pack (+ remoção crouch F4)  
3. Economia 1-clique + timers B2/F2/F3 + defaults B3  
4. Bomba = drama  
5. Lobby + loading premium  

Prompts operacionais: `docs/superpowers/plans/2026-07-10-sprint1-0{1..5}-*.md`

## Sprint 2 · big bet (após Sprint 1)

1. Vision cone MVP (F1)  
2. Sound pings  
3. Smoke (F8)  
4. Rádio-ping (F7)  

---

## Princípios de craft (lembrete)

- Zona central 60% livre no live  
- Banner = evento ≤3s; estado = chip  
- Vermelho só bomba/dano/crítico  
- Cliente hostil; servidor autoritativo em $ / dano / plant  
- Debug flags fora do bundle de produção  
