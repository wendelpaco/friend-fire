# Friend Fire v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the existing Next.js + Three.js MVP into domain modules, ship ads instrumentation + end-match break + rewarded stub, and deliver private multiplayer rooms with bot fill via Colyseus — without mid-fight ads.

**Architecture:** Domain modules under `src/domains/*` hold pure game/business logic. React lives in `src/presentation/*`. Three.js is isolated in `src/infrastructure/render`. Colyseus server lives in `server/`. Client predicts; server authorizes HP/rounds in rooms. Spec: `docs/superpowers/specs/2026-07-09-friend-fire-product-design.md`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Three.js, Tailwind 4, Vitest (unit), Colyseus + `@colyseus/sdk` (rooms), localStorage for identity.

## Global Constraints

- Product: free browser tactical top-down shooter; Portuguese-first UI.
- Monetization v1: ads only on lobby banner, map billboards/posters, end-match break; badge **AD** always; **no mid-fight ads**.
- Multiplayer v1: private rooms by code + bot fill; public matchmaking is **out of scope** for this plan (v1.1).
- Match size default: **6** combatants (humans + bots).
- Domains must not import `react`, `three`, `next`, or `colyseus`.
- Keep `/` and `/play` playable after every task that touches runtime code.
- Prefer small pure functions + tests in domains over growing `GameEngine.ts`.
- Commit after each task; do not use `--no-verify` to skip hooks.

---

## File structure (target)

```
src/
  shared/
    ids.ts
    math.ts
    types/team.ts
  domains/
    ads/
      types.ts
      catalog.ts
      impressions.ts
      rewarded.ts
      index.ts
    world/
      types.ts
      maps/dust.ts
      collision.ts
      index.ts
    combat/
      types.ts
      weapons.ts
      damage.ts
      reload.ts
      index.ts
    match/
      types.ts
      phases.ts
      economy.ts
      index.ts
    bots/
      names.ts
      lines.ts
      brain.ts
      index.ts
    identity/
      types.ts
      storage.ts
      missions.ts
      index.ts
    session/
      types.ts
      codes.ts
      roster.ts
      index.ts
  infrastructure/
    render/
      ThreeRenderer.ts
      billboards.ts
      input.ts
    storage/
      local.ts
    analytics/
      queue.ts
    realtime/
      roomClient.ts
  presentation/
    lobby/
      MainMenu.tsx
      RoomPanel.tsx
    game/
      GameCanvas.tsx
      GameHud.tsx
      EndMatchBreak.tsx
    ads/
      AdBanner.tsx
  app/
    page.tsx
    play/page.tsx
    room/page.tsx          # optional: /room?code=
server/
  package.json
  tsconfig.json
  src/
    index.ts
    rooms/GameRoom.ts
    schema/MatchState.ts
```

**Legacy during migration:** `src/game/**` and `src/components/**` may re-export from new paths until call sites are updated; delete shims in Task 6.

---

### Task 1: Add Vitest for domain unit tests

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts + devDependency)
- Create: `src/shared/ids.ts`
- Create: `src/shared/math.ts`
- Test: `src/shared/ids.test.ts`

**Interfaces:**
- Produces: `createId(prefix: string): string`, `clamp(n, min, max): number`, `npm test`

- [ ] **Step 1: Install Vitest**

```bash
cd /home/wendelsantos/works/friend-fire
npm install -D vitest
```

- [ ] **Step 2: Add config and scripts**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

In `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write failing tests for shared helpers**

`src/shared/ids.ts` — leave empty export first if TDD strict; or write test expecting `createId`:

```ts
// src/shared/ids.test.ts
import { describe, expect, it } from "vitest";
import { createId } from "./ids";
import { clamp } from "./math";

describe("createId", () => {
  it("prefixes id", () => {
    expect(createId("ad")).toMatch(/^ad_/);
  });
});

