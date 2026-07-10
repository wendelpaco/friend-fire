# Plan: Session Meta Flow (D)

**Spec:** `docs/superpowers/specs/2026-07-09-session-meta-flow-design.md`  
**Order:** Meta-1 → Meta-2 → Meta-3  

## Meta-1 — Splash + Operator + Skins

1. Domain `operator/` catalog + prefs storage + tests  
2. `public/covers/` placeholder art (gradient OK if no asset yet)  
3. `SplashScreen` on `/` gate  
4. `OperatorSelect` at `/operator?next=...`  
5. Wire MainMenu play CTAs through operator if unset  
6. Apply skin tint on local `createCharacter`  
7. Schema/network: `operatorId`, `skinId` on player (room)  
8. Manual: solo select → play shows tint  

## Meta-2 — Shop Showcase + DS

1. `presentation/ui/` tokens + Panel/Button/WeaponCard/…  
2. `ShopShowcase` on buy enter  
3. Refactor BuyMenu to WeaponCard  
4. Tests for kit suggestion helper  
5. Manual: showcase + B buy  

## Meta-3 — Death social + Squad

1. `partyId` join query + server field  
2. Chat message `{ channel, text }` server filter  
3. Extend ChatEntry + HUD  
4. DeathSocialPanel + SquadChat focus trap  
5. Manual: two clients same party, squad-only messages  

## Multi-agent option

- After design approval: worktree agent M1 ‖ agent M2 (ui-only)  
- M3 after M1 schema lands  

## Done when

Spec §11 success criteria + playtest checklist green.  
