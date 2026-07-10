# Crouch Toggle Unification — Implementation Plan

> **For agentic workers:** Implement task-by-task. TDD where noted. Multi-agent OK if files don't conflict.

**Goal:** Unify CTRL crouch as **toggle** on client prediction, network, and server so multiplayer matches solo.

**Spec:** `docs/superpowers/specs/2026-07-09-crouch-toggle-unification-design.md`

## Global constraints

- Do not add C4 to shop.
- Do not change `CharacterHandle.update` / facing math.
- Motor `input.crouch` = desired state this frame; callers own toggle.
- Keep buy phase 18s / B-menu behavior intact.
- Tests: `bun run test`; typecheck: `bunx tsc --noEmit`.
- Mirror client motor comments into `server/src/sim/motor.ts` if you touch docs there.

---

### Task 1: Input helper + comments

**Files:**
- `src/infrastructure/render/input.ts`
- Optionally `src/game/constants.ts` CONTROLS help if crouch wording is wrong

**Steps:**
1. Add `wasCrouchPressed(): boolean` — true if `ControlLeft` or `ControlRight` in `justPressed`.
2. Keep `isCrouchDown()` for net hold bit (server edge-detect).
3. Update comments: crouch is toggle; hold bit is for multiplayer edge only.
4. No commit message fluff — `feat(input): wasCrouchPressed for crouch toggle`

---

### Task 2: GameClient uses `wasCrouchPressed`

**Files:**
- `src/infrastructure/render/GameClient.ts`

**Steps:**
1. In `applyPlayerMotor`, replace dual `wasPressed("ControlLeft/Right")` with `this.input.wasCrouchPressed()`.
2. Confirm still: toggle `p.crouching`, then motor/Rapier with **state** not key hold.
3. Commit: `refactor(character): use wasCrouchPressed for toggle crouch`

---

### Task 3: Server crouch toggle (edge)

**Files:**
- `server/src/rooms/GameRoom.ts`
- `server/src/schema/MatchState.ts` (comments only)
- `server/src/sim/motor.ts` (comment: crouch = desired state)

**Steps:**
1. Add `crouchHeld: boolean` to `RuntimeExtra` (next to `jumpHeld`).
2. On player tick:
   ```ts
   const crouchEdge = Boolean(input.crouch) && !ex.crouchHeld;
   ex.crouchHeld = Boolean(input.crouch);
   if (crouchEdge) p.crouching = !p.crouching;
   // tickMotor crouch: p.crouching  (NOT input.crouch)
   ```
3. Initialize `crouchHeld: false` wherever `jumpHeld` is reset/spawned.
4. Update comments that said “hold crouch”.
5. Commit: `feat(server): crouch toggle via Control edge (match solo)`

**Note:** `GameCanvas` keeps sending `crouch: isCrouchDown()` — no client net change required for wire format.

---

### Task 4: Domain motor comment + optional pure helper test

**Files:**
- `src/domains/world/motor.ts` — comment on `MotorInput.crouch`
- `src/domains/world/motor.test.ts` — add test that sustained `crouch: true` keeps crouching (state-in); document toggle is caller's job
- Optional pure helper if useful:
  ```ts
  export function applyCrouchToggle(crouching: boolean, edge: boolean): boolean {
    return edge ? !crouching : crouching;
  }
  ```
  Prefer **not** adding helper unless tests need it — server/client can inline.

**Tests to add:**
```ts
it("motor crouch input is state (not edge): true stays crouched", () => {
  let s = createMotorState(0, 0);
  s = tickMotor(s, { wishX: 0, wishZ: 0, jump: false, crouch: true, dt: 1/60, walls: [] });
  expect(s.crouching).toBe(true);
  s = tickMotor(s, { wishX: 0, wishZ: 0, jump: false, crouch: true, dt: 1/60, walls: [] });
  expect(s.crouching).toBe(true);
  s = tickMotor(s, { wishX: 0, wishZ: 0, jump: false, crouch: false, dt: 1/60, walls: [] });
  expect(s.crouching).toBe(false);
});
```

Commit: `docs(motor): crouch input is desired state; add state test`

---

### Task 5: Verify buy phase + full suite

**No product change** — regression only.

```bash
bun run test
bunx tsc --noEmit
```

Confirm `shop.test.ts` / `phases.test.ts` still pass. If any type error on server, fix.

---

## Success checklist

- [ ] Solo: Control toggles crouch
- [ ] Multiplayer: Control toggles crouch (server edge)
- [ ] Holding Control does not spam toggle
- [ ] Jump + crouch orientation still velocity-based
- [ ] Shop unchanged (no C4); money/buy tests green
- [ ] All tests + tsc green
