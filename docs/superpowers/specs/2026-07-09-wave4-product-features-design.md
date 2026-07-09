# Friend Fire — Wave 4 Product Features Design

**Status:** Approved for implementation (same process: spec → parallel agents)  
**Date:** 2026-07-09  
**Branch:** `feature/friend-fire-v1`  
**Prior specs:** wave3, product design, combat feedback  

---

## 1. Priority (controller)

| Prio | Feature | Why |
|------|---------|-----|
| P0 | **Fog toggle** in pause menu | Complete wave3 fog with user control |
| P0 | **Region filter** on room list + create | BR/US already in identity; wire to rooms |
| P0 | **Map thumbnails / color chips** in browser & create | Faster map recognition |
| P1 | **Settings panel** (pause): volume, fog, camera default | Centralize prefs |
| P1 | **Kill feed polish** + deathcam hint | Combat readability |
| P1 | **Reconnect banner** + rejoin by last code | Multiplayer resilience |
| P2 | **Room full / locked UX** | Clear errors |
| P2 | **Matchmaking queue UI stub** (searching… cancel) for quick match | Feel premium |

**Out of scope:** real cross-region servers, voice, ELO, mobile.

---

## 2. Feature specs

### 2.1 Fog toggle

- Key `ff_fog_enabled` boolean (default `true`)
- `ThreeRenderer.setFogEnabled(boolean)` or read from localStorage each sync
- Pause menu + Settings: checkbox “Visão limitada (fog)”
- When off: all living enemies visible

### 2.2 Region on rooms

- Server: `region: "BR" | "US"` on create options + metadata + list response
- Default from creator `getRegion()` on client create/quickMatch
- `GET /rooms?region=BR`
- ServerBrowser filter region (All / BR / US)
- RoomPanel: show current region (from identity), send on create

### 2.3 Map visual identity

- Domain `listMaps()` already has id/displayName — add `accent: string` (hex) + optional `blurb`
- ServerBrowser + RoomPanel: colored chip / mini swatch by map
- No real image assets required (CSS gradient chip)

### 2.4 Settings panel

- Component `SettingsPanel` opened from pause
- Fields: volume (0–100 → `ff_volume`), fog on/off, camera default locked/free (`ff_camera_default`)
- Apply volume to Sfx via existing storage; GameClient reads camera default on start

### 2.5 Kill feed + death feedback

- Kill feed already exists — ensure max 6, fade animation CSS optional
- On local death: short “SPECTATING” or “Aguardando…” already partially there
- Optional: last damage direction indicator (skip if heavy)

### 2.6 Reconnect / last room

- On leave room or disconnect: store `ff_last_room_code` + mapId
- Lobby: “Reentrar na última sala” if code present
- On fail: clear storage

### 2.7 Quick match queue UI

- MainMenu quick match: show overlay “Procurando partida…” with Cancel
- 300–800ms min display even if instant (feel)
- On cancel: abort join/create if possible (leave)

### 2.8 Room full UX

- Server join when full → clear error “Sala cheia”
- Browser disable Entrar if clients >= maxClients

---

## 3. Parallel agents

| # | Scope |
|---|--------|
| 1 | Server region + full error messages |
| 2 | Domain maps accent + prefs keys helpers |
| 3 | roomClient region filters + last room storage API |
| 4 | ServerBrowser region/map chips + full button disable |
| 5 | Settings + fog toggle + camera default |
| 6 | ThreeRenderer fog toggle API |
| 7 | Quick match queue overlay |
| 8 | Rejoin last room UI |
| 9 | Kill feed CSS polish |
| 10 | Docs wave4 |

---

## 4. Success criteria

- [ ] Fog can be turned off in pause and persists  
- [ ] Rooms tagged by region; filter works  
- [ ] Map chips visible in list/create  
- [ ] Settings volume + fog + camera  
- [ ] Rejoin last room button  
- [ ] Quick match shows searching UI  
- [ ] Full rooms not joinable from UI  
- [ ] Tests + build green  

---

## 5. Approval

User: continue same format (spec then parallel agents). This is the wave-4 spec; implement after commit.