describe("clamp", () => {
  it("clamps to range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});
```

- [ ] **Step 4: Implement helpers**

```ts
// src/shared/ids.ts
let n = 0;
export function createId(prefix: string): string {
  n += 1;
  return `${prefix}_${n}_${Math.random().toString(36).slice(2, 8)}`;
}

// src/shared/math.ts
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/shared
git commit -m "chore: add vitest and shared id/math helpers"
```

---

### Task 2: Extract `domains/ads` (catalog + impressions + rewarded port)

**Files:**
- Create: `src/domains/ads/types.ts`
- Create: `src/domains/ads/catalog.ts` (move from `src/game/ads/catalog.ts`, extend types)
- Create: `src/domains/ads/impressions.ts`
- Create: `src/domains/ads/rewarded.ts`
- Create: `src/domains/ads/index.ts`
- Modify: `src/game/ads/catalog.ts` → re-export from domain
- Test: `src/domains/ads/impressions.test.ts`

**Interfaces:**
- Produces:
  - `AdPlacement`, `AdCreative`, `AdImpression`
  - `AD_CATALOG`, `getAd(id)`, `adsForPlacement(p)`, `pickRotatingAd(p, index)`
  - `recordImpression(input): AdImpression`
  - `RewardedAdPort`, `StubRewardedAdPort`, `grantRewardedXp(currentXp, amount): number`

- [ ] **Step 1: Write impression test**

```ts
// src/domains/ads/impressions.test.ts
import { describe, expect, it } from "vitest";
import { recordImpression } from "./impressions";

describe("recordImpression", () => {
  it("builds impression with required fields", () => {
    const imp = recordImpression({
      placement: "lobby_banner",
      creativeId: "himetrica",
      sessionId: "sess_1",
      now: 1000,
    });
    expect(imp.placement).toBe("lobby_banner");
    expect(imp.creativeId).toBe("himetrica");
    expect(imp.sessionId).toBe("sess_1");
    expect(imp.at).toBe(1000);
    expect(imp.id).toMatch(/^imp_/);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- src/domains/ads/impressions.test.ts
```

Expected: FAIL module not found

- [ ] **Step 3: Implement domain ads**

```ts
// src/domains/ads/types.ts
export type AdPlacement =
  | "lobby_banner"
  | "map_billboard"
  | "map_poster"
  | "end_match_break"
  | "rewarded_xp"
  | "pause_banner";

export interface AdCreative {
  id: string;
  brand: string;
  headline: string;
  subline?: string;
  bg: string;
  bg2?: string;
  accent: string;
  text: string;
  cta?: string;
  url?: string;
  placements: AdPlacement[];
}

export interface AdImpression {
  id: string;
  placement: AdPlacement;
  creativeId: string;
  sessionId: string;
  at: number;
}
```

Move catalog content from `src/game/ads/catalog.ts` into `src/domains/ads/catalog.ts`, renaming field `placement` arrays to `placements` and including `"end_match_break" | "rewarded_xp" | "pause_banner" | "lobby_banner"` on creatives as appropriate. Keep existing brand entries (himetrica, energy-rush, etc.).

```ts
// src/domains/ads/impressions.ts
import { createId } from "@/shared/ids";
import type { AdImpression, AdPlacement } from "./types";

export function recordImpression(input: {
  placement: AdPlacement;
  creativeId: string;
  sessionId: string;
  now?: number;
}): AdImpression {
  return {
    id: createId("imp"),
    placement: input.placement,
    creativeId: input.creativeId,
    sessionId: input.sessionId,
    at: input.now ?? Date.now(),
  };
}
```

```ts
// src/domains/ads/rewarded.ts
export type RewardedResult = "completed" | "skipped" | "error";

export interface RewardedAdPort {
  show(placement: "rewarded_xp"): Promise<RewardedResult>;
}

export class StubRewardedAdPort implements RewardedAdPort {
  async show(): Promise<RewardedResult> {
    return "completed";
  }
}

export function grantRewardedXp(currentXp: number, amount: number): number {
  return Math.max(0, currentXp) + Math.max(0, amount);
}
```

```ts
// src/domains/ads/index.ts
export * from "./types";
export * from "./catalog";
export * from "./impressions";
export * from "./rewarded";
```

- [ ] **Step 4: Shim old path**

```ts
// src/game/ads/catalog.ts
export {
  AD_CATALOG,
  getAd,
  adsForPlacement,
  pickRotatingAd,
} from "@/domains/ads";
export type { AdCreative, AdPlacement } from "@/domains/ads";
```

Update `pickRotatingAd` / `adsForPlacement` to use `creative.placements` (plural). Update `AdBanner.tsx` and `billboards.ts` if they referenced `placement` singular on creatives.

- [ ] **Step 5: Run tests + build**

```bash
npm test
npm run build
```

Expected: PASS / compile OK

- [ ] **Step 6: Commit**

```bash
git add src/domains/ads src/game/ads src/components/ads src/game/world/billboards.ts
git commit -m "feat(ads): extract ads domain with impressions and rewarded port"
```

---

### Task 3: Extract `domains/world` + `domains/combat` pure logic

**Files:**
- Create: `src/domains/world/types.ts`, `maps/dust.ts`, `collision.ts`, `index.ts`
- Create: `src/domains/combat/types.ts`, `weapons.ts`, `damage.ts`, `reload.ts`, `index.ts`
- Create: `src/shared/types/team.ts` (`export type Team = "TR" | "CT"`)
- Modify: `src/game/world/maps.ts`, `src/game/constants.ts`, `src/game/types.ts` → re-export or thin wrappers
- Test: `src/domains/combat/damage.test.ts`, `src/domains/world/collision.test.ts`

**Interfaces:**
- Produces:
  - `resolveCircleWalls(x, z, radius, walls): { x, z }`
  - `applyDamage({ hp, armor }, damage): { hp, armor, absorbed }`
  - `isDead(hp): boolean`
  - `startReload(ammo, weapon, now): number | null` (returns `reloadingUntil` or null)
  - `finishReload(ammo, weapon): ammo`
  - `WEAPONS` record with `reloadTime`

- [ ] **Step 1: Write damage + collision tests**

```ts
// src/domains/combat/damage.test.ts
import { describe, expect, it } from "vitest";
import { applyDamage, isDead } from "./damage";

describe("applyDamage", () => {
  it("reduces armor then hp", () => {
    const r = applyDamage({ hp: 100, armor: 50 }, 40);
    expect(r.hp).toBeLessThan(100);
    expect(r.armor).toBeLessThan(50);
  });
  it("kills at 0 hp", () => {
    const r = applyDamage({ hp: 10, armor: 0 }, 50);
    expect(isDead(r.hp)).toBe(true);
  });
});
```

```ts
// src/domains/world/collision.test.ts
import { describe, expect, it } from "vitest";
import { resolveCircleWalls } from "./collision";

describe("resolveCircleWalls", () => {
  it("pushes circle out of AABB", () => {
    const walls = [{ x: 0, z: 0, w: 2, d: 2 }];
    const p = resolveCircleWalls(0, 0, 0.5, walls);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(0.4);
  });
});
```

- [ ] **Step 2: Implement combat damage (match current GameEngine formula)**

Current engine logic: armor absorbs `min(armor, dmg * 0.5)`, then `dmg -= absorbed * 0.5`, then `hp -= dmg`.

```ts
// src/domains/combat/damage.ts
export function applyDamage(
  target: { hp: number; armor: number },
  damage: number,
): { hp: number; armor: number; dealt: number } {
  let dmg = damage;
  let armor = target.armor;
  let hp = target.hp;
  if (armor > 0) {
    const absorbed = Math.min(armor, dmg * 0.5);
    armor -= absorbed;
    dmg -= absorbed * 0.5;
  }
  hp -= dmg;
  return { hp, armor, dealt: damage };
}

export function isDead(hp: number): boolean {
  return hp <= 0;
}
```

Move `WEAPONS` from `src/game/constants.ts` into `src/domains/combat/weapons.ts` (include `reloadTime`).

```ts
// src/domains/combat/reload.ts
import type { WeaponDef, WeaponId } from "./types";
import { WEAPONS } from "./weapons";

export type Ammo = { mag: number; reserve: number };

export function canReload(ammo: Ammo, def: WeaponDef): boolean {
  if (def.isMelee) return false;
  return ammo.reserve > 0 && ammo.mag < def.magazine;
}

export function beginReload(
  ammo: Ammo,
  weaponId: WeaponId,
  now: number,
): number | null {
  const def = WEAPONS[weaponId];
  if (!canReload(ammo, def)) return null;
  return now + def.reloadTime;
}

export function completeReload(ammo: Ammo, weaponId: WeaponId): Ammo {
  const def = WEAPONS[weaponId];
  const need = def.magazine - ammo.mag;
  const take = Math.min(need, ammo.reserve);
  return { mag: ammo.mag + take, reserve: ammo.reserve - take };
}
```

- [ ] **Step 3: Move map + collision into `domains/world`**

Copy `MAP_DUST`, wall/prop types, `resolveCircleWalls`, `mapCollisionWalls` from `src/game/world/maps.ts` into domain files. Re-export from old path.

- [ ] **Step 4: Wire GameEngine to use domain functions**

In `src/game/engine/GameEngine.ts` `applyDamage` method, call `applyDamage` from domain (rename import to `applyDamageToVitals` if name clash). Replace inline reload completion with `completeReload`.

- [ ] **Step 5: Test + build**

```bash
npm test
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/domains/world src/domains/combat src/shared/types src/game
git commit -m "feat: extract world and combat domains with unit tests"
```

---

### Task 4: Extract `domains/match` phase machine

**Files:**
- Create: `src/domains/match/types.ts`, `phases.ts`, `economy.ts`, `index.ts`
- Test: `src/domains/match/phases.test.ts`
- Modify: `GameEngine` timer/round transitions to call domain helpers

**Interfaces:**
- Produces:
  - `RoundPhase = "warmup" | "live" | "ended" | "match_over"`
  - `DEFAULT_MATCH = { warmup: 20, round: 90, roundsToWin: 8, endMatchPause: 8 }`
  - `tickPhase(state, dt): MatchPhaseState`
  - `onRoundWin(state, winner): MatchPhaseState`
  - `applyRoundMoney(players, winner, { win: 3250, loss: 1400 })`

- [ ] **Step 1: Write phase tests**

```ts
// src/domains/match/phases.test.ts
import { describe, expect, it } from "vitest";
import { createMatchPhase, tickPhase, onRoundWin } from "./phases";

describe("match phases", () => {
  it("starts in warmup", () => {
    const m = createMatchPhase();
    expect(m.phase).toBe("warmup");
  });

  it("warmup expiry starts live round 1", () => {
    let m = createMatchPhase({ warmupTime: 1 });
    m = tickPhase(m, 1.1);
    expect(m.phase).toBe("live");
    expect(m.round).toBe(1);
  });

  it("round win increments score and enters ended", () => {
    let m = createMatchPhase();
    m = { ...m, phase: "live", round: 1 };
    m = onRoundWin(m, "TR");
    expect(m.scoreTR).toBe(1);
    expect(m.phase).toBe("ended");
  });

  it("match_over when team reaches roundsToWin", () => {
    let m = createMatchPhase({ roundsToWin: 2 });
    m = { ...m, phase: "live", scoreTR: 1, round: 2 };
    m = onRoundWin(m, "TR");
    expect(m.phase).toBe("match_over");
  });
});
```

- [ ] **Step 2: Implement `phases.ts` + `economy.ts`**

```ts
// src/domains/match/phases.ts
export type RoundPhase = "warmup" | "live" | "ended" | "match_over";
export type Team = "TR" | "CT";

export interface MatchPhaseState {
  phase: RoundPhase;
  round: number;
  timeLeft: number;
  scoreTR: number;
  scoreCT: number;
  warmupTime: number;
  roundTime: number;
  endPause: number;
  roundsToWin: number;
}

export function createMatchPhase(
  opts?: Partial<Pick<MatchPhaseState, "warmupTime" | "roundTime" | "endPause" | "roundsToWin">>,
): MatchPhaseState {
  const warmupTime = opts?.warmupTime ?? 20;
  return {
    phase: "warmup",
    round: 0,
    timeLeft: warmupTime,
    scoreTR: 0,
    scoreCT: 0,
    warmupTime,
    roundTime: opts?.roundTime ?? 90,
    endPause: opts?.endPause ?? 5,
    roundsToWin: opts?.roundsToWin ?? 8,
  };
}

export function tickPhase(m: MatchPhaseState, dt: number): MatchPhaseState {
  if (m.phase === "match_over") return m;
  const timeLeft = m.timeLeft - dt;
  if (timeLeft > 0) return { ...m, timeLeft };

  if (m.phase === "warmup") {
    return {
      ...m,
      phase: "live",
      round: m.round + 1,
      timeLeft: m.roundTime,
    };
  }
  if (m.phase === "live") {
    // timer expired → CT wins (defuse default)
    return onRoundWin({ ...m, timeLeft: 0 }, "CT");
  }
  if (m.phase === "ended") {
    return {
      ...m,
      phase: "live",
      round: m.round + 1,
      timeLeft: m.roundTime,
    };
  }
  return m;
}

export function onRoundWin(m: MatchPhaseState, winner: Team): MatchPhaseState {
  const scoreTR = m.scoreTR + (winner === "TR" ? 1 : 0);
  const scoreCT = m.scoreCT + (winner === "CT" ? 1 : 0);
  if (scoreTR >= m.roundsToWin || scoreCT >= m.roundsToWin) {
    return {
      ...m,
      scoreTR,
      scoreCT,
      phase: "match_over",
      timeLeft: m.endPause,
    };
  }
  return {
    ...m,
    scoreTR,
    scoreCT,
    phase: "ended",
    timeLeft: m.endPause,
  };
}
```

```ts
// src/domains/match/economy.ts
export const KILL_REWARD = 300;
export const ROUND_WIN_REWARD = 3250;
export const ROUND_LOSS_REWARD = 1400;

export function moneyAfterRound(
  team: "TR" | "CT",
  winner: "TR" | "CT",
  current: number,
): number {
  return current + (team === winner ? ROUND_WIN_REWARD : ROUND_LOSS_REWARD);
}
```

- [ ] **Step 3: Integrate into GameEngine**

Replace local phase string updates with `MatchPhaseState` fields (can keep players in engine state; sync phase/scores/timeLeft from domain). When `phase === "match_over"`, set a flag for UI end-match break (Task 5).

- [ ] **Step 4: Test + build + commit**

```bash
npm test
npm run build
git add src/domains/match src/game/engine/GameEngine.ts
git commit -m "feat(match): pure phase machine and round economy"
```

---

### Task 5: End-match ad break + impression analytics wiring

**Files:**
- Create: `src/infrastructure/analytics/queue.ts`
- Create: `src/infrastructure/storage/local.ts`
- Create: `src/presentation/game/EndMatchBreak.tsx`
- Create: `src/domains/identity/types.ts`, `storage.ts`, `missions.ts`, `index.ts`
- Modify: `src/components/game/GameHud.tsx` or move to `presentation/game/GameHud.tsx`
- Modify: `GameCanvas` / engine HUD snapshot: add `matchOver: boolean`, `sessionId: string`
- Modify: `MainMenu` AdBanner to call `recordImpression` on mount/rotate
- Test: `src/infrastructure/analytics/queue.test.ts`

**Interfaces:**
- Produces:
  - `AnalyticsQueue.push(imp)`, `AnalyticsQueue.drain(): AdImpression[]`
  - `getOrCreateSessionId(): string`
  - `EndMatchBreak` UI: shows rotating `end_match_break` creative, countdown 8s, button “Continuar”, optional “+50 XP assistindo” → `StubRewardedAdPort`
  - `identity.grantXp`, daily mission stubs localStorage keys `ff_xp`, `ff_nickname`, `ff_region`, `ff_session_id`

- [ ] **Step 1: Analytics queue test + impl**

```ts
// src/infrastructure/analytics/queue.ts
import type { AdImpression } from "@/domains/ads";

const KEY = "ff_ad_impressions";

export function pushImpression(imp: AdImpression): void {
  if (typeof window === "undefined") return;
  const list = drainImpressions();
  list.push(imp);
  localStorage.setItem(KEY, JSON.stringify(list.slice(-200)));
}

export function drainImpressions(): AdImpression[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as AdImpression[];
  } catch {
    return [];
  }
}
```

```ts
// test: push then drain length >= 1 (use vitest with happy-dom or mock localStorage)
```

Add to `vitest.config.ts`:

```ts
environment: "node",
```

Mock:

```ts
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
});
```

- [ ] **Step 2: Session id + identity**

```ts
// src/domains/identity/storage.ts
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server";
  const k = "ff_session_id";
  let id = localStorage.getItem(k);
  if (!id) {
    id = `sess_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(k, id);
  }
  return id;
}

export function getXp(): number {
  return Number(localStorage.getItem("ff_xp") || "0") || 0;
}

export function setXp(xp: number): void {
  localStorage.setItem("ff_xp", String(xp));
}
```

- [ ] **Step 3: EndMatchBreak component**

```tsx
// src/presentation/game/EndMatchBreak.tsx
"use client";
// Props: scoreTR, scoreCT, onContinue, onRewardedComplete
// On mount: pickRotatingAd("end_match_break", 0) → recordImpression + pushImpression
// UI: dark overlay, AD creative card, "Partida encerrada", scores, countdown
// Secondary button: "Ganhar +50 XP" → StubRewardedAdPort.show → grantRewardedXp → setXp
```

Show this overlay when `hud.phase === "match_over"` (or `hud.matchOver`).

- [ ] **Step 4: Wire AdBanner**

On creative index change, call `recordImpression` + `pushImpression` with `placement: "lobby_banner"`.

- [ ] **Step 5: Map impressions once per match start**

In engine when transitioning into first `live` round of a match (or on match start), for each billboard/poster creative id call `recordImpression` with `map_billboard` / `map_poster`.

- [ ] **Step 6: Manual check + automated**

```bash
npm test
npm run build
npm run dev
```

Manual: play until one team wins 8 rounds (temporarily set `roundsToWin: 1` in dev constant for QA, then revert) → end break appears → localStorage `ff_ad_impressions` has entries.

- [ ] **Step 7: Commit**

```bash
git add src/domains/identity src/infrastructure src/presentation src/components src/game
git commit -m "feat(ads): end-match break, impressions queue, identity xp stub"
```

---

### Task 6: Move presentation layer + thin app routes

**Files:**
- Move (git mv):  
  - `src/components/menu/MainMenu.tsx` → `src/presentation/lobby/MainMenu.tsx`  
  - `src/components/game/*` → `src/presentation/game/*`  
  - `src/components/ads/AdBanner.tsx` → `src/presentation/ads/AdBanner.tsx`
- Update imports in `src/app/page.tsx`, `src/app/play/page.tsx`
- Delete empty `src/components` if unused
- Keep `src/game/engine` until Task 7

- [ ] **Step 1: Move files and fix imports**

```bash
mkdir -p src/presentation/{lobby,game,ads}
git mv src/components/menu/MainMenu.tsx src/presentation/lobby/MainMenu.tsx
git mv src/components/game/GameCanvas.tsx src/presentation/game/GameCanvas.tsx
git mv src/components/game/GameHud.tsx src/presentation/game/GameHud.tsx
git mv src/components/ads/AdBanner.tsx src/presentation/ads/AdBanner.tsx
```

Update all `@/components/...` imports to `@/presentation/...`.

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git commit -am "refactor: move UI into presentation layer"
```

---

### Task 7: Split render adapter from GameEngine

**Files:**
- Create: `src/infrastructure/render/input.ts` (move from `src/game/engine/Input.ts`)
- Create: `src/infrastructure/render/ThreeRenderer.ts` — owns scene, camera, renderer, meshes, `sync(state)`, `pickGround(mx,my)`
- Create: `src/domains/match/simulation.ts` OR keep orchestration class `src/infrastructure/render/GameClient.ts` that: reads input → steps domain → calls renderer
- Modify: `GameCanvas` to construct `GameClient` instead of `GameEngine`
- Deprecate/remove monolithic methods gradually; end state: `GameEngine.ts` deleted or reduced to re-export

**Interfaces:**
- Produces:
  - `class ThreeRenderer { constructor(canvas); sync(snapshot); resize(w,h); dispose() }`
  - `class GameClient { start(); stop(); setHudListener(); setPaused(); ... }` with same external API as current engine for HUD

- [ ] **Step 1: Move Input unchanged to infrastructure/render/input.ts; re-export shim**

- [ ] **Step 2: Extract mesh build + render sync into ThreeRenderer** (copy from GameEngine `buildWorld`, `syncMeshes`, `render`, `updateCamera`)

- [ ] **Step 3: GameClient owns MatchPhaseState + players array; calls domain combat/match; passes render snapshot**

- [ ] **Step 4: Ensure pause/help/scoreboard still work**

- [ ] **Step 5: build + manual play smoke**

```bash
npm run build
npm run dev
```

- [ ] **Step 6: Commit**

```bash
git commit -am "refactor: split ThreeRenderer from game simulation client"
```

---

### Task 8: `domains/session` (room codes + roster + bot fill)

**Files:**
- Create: `src/domains/session/types.ts`, `codes.ts`, `roster.ts`, `index.ts`
- Test: `src/domains/session/codes.test.ts`, `roster.test.ts`

**Interfaces:**
- Produces:
  - `MATCH_SIZE = 6`
  - `generateRoomCode(): string` — 6 chars `A-Z0-9` without ambiguous `O/0/I/1`
  - `normalizeRoomCode(raw): string`
  - `isValidRoomCode(code): boolean`
  - `fillBots(humans: RosterPlayer[], matchSize): RosterPlayer[]`
  - `assignTeams(players): RosterPlayer[]` — balance TR/CT

```ts
// src/domains/session/codes.ts
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(rng: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(rng() * ALPHABET.length)]!;
  }
  return s;
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidRoomCode(code: string): boolean {
  const c = normalizeRoomCode(code);
  return c.length === 6 && [...c].every((ch) => ALPHABET.includes(ch));
}
```

```ts
// roster fill: while length < MATCH_SIZE, push bot with team alternating
```

- [ ] **Step 1–4: TDD codes + fillBots, implement, test, commit**

```bash
git commit -m "feat(session): room codes and bot-fill roster helpers"
```

---

### Task 9: Lobby room UI (create / join) — client mock first

**Files:**
- Create: `src/presentation/lobby/RoomPanel.tsx`
- Modify: `src/presentation/lobby/MainMenu.tsx` — enable “Entrar por código” + “Criar sala”
- Create: `src/app/play/page.tsx` query support: `?mode=local|room&code=XXXXXX`
- Create: `src/infrastructure/realtime/roomClient.ts` with `LocalRoomClient` mock implementing:

```ts
export interface RoomClient {
  create(): Promise<{ code: string }>;
  join(code: string): Promise<void>;
  leave(): Promise<void>;
  onState(cb: (state: unknown) => void): () => void;
  sendInput(input: unknown): void;
}
```

`LocalRoomClient`: generates code via domain, stores in memory, navigates to `/play?mode=room&code=`.

- [ ] **Step 1: RoomPanel UI**

- Create sala → `LocalRoomClient.create()` → router push play with code  
- Join → validate code → push play  

- [ ] **Step 2: MainMenu wires RoomPanel; remove disabled on those two buttons**

- [ ] **Step 3: Manual: create room shows code on HUD; join invalid code shows error**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(session): lobby create/join room UI with local mock client"
```

---

### Task 10: Colyseus server — private GameRoom

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/src/index.ts`, `server/src/rooms/GameRoom.ts`, `server/src/schema/MatchState.ts`
- Modify: root `package.json` workspaces or scripts:
  - `"dev:server": "npm run dev --prefix server"`
  - `"dev:all": "concurrently ..."` (optional)

**Interfaces:**
- Produces: Colyseus room name `"game"`, options `{ code?: string }`
- State schema fields: `phase`, `round`, `scoreTR`, `scoreCT`, `timeLeft`, players map `{ id, name, team, x, z, rot, hp, armor, alive }`
- Messages: `input` `{ dx, dz, aimX, aimZ, fire, reload, slot }`, `ping`
- On create: generate code; `metadata.code = code`
- `onJoin`: assign team, bot-fill on `onCreate` and when humans < MATCH_SIZE (bots simulated on server tick)
- Filter: join by matching `code` via `filterBy(["code"])` or custom `onAuth`

Minimal `server/package.json`:

```json
{
  "name": "friend-fire-server",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "colyseus": "^0.15.28",
    "@colyseus/ws-transport": "^0.15.3",
    "express": "^4.21.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17"
  }
}
```

`server/src/index.ts`: listen `2567`, define room `game`.

- [ ] **Step 1: Scaffold server, install deps**

```bash
mkdir -p server/src/rooms server/src/schema
# write package.json files, npm install in server/
```

- [ ] **Step 2: Implement MatchState schema + GameRoom tick (reuse domain match/combat by relative import or duplicate thin ports)**

For v1 without monorepo package, **duplicate** only `tickPhase` / `applyDamage` imports via path:

```ts
// server/tsconfig paths to ../src/domains — OR copy minimal logic into server/src/sim/
```

Prefer TypeScript project reference:

```json
"paths": { "@ff/*": ["../src/*"] }
```

Server may import `@ff/domains/match` if tsx resolves it; if not, create `server/src/sim` copies of pure functions (keep in sync comment).

- [ ] **Step 3: Run server**

```bash
cd server && npm run dev
```

Expected: `Listening on ws://localhost:2567`

- [ ] **Step 4: Commit server scaffold**

```bash
git add server
git commit -m "feat(server): Colyseus GameRoom scaffold for private matches"
```

---

### Task 11: Wire Colyseus client + replace LocalRoomClient in room mode

**Files:**
- Modify: `src/infrastructure/realtime/roomClient.ts` — add `ColyseusRoomClient`
- Add dependency: `npm install @colyseus/sdk`
- Modify: `GameClient` / play page to use network state when `mode=room`
- Env: `NEXT_PUBLIC_COLYSEUS_URL=ws://localhost:2567`

**Interfaces:**
- `ColyseusRoomClient.create()` → `client.create("game")` return room id/code from state
- `join(code)` → `client.join("game", { code })`
- Reconcile: apply server players to renderer; local input sent at 20Hz

- [ ] **Step 1: Install SDK, implement client**

- [ ] **Step 2: Two browser profiles — create + join same code — both see two humans + bots**

- [ ] **Step 3: Document in README**

```md
## Multiplayer dev
terminal A: npm run dev
terminal B: cd server && npm run dev
Create room in lobby → share code → second browser joins
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(realtime): connect play mode to Colyseus private rooms"
```

---

### Task 12: README + sponsor kit + final QA gate

**Files:**
- Modify: `README.md` — architecture diagram (text), ads placements, how to swap creatives, dev scripts, link to spec/plan
- Create: `docs/sponsors.md` — one-pager: placements, sample pricing table placeholders, contact `anuncie@friendfire.gg`
- Ensure `roundsToWin` default 8 for prod; document `NEXT_PUBLIC_DEBUG_ROUNDS_TO_WIN`

- [ ] **Step 1: Write docs**

- [ ] **Step 2: Full QA checklist**

| Check | Pass? |
|-------|-------|
| `/` lobby loads, ads rotate, impressions in localStorage | |
| `/play` local bots, reload, pause, scoreboard | |
| Match over → end break → continue | |
| Rewarded stub grants XP | |
| Create/join room two clients | |
| No ad UI during live firefight | |
| `npm test` green | |
| `npm run build` green | |

- [ ] **Step 3: Commit**

```bash
git add README.md docs/sponsors.md
git commit -m "docs: v1 runbook, sponsor kit, and architecture pointers"
```

---

## Out of scope (do not implement in this plan)

- Public matchmaking  
- Real ad network SDK  
- Paid cosmetics store  
- Bomb plant/defuse full mode  
- Redis multi-node scale  
- Mobile touch controls  

---

## Spec coverage self-check

| Spec item | Task(s) |
|-----------|---------|
| Domain modules layout | 2–4, 6–8 |
| Ads lobby + map + end break | 2, 5 |
| Impression metrics | 5 |
| Rewarded stub | 2, 5 |
| Identity nick/XP local | 5 |
| Private rooms + bot fill | 8–11 |
| Colyseus server authority path | 10–11 |
| No mid-fight ads | 5, 12 QA |
| Migrate without big-bang | 2–7 shims |
| Unit tests domains | 1–4, 8 |
| Match phase / economy | 4 |
| One map Dust FF | retained via world domain |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-09-friend-fire-v1-implementation.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — same session, batch with checkpoints  

**Which approach?**
