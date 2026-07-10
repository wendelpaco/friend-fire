# Friend Fire — Session Meta Flow Design (Wave D)

**Status:** Approved — implementing Meta-1 (multi-agent worktrees)  
**Date:** 2026-07-09  
**Codename:** session-meta  
**Pipeline:** Meta-1 (capa + personagem) → Meta-2 (loja showcase + DS) → Meta-3 (morte social + squad chat)  
**Product frame:** CS-lite session fantasy — cover → identity → loadout moment → live → death social  

---

## 1. Problem & goal

Players today jump from **MainMenu → /play** with only a nickname. Missing:

1. **Cover / first impression** (CS-style splash art)  
2. **Character identity** (masc/fem + skins) before combat  
3. **Cinematic equipment shop moment** (not only B overlay mid-match)  
4. **Death as social mode** — spectate friends + **private squad chat** (not leave the room)

### Goal

A coherent **session flow** that feels like opening Counter-Strike / CS2D: identity and loadout before the gunfight, and **squad presence after death**.

### Non-goals (v1 meta)

- Full CS2 agent roster / paid battle pass  
- Voice chat  
- Global friends list / cross-match party platform  
- Copying Valve art assets (original FF key art only)  
- Rewriting combat engine (already exists)  

---

## 2. Session flow (locked)

```
[1] Splash / Cover          /  (first visit or always until dismissed)
        ↓ Enter / click
[2] Hub                     MainMenu (existing)
        ↓ Play solo / room
[3] Operator select         NEW — character + skin
        ↓ Confirm
[4] Match entry             existing map/room params → /play
        ↓
[5] Loading                 existing GameCanvas boot
        ↓
[6] Shop Showcase           NEW — 5–8s full-screen (design system)
        ↓ Space skip / auto
[7] Buy / Freezetime        existing BuyMenu (B) — same DS components
        ↓
[8] LIVE                    existing
        ↓ death in live
[9] Death Social            spectate + squad chat panel
        ↓ round end
[10] Buy again / match over existing strip / keep guns
```

**Hard rule:** Death does **not** disconnect Colyseus or exit `/play`. Input combat off; spectate + chat on.

---

## 3. Design system — “FF Tactical”

Internal tokens (not Notion UI). Align with current amber/dark HUD.

### 3.1 Tokens (`globals.css` or `presentation/ui/tokens.css`)

| Token | Role |
|-------|------|
| `--ff-void` | `#0a0c10` page bg |
| `--ff-panel` | `#10131a` surfaces |
| `--ff-panel-2` | `#161b24` elevated |
| `--ff-amber` | accent CTA |
| `--ff-tr` / `--ff-ct` | team |
| `--ff-border` | white/10 |
| `--ff-text` / `--ff-muted` | hierarchy |
| Font | `ui-sans` titles; `ui-monospace` money/stats |

### 3.2 Components (`src/presentation/ui/`)

| Component | Used by |
|-----------|---------|
| `Panel` | All meta screens |
| `Button` (primary/ghost/danger) | CTAs |
| `OperatorCard` | Character select |
| `SkinChip` | Skin row |
| `WeaponCard` | Showcase + BuyMenu |
| `PriceTag` | $ |
| `CategoryTabs` | Shop |
| `TimerBar` | Showcase countdown |
| `ChatPanel` | Squad / team |

BuyMenu refactored to consume `WeaponCard` / `CategoryTabs` (no visual fork).

---

## 4. Meta-1 — Splash + Operator + Skins

### 4.1 Splash (`/`)

- Full-bleed key art: `public/covers/ff-cover.webp` (+ fallback gradient)  
- Logo `FRIEND FIRE`, tagline, **Jogar** / Enter  
- Optional: “não mostrar de novo” → `localStorage ff_skip_splash`  
- After dismiss → Hub (`MainMenu`)  

**Art direction:** original tactical dusk, two silhouettes, smoke — *inspired by* CS covers, not Valve IP.

### 4.2 Identity domain extension

