# Friend Fire — Playtest checklist (100%)

Use this after `npm run dev` (+ `npm run dev:server` for multiplayer).

## Session flow (Meta D)

- [ ] `/` shows cover splash; Enter/JOGAR → hub  
- [ ] “Não mostrar de novo” skips splash on reload  
- [ ] Hub → play goes to `/operator?next=...`  
- [ ] Masc/Fem filter; confirm skin; prefs in localStorage  
- [ ] In-match local player uses skin colors  

## Shop (M2)

- [ ] Enter buy phase → full-screen showcase ~6.5s  
- [ ] Space skips; B opens buy menu  
- [ ] BuyMenu shows WeaponCards / categories  

## CS rules

- [ ] **C0:** Plant bomb; round clock hits 0 → round continues until explode/defuse  
- [ ] **C1:** Stopped taps more accurate than full-sprint spray  
- [ ] **C1:** Jump-shooting clearly worse  
- [ ] **C2a:** Buy phase — cannot walk (freezetime)  
- [ ] **C2a:** Loss bonus ladder $1400…$3400 (see money after losses)  
- [ ] **C2b:** Die with gun → ground drop; walk-over empty slot or **E** swap  

## Death social (M3)

- [ ] Die in **live** → stay in room, spectate panel  
- [ ] Squad chat: same `?party=` sees messages; other party does not  
- [ ] Typing in chat does not fire/move  

## Perf (optional)

- [ ] Overlay FPS / export JSON from settings  

## Command smoke

```bash
npx vitest run
npx tsc --noEmit
```

Expect: all tests green, tsc clean.
