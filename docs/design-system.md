# Friend Fire — Design System

**Version:** 2.0  
**Date:** 2026-07-09  
**Status:** Phase 1 deployed (tokens, components, typography scale)

---

## 1. Philosophy

Friend Fire is a **browser-based tactical top-down shooter**. The UI must:

- Read at a glance during combat (high contrast, large tabular numbers)
- Feel like a **game**, not a SaaS dashboard (dramatic hierarchy, amber energy, game-style labels)
- Stay performant (GPU-only animations, no layout thrashing)
- Respect `prefers-reduced-motion`

---

## 2. Color Palette

All colors via CSS custom properties defined in `src/app/design-tokens.css`.

### Foundations

| Token | Value | Usage |
|-------|-------|-------|
| `--ff-void` | `#0a0c10` | Deepest background |
| `--ff-panel` | `#10131a` | Default surface |
| `--ff-panel-2` | `#161b24` | Elevated surface |
| `--ff-panel-3` | `#1c2430` | Hover/active surface |
| `--ff-border` | `rgba(255,255,255,0.10)` | Default border |
| `--ff-text` | `#f5f5f5` | Primary text |
| `--ff-muted` | `rgba(255,255,255,0.45)` | Secondary text |
| `--ff-dim` | `rgba(255,255,255,0.25)` | Tertiary text |

### Brand / Action

| Token | Value | Usage |
|-------|-------|-------|
| `--ff-amber` | `#f59e0b` | Primary CTA, highlights |
| `--ff-amber-glow` | `#fbbf24` | Hover / emphasis |
| `--ff-amber-dark` | `#b45309` | Depth, shadows |

### Teams

| Token | Value | Usage |
|-------|-------|-------|
| `--ff-tr` | `#c45c26` | TR team |
| `--ff-tr-glow` | `#e07a3a` | TR highlight |
| `--ff-ct` | `#3a6ea5` | CT team |
| `--ff-ct-glow` | `#4a9ad4` | CT highlight |

### Status

| Token | Value | Usage |
|-------|-------|-------|
| `--ff-hp-full` | `#10b981` | HP ≥ 75 |
| `--ff-hp-mid` | `#f59e0b` | HP 26–74 |
| `--ff-hp-low` | `#ef4444` | HP ≤ 25 |
| `--ff-money` | `#10b981` | Affordable |
| `--ff-money-dim` | `#047857` | Not affordable |
| `--ff-bomb` | `#f97316` | C4 active |
| `--ff-bomb-urgent` | `#ef4444` | C4 < 10s |
| `--ff-defuse` | `#38bdf8` | Defusing |

### Feedback

| Token | Value | Usage |
|-------|-------|-------|
| `--ff-kill` | `#fbbf24` | Kill confirm |
| `--ff-headshot` | `#ef4444` | Headshot |
| `--ff-killer` | `#fdba74` | Killer name in feed |
| `--ff-victim` | `#93c5fd` | Victim name in feed |

### Backgrounds (cinematic)

| Token | Value | Usage |
|-------|-------|-------|
| `--ff-bg-warm` | `#3b1a08` | Warm radial (TR/amber side) |
| `--ff-bg-cool` | `#0a1628` | Cool radial (CT/sky side) |
| `--ff-bg-mid` | `#12151c` | Transition |
| `--ff-bg-dark` | `#07090e` | Dark screens |
| `--ff-bg-overlay` | `rgba(0,0,0,0.75)` | Modal/overlay backdrop |

---

## 3. Typography

Fonts: **Geist Sans** (UI) + **Geist Mono** (data). Both variable, loaded via `next/font/google`.

### Scale

| Utility class | Size | Weight | Tracking | Usage |
|---------------|------|--------|----------|-------|
| `text-ff-hero` | 56px | 900 | -0.02em | Logo, main title |
| `text-ff-display` | 36px | 800 | -0.01em | Section headers |
| `text-ff-title` | 24px | 700 | normal | Panel titles |
| `text-ff-label` | 10px | 600 | 0.2em uppercase | HUD labels |
| `text-ff-mono-data` | 18px | 700 | tabular-nums | Money, scores |