```ts
// domains/identity or domains/operator/
type GenderPresentation = "masc" | "fem";

type OperatorDef = {
  id: string;              // "brick" | "vesper"
  name: string;
  gender: GenderPresentation;
  blurb: string;
  defaultSkinId: string;
};

type SkinDef = {
  id: string;
  operatorId: string;
  name: string;
  rarity: "common" | "rare" | "epic";
  /** CSS / Three tint */
  primaryColor: number;
  secondaryColor: number;
  previewGradient: string; // for 2D card
};

type OperatorLoadoutPrefs = {
  operatorId: string;
  skinId: string;
};
```

**v1 catalog (ship 4 operators × 2 skins = 8):**

| Operator | Gender | Vibe |
|----------|--------|------|
| Brick | masc | Heavy CT-ish |
| Rook | masc | TR street |
| Vesper | fem | Precision |
| Nyx | fem | Shadow / eco |

Skins: default + “alt” colorway each (free).

Persistence keys:

- `ff_operator_id`  
- `ff_skin_id`  

API: `getOperatorPrefs()` / `setOperatorPrefs()` in identity storage.

### 4.3 Operator select UI

Route or modal before `/play`:

- Path A: `/play` blocked until prefs set → redirect `/operator`  
- Path B: Hub “Jogar” → `/operator?next=/play?...`  

**Locked:** Path B — `next` query preserves map/mode/code.

Screen:

- Grid of `OperatorCard`  
- Filter chips: Todos | Masc | Fem  
- Right: large preview (2D gradient + silhouette; optional later Three)  
- Skin chips  
- **Confirmar** → navigate `next`  

### 4.4 Apply in match

`ThreeRenderer.createPlayerCharacter` / `createCharacter`:

- Read local player prefs for **local** mesh  
- Remote players: later server field `operatorId`/`skinId` on roster (Meta-1.1)  
- v1 local-only visual OK for solo; multiplayer: send prefs in join options + schema fields (small server patch)

**v1 multiplayer minimum:** include `operatorId` + `skinId` in player schema / NetworkPlayer so others see your look.

### 4.5 Exit criteria Meta-1

- [ ] Splash works; skip preference  
- [ ] Can pick masc/fem operator + skin; prefs persist  
- [ ] Local player mesh tint/rig matches selection  
- [ ] Multiplayer peers receive operator/skin if schema updated  

---

## 5. Meta-2 — Shop Showcase + DS

### 5.1 When it shows

On transition into **buy** phase (and first enter after load if already buy):

1. Full-screen `ShopShowcase` for **SHOWCASE_MS = 6500** (default)  
2. Auto-dismiss → normal freezetime + optional auto-open BuyMenu (existing solo behavior)  
3. **Espaço** / **Esc** / **B** skip early  

Not every mid-round if already dismissed once that buy phase (`showcaseShownForRound`).

### 5.2 Content

- Title: “LOJA · ROUND N”  
- `$ money` big  
- Suggested kits (pure helper):  
  - ECO: armor or pistol if $ &lt; 2000  
  - FORCE: SMG/Galil mid  
  - FULL: AK/AWP if can afford  
- Row of `WeaponCard` from catalog (not auto-buy)  
- TimerBar  
- CTA: **[B] Comprar** · **[Espaço] Continuar**  

### 5.3 BuyMenu restyle

Same DS; keep behavior (`tryBuy`, categories). No logic rewrite.

### 5.4 Exit criteria Meta-2

- [ ] Tokens + 5+ ui components  
- [ ] Showcase on buy enter; skippable  
- [ ] BuyMenu uses WeaponCard  
- [ ] Works solo + room (client-driven overlay; money from server)  

---

## 6. Meta-3 — Death social + Squad chat

### 6.1 Death UX

When `!alive && phase === live`:

- Existing spectate stays  
- Replace thin banner with **DeathSocialPanel**:  
  - “VOCÊ MORREU”  
  - “Espectando: {name}”  
  - Keys: Space free cam, 1 next ally (if easy)  
  - **Squad chat** docked bottom/right  

Warmup death: keep simple respawn overlay (no full social).

### 6.2 Chat channels

