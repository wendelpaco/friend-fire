# Friend Fire — Sponsor kit

**Contact:** [anuncie@friendfire.gg](mailto:anuncie@friendfire.gg)

Browser tactical shooter (top-down). Short rounds, high session frequency, **in-world and lobby advertising** with always-on **AD** disclosure. No mid-fight popups.

## Placements

| Placement | Where players see it | Format notes |
|-----------|----------------------|--------------|
| `lobby_banner` | Main menu (`/`) | HTML banner, rotates ~9s |
| `pause_banner` | In-match pause (Esc) | Compact HTML banner |
| `map_billboard` | 3D outdoor towers on Dust FF | Large brand boards in world |
| `map_poster` | 3D wall posters on Dust FF | Mid-size wall creatives |
| `end_match_break` | Full break after series ends | High attention, post-match |
| `rewarded_xp` | Opt-in after match (stub → real SDK later) | Completes → XP grant |

Creatives are data-only: swap brands/colors/CTA in `src/domains/ads/catalog.ts` without touching gameplay. Map slots assign creative IDs in `src/domains/world/maps/dust.ts`.

## Sample pricing (placeholders)

*Illustrative only — not live rates. Volume, exclusivity, and geo packages negotiated directly.*

| Package | Placements | Suggested window | Placeholder CPM / flat |
|---------|------------|------------------|------------------------|
| **Lobby pulse** | `lobby_banner` | 1 week | $X CPM or $Y flat |
| **Map presence** | `map_billboard` + `map_poster` | 2 weeks | $X CPM or $Y flat |
| **End-match spotlight** | `end_match_break` | 1 week | $X CPM or $Y flat |
| **Full surface** | All non-rewarded | 1 month | $X package |
| **Rewarded partner** | `rewarded_xp` | pilot | rev-share TBD |

Impressions (v1) are logged client-side (`placement`, `creativeId`, `sessionId`, `timestamp`) for partner reporting; server-side metrics pipeline later.

## Creative guidelines

- Provide brand name, headline, optional subline, CTA, primary/secondary colors, accent
- Optional destination URL (opens on click where UI allows)
- Always displayed with **AD** badge
- No mid-round interruptive creatives

## How to onboard

1. Email **anuncie@friendfire.gg** with brand goals, geo, and preferred placements  
2. We insert creatives in the catalog (or future CMS) and assign map slots  
3. QA on staging → ship → share impression summary  

See also: [README](../README.md) · product design under `docs/superpowers/specs/`.
