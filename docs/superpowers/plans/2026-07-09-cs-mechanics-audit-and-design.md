# Plan: CS Mechanics — Audit (A) → Design (B) → Gunfight P0 (C)

**Date:** 2026-07-09  
**Goal:** Align Friend Fire gameplay with Counter-Strike principles (CS-lite top-down), using multi-agent exploration then a locked design before implementation.

## Pipeline

```
A Audit (parallel subagents, read-only)
    → merge findings
B Design doc CS mechanics v1 (orchestrator + user approval)
    → writing-plans if needed
C Implement P0 gunfight (+ critical rule fixes from A)
```

## Phase A — Audit (multi-agent)

| Agent | Focus | Deliverable |
|-------|--------|-------------|
| **A1 Round/Objective** | phases, timer vs bomb, wipe, plant/defuse, match win | Rule bugs / CS mismatches |
| **A2 Combat/Movement** | weapons, damage, armor, spread, motor, shoot path | Gunfight skill gaps |
| **A3 Economy/Loadout** | money, loss bonus, shop, diedThisRound, keep weapons, drops | Eco decision gaps |

Each agent returns: evidence (file paths), severity (P0/P1/P2), CS principle violated, suggested fix direction (no code).

## Phase B — Design

Write `docs/superpowers/specs/YYYY-MM-DD-cs-mechanics-v1-design.md`:

- Principles locked (what CS DNA we keep)
- Non-goals (no full CS2 recoil)
- P0/P1/P2 backlog from audit
- Gunfight P0 spec (velocity inaccuracy, first bullet)
- Round-rule fixes (bomb vs timer, etc.)

**Gate:** user approves design before C.

## Phase C — Implementation (after B approval)

1. Critical round-rule fixes (P0 from A)  
2. Gunfight P0: movement inaccuracy + first-bullet bias  
3. Tests for pure domain helpers  
4. Commit  

## Success criteria

- [x] Audit memo with file-backed findings → `docs/superpowers/specs/2026-07-09-cs-mechanics-audit.md`  
- [x] Design approved → worktree multi-agent C0+C1 (user: worktrees)  
- [x] P0 code + tests (C0 + C1) merged to main  
- [ ] Manual checklist: “feels more CS” on buy→live→eco (playtest)  

## Phase A status (2026-07-09)

Parallel explore agents completed:

| Agent | Focus | Result |
|-------|--------|--------|
| A1 | Round/bomb | P0 offline timer vs plant; carrier/bot plant P1 |
| A2 | Combat/movement | P0 no move accuracy on server; dual fire models |
| A3 | Economy | Keep eco DNA; drops/HUD/loss table P1 |

## Next human gate

**Approve Design B** (`cs-mechanics-v1-design.md`) then run Phase C (implement C0 → C1).  