```ts
type ChatChannel = "squad" | "team" | "all";

type ChatMessage = {
  id: string;
  channel: ChatChannel;
  fromId: string;
  fromName: string;
  text: string;      // max 120 chars
  at: number;
};
```

| Channel | Who receives |
|---------|----------------|
| `squad` | Same `squadId` (party) |
| `team` | Same team |
| `all` | Whole room |

**v1 UI default on death:** squad. Toggle tabs Team / All.

### 6.3 Squad membership

| Mode | Squad definition |
|------|------------------|
| Solo local | Local player only (chat no-op or self log) |
| Room | `squadId` assigned at join: host creates party id; invitees with `?party=` share id; default = each player own squad until party codes |

**v1 simple rule:**

- On room create: `partyId = roomCode` for host  
- Join with same `party` query as invite → same squad  
- Else each human is solo squad; bots not in player squad  

Server: `Player.partyId: string`  
Message validation: squad only if `sender.partyId === recipient.partyId`.

### 6.4 Transport

- Client: `room.send("chat", { channel, text })`  
- Server: broadcast filtered list or targeted messages  
- Offline: local `addChat` with channel field (team/all only; squad = local)

Extend `ChatEntry` with `channel`.

### 6.5 Exit criteria Meta-3

- [ ] Dead player stays in room, spectates  
- [ ] Squad messages only visible to party  
- [ ] Team/all still work  
- [ ] Input focus: Enter opens chat; game keys don’t fire while typing  

---

## 7. Architecture / files

```
src/
  domains/
    operator/           # NEW catalog + prefs pure
    identity/           # extend storage keys
  presentation/
    ui/                 # FF Tactical components
    session/
      SplashScreen.tsx
      OperatorSelect.tsx
      ShopShowcase.tsx
      DeathSocialPanel.tsx
      SquadChat.tsx
    lobby/MainMenu.tsx  # wire splash gate + operator next
    game/BuyMenu.tsx    # use ui/WeaponCard
  app/
    page.tsx            # splash → hub
    operator/page.tsx   # select
    play/page.tsx       # unchanged entry + query
  infrastructure/
    realtime/           # chat message + partyId schema
server/
  schema MatchState     # operatorId, skinId, partyId
  GameRoom              # chat handler
```

---

## 8. Wave order & PR plan

| Wave | Name | Depends | Parallelizable |
|------|------|---------|----------------|
| **M1** | Splash + operator + skins + apply mesh | — | UI vs domain |
| **M2** | DS tokens + showcase + BuyMenu restyle | M1 optional (money only) | Can start DS early |
| **M3** | Death panel + squad chat server | Room schema | After M1 partyId optional |

**Recommended implementation:** M1 → M2 → M3 sequential merges (schema less painful).  
**Multi-agent:** M1 worktree (operator domain+UI) ‖ M2 worktree (ui/ + showcase) if M2 doesn’t need skins.

---

## 9. Testing

| Layer | What |
|-------|------|
| Unit | operator prefs parse; kit suggestion pure; chat channel filter pure |
| Component | OperatorSelect confirm writes storage |
| Manual | Solo flow splash→op→play→showcase→die→chat; room party squad privacy |

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Scope creep cosmetics store | Free skins only v1 |
| Chat abuse | Rate limit 1 msg / 0.8s; max 120 chars; no links auto |
| Showcase every buy annoys | Once per buy phase; skip key |
| Schema drift client/server | Shared field names in docs + one PR for partyId/skin |

---

## 11. Success criteria (program D done)

1. New player sees cover → picks operator → enters match with matching look  
2. Buy phase has a polished showcase using shared DS  
3. On death, player spectates and chats with **squad only**  
4. No disconnect on death  
5. Specs/tests for pure helpers green  

---

## 12. Approval gate

Approve this design to start **Meta-1** implementation (splash + operator + skins).  

Open decisions (defaults locked unless you object):

| Topic | Default |
|-------|---------|
| Splash every launch vs first-run only | First-run + “não mostrar” |
| Operators count | 4 (2 masc / 2 fem) × 2 skins |
| Showcase duration | 6.5 s, Space skip |
| Squad = party query | Yes |
| Voice | Out |
