# Friend Fire — Sprint 1 PR Plan (execute-plan)

**Status:** Ready to execute  
**Date:** 2026-07-10  
**Base:** Game Design v2 locks + Sprint 1 prompts  
**Assembly:** plain-git branch stack (no Graphite)

## Context

Sprint 1 · Craft & feeling — 5 entregas, sem vision cone / smoke / sound pings.

Locks: `docs/superpowers/specs/2026-07-10-game-design-v2-locks.md`  
Prompts: `docs/superpowers/plans/2026-07-10-sprint1-0{1..5}-*.md`

### Global constraints

- PT-BR UI; server-authoritative money/damage/plant  
- No Sprint 2 features (cone, sound pings, smoke, radio-ping)  
- Do not rebalance weapon prices/damage (except B3 economy defaults / timers)  
- Debug overlays out of production bundle  
- Client/server phase constants must stay in sync  
- Prefer existing patterns; smallest change that meets AC  
- Run `bun test` for touched domains; fix breakages  
- Commit with conventional messages (`feat(hud):`, `feat(combat):`, etc.)

---

## PR Plan

### PR 1: HUD phase cleanup

- **Description:** Minimal live HUD: hide empty weapon slots; contextual control hints (2 rounds then hide, TAB hold); XP/NV off live; chat default TIME + collapsed live; ObjectiveChip for C4 carrier; timer hierarchy over score; debug behind build flag. Full AC in `docs/superpowers/plans/2026-07-10-sprint1-01-hud-phase-cleanup.md`.
- **Files/components affected:** `src/presentation/game/GameHud.tsx`, `src/presentation/ui/WeaponSlot.tsx`, `src/presentation/session/SquadChat.tsx`, `src/domains/session/chat.ts`, `src/presentation/ui/PhaseLabel.tsx`, `src/game/constants.ts`, `src/game/types.ts`, `src/infrastructure/render/hudPublish.ts`, tests under `src/domains/session/`
- **Dependencies:** None

### PR 2: Gunfeel pack and remove crouch

- **Description:** World-space dispersion circle from real first-shot spread; hitflash ≤80ms; directional damage arc 300ms (max 1); kill confirm audio+feed; optional stop-shoot recovery ~100ms; **remove crouch end-to-end** (F4). Full AC in `docs/superpowers/plans/2026-07-10-sprint1-02-gunfeel-pack.md`.
- **Files/components affected:** `src/domains/combat/accuracy.ts`, `src/infrastructure/render/fx/AimReticleSystem.ts`, `src/infrastructure/render/fx/*`, `src/domains/world/motor.ts`, `server/src/sim/motor.ts`, `src/game/engine/Input.ts`, `src/infrastructure/render/GameClient.ts`, `src/presentation/game/GameCanvas.tsx`, `server/src/rooms/GameRoom.ts`, tests under `src/domains/combat/`, `src/domains/world/`
- **Dependencies:** PR 1

### PR 3: Economy one-click plus match format

- **Description:** Kits ECO/FORÇA/COMPLETO F1–F3 + rebuy R; auto-open buy on freezetime; DEFAULT_MATCH buy 10s / live 100s / roundsToWin 5; half after round 4 with side swap + 12s buy; B3 economy floor $1000 + loss ladder; buy-time telemetry. Full AC in `docs/superpowers/plans/2026-07-10-sprint1-03-economy-one-click.md`.
- **Files/components affected:** `src/domains/match/types.ts`, `src/domains/match/phases.ts`, `src/domains/match/economy.ts`, `server/src/sim/phases.ts`, `src/domains/combat/kitSuggest.ts`, `src/presentation/game/BuyMenu.tsx`, `src/presentation/session/ShopShowcase.tsx`, `src/infrastructure/render/GameClient.ts`, `server/src/rooms/GameRoom.ts`, `src/infrastructure/analytics/`, tests under `src/domains/match/`, `src/domains/combat/`
- **Dependencies:** PR 2

### PR 4: Bomb as drama

- **Description:** Central timer transforms on plant; world-space plant/defuse radial on character; bomb beep distance-attenuated accelerating last 15s; finish ObjectiveChip; remove legacy HUD plant bars/duplicate C4 timer. Full AC in `docs/superpowers/plans/2026-07-10-sprint1-04-bomb-drama.md`.
- **Files/components affected:** `src/presentation/game/GameHud.tsx`, `src/presentation/ui/PhaseLabel.tsx`, `src/domains/match/bomb.ts`, `server/src/sim/bomb.ts`, `src/infrastructure/render/fx/BombMarkerSystem.ts`, `src/infrastructure/audio/Sfx.ts`, `src/infrastructure/render/GameClient.ts`, `src/game/types.ts`
- **Dependencies:** PR 3

### PR 5: Lobby and loading premium

- **Description:** Room code as lobby hero (autofocus, clipboard paste, deep link); region chip with live ping; honest presence; loading real progress + named stages; quality toggle if prefs exist. Full AC in `docs/superpowers/plans/2026-07-10-sprint1-05-lobby-loading.md`.
- **Files/components affected:** `src/presentation/lobby/MainMenu.tsx`, `src/presentation/lobby/RoomPanel.tsx`, `src/presentation/lobby/CopyInviteLink.tsx`, `src/presentation/session/MatchLoadingScreen.tsx`, `src/domains/session/invite.ts`, `src/domains/session/codes.ts`, `src/infrastructure/realtime/ping.ts`
- **Dependencies:** PR 4

---

## Linearized stack

PR1 → PR2 → PR3 → PR4 → PR5

(Max parallelism 1 for stack safety; sequential implement + review.)