### Patterns

- **HUD labels:** `text-[9px] font-semibold uppercase tracking-wider`
- **Money:** `font-mono font-black tabular-nums text-emerald-400`
- **Timers:** `font-mono font-black tabular-nums`
- **Body text:** `text-sm leading-relaxed text-white/55`
- **CTA buttons:** `text-sm font-black tracking-[0.2em] uppercase`

---

## 4. Spacing & Layout

### Spacing scale

| Token | Value |
|-------|-------|
| `--ff-space-xs` | 4px |
| `--ff-space-sm` | 8px |
| `--ff-space-md` | 12px |
| `--ff-space-lg` | 16px |
| `--ff-space-xl` | 24px |
| `--ff-space-2xl` | 32px |
| `--ff-space-3xl` | 48px |

### Border radius

| Token | Value | Usage |
|-------|-------|-------|
| `--ff-radius-sm` | 6px | Chips, badges |
| `--ff-radius-md` | 8px | Buttons, inputs |
| `--ff-radius-lg` | 12px | Cards, panels |
| `--ff-radius-xl` | 16px | Modals, large panels |
| `--ff-radius-2xl` | 20px | Main containers |

### In-game HUD zones

```
┌──────────────┬──────────────────────┬──────────────┐
│ MINIMAP + FPS │  TR 8 · 1:45 · CT 3  │   KILLFEED   │
│              │                      │              │
│              │     [CROSSHAIR]      │              │
│              │                      │              │
│   CHAT       │      WEAPONS         │  $ECONOMY    │
│   HP ARMOR   │                      │  AMMO        │
└──────────────┴──────────────────────┴──────────────┘
```

### Menu layout

Desktop: 2-column asymmetric (`grid-cols-[1fr_340px]`).  
Mobile: single column stack.

---

## 5. Components

All components in `src/presentation/ui/`, barrel-exported via `index.ts`.

### Existing (pre-v2)

| Component | File | Usage |
|-----------|------|-------|
| `Panel` | `Panel.tsx` | Dark surface container (default, elevated) |
| `Button` | `Panel.tsx` | Primary (amber), Ghost, Danger |
| `WeaponCard` | `WeaponCard.tsx` | Shop tile with icon + price |
| `PriceTag` | `PriceTag.tsx` | Money display ($N, green/red) |
| `CategoryTabs` | `CategoryTabs.tsx` | Shop category filter pills |
| `TimerBar` | `TimerBar.tsx` | Horizontal progress bar |

### New (v2 / Phase 1)

| Component | File | Usage |
|-----------|------|-------|
| `Badge` | `Badge.tsx` | MVP, rank, team, status tags |
| `Modal` | `Modal.tsx` | Standardised overlay dialog |
| `HealthBar` | `HealthBar.tsx` | HP bar + numeric label |
| `AmmoDisplay` | `AmmoDisplay.tsx` | Mag/reserve counter |
| `WeaponSlot` | `WeaponSlot.tsx` | Single weapon pill in HUD |
| `PhaseLabel` | `PhaseLabel.tsx` | Phase + round label |
| `KillFeedItem` | `KillFeedItem.tsx` | Single kill-feed entry |

### Badge variants

```tsx
<Badge variant="amber">MVP</Badge>
<Badge variant="emerald">+50 XP</Badge>
<Badge variant="red">MORTO</Badge>
<Badge variant="sky">CT</Badge>
<Badge variant="orange">TR</Badge>
<Badge variant="purple">RARO</Badge>
<Badge variant="ghost">Em breve</Badge>
```

### Modal usage

```tsx
<Modal open={show} onClose={() => setShow(false)}>
  <div className="p-6">{/* content */}</div>
</Modal>
```

---

## 6. Animations

All via Tailwind `animate-*` utilities. GPU-only (transform, opacity).

| Class | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `animate-kill-feed-in` | 280ms | ease-out | Kill feed entries |
| `animate-ff-slide-up` | 200ms | ease-out | Banners, toasts |
| `animate-ff-scale-in` | 180ms | ease-out | Modals, panels |
| `animate-ff-fade-in` | 200ms | ease-out | Overlays, transitions |
| `animate-ff-pulse-glow` | 2s infinite | ease-in-out | CTA buttons |
| `animate-ff-shake` | 400ms | ease-out | Error feedback |
| `animate-ff-flash-red` | 500ms | ease-out | Damage taken |
| `animate-ff-blink-warn` | 1s infinite | ease-in-out | Low HP, urgency |

### Accessibility

All animations respect `prefers-reduced-motion: reduce`. Wrap animated elements:

```tsx
<div className="motion-safe:animate-ff-scale-in">{children}</div>
```

---

## 7. Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--ff-shadow-sm` | `0 1px 3px rgba(0,0,0,0.4)` | Subtle elevation |
| `--ff-shadow-md` | `0 4px 12px rgba(0,0,0,0.5)` | Cards, panels |
| `--ff-shadow-lg` | `0 8px 24px rgba(0,0,0,0.6)` | Elevated panels |
| `--ff-shadow-xl` | `0 16px 40px rgba(0,0,0,0.7)` | Modals |
| `--ff-shadow-glow-amber` | `0 0 20px rgba(245,158,11,0.3)` | CTA glow |
| `--ff-shadow-glow-red` | `0 0 20px rgba(239,68,68,0.3)` | Danger glow |

---

## 8. Z-Index

| Token | Value | Layer |
|-------|-------|-------|
| `--ff-z-hud` | 10 | In-game HUD |
| `--ff-z-overlay` | 30 | Death overlay, scoreboard |
| `--ff-z-modal` | 40 | Dialogs, modals |
| `--ff-z-toast` | 50 | Notifications |
| `--ff-z-tooltip` | 60 | Tooltips |

---

## 9. File Structure

```
src/
├── app/
│   ├── globals.css              ← Tailwind + @theme + keyframes
│   ├── design-tokens.css        ← All CSS custom properties
│   └── layout.tsx               ← Font loading, html/body base
├── presentation/
│   └── ui/
│       ├── index.ts             ← Barrel export
│       ├── Panel.tsx            ← Panel + Button
│       ├── Badge.tsx            ← Status/team tags
│       ├── Modal.tsx            ← Standardised dialog
│       ├── WeaponCard.tsx       ← Shop tile
│       ├── WeaponSlot.tsx       ← HUD weapon pill
│       ├── PriceTag.tsx         ← Money display
│       ├── CategoryTabs.tsx     ← Filter tabs
│       ├── TimerBar.tsx         ← Progress bar
│       ├── HealthBar.tsx        ← HP display
│       ├── AmmoDisplay.tsx      ← Ammo counter
│       ├── PhaseLabel.tsx       ← Phase/round label
│       └── KillFeedItem.tsx     ← Kill-feed entry
```

---

## 10. Migration Checklist

- [x] Phase 1: Tokens + typography scale + component extraction
- [ ] Phase 2: SVG weapon icons replacing emoji
- [ ] Phase 3: Motion & feedback animations applied
- [ ] Phase 4: Environment & atmosphere (backgrounds, particles)
- [ ] Phase 5: Themes & variations (map themes, colorblind mode)

---

## 11. Rules

1. **No hardcoded colors** — use CSS tokens or Tailwind's `[color:var(--ff-amber)]` syntax.
2. **No inline modals** — use `<Modal>` component (existing inlines can migrate incrementally).
3. **HUD components** — HealthBar, AmmoDisplay, WeaponSlot, KillFeedItem, PhaseLabel are the source of truth.
4. **New icons** go in `src/presentation/icons/` (Phase 2).
5. **Animations** must have `motion-safe:` prefix when using `animate-*`.
6. **Performance** — never animate `width`, `height`, `top`, `left`. Use `transform` and `opacity` only.
