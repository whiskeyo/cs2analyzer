# PDF export

Local-first: generate a shareable report from a saved note (and optionally the loaded demo) without uploading anything. PDF complements — does not replace — existing **CSV** (scoreboard) and **JSON** (notes bundle) exports.

## What we already have

| Source | Contents |
|---|---|
| `ReviewProject` (`projectStore.ts`) | `scorecard`, `playerStats`, `strokes`, bookmarks, text notes, palette, linked demo label |
| `computeStats` / `exportStatsCsv` | Full live scoreboard at a tick |
| `playerReview` / `seriesPlayerReview` | Review headlines + jump-to round notes |
| `RadarCanvas` + `paintRadarFrame` | Map PNG, strokes, players, nades at a tick |
| Saved notes list (`DropZone`) | Scorecard title + hover stats table without opening the demo |

The **unique value** vs FACEIT/HLTV is annotated radar moments tied to rounds/ticks. PDF should lean into that, not duplicate CSV as pages of numbers.

## Product: three tiers (ship in order)

### Tier 1 — Match one-pager (MVP)

One PDF per saved note / demo. Works from IndexedDB even when the `.dem` is not loaded.

**Include**

- Header: map, teams, final score, half breakdown (`scorecard`)
- Scoreboard table: K/D/A, ADR, KAST, rating, entry FK/FD (`playerStats` or recompute if demo open)
- Text notes: bookmarks + text strokes, grouped by round
- Review bullets: top headlines + round labels (selected player or both teams)
- Footer: filename, export date, “re-open `.dem` in cs2analyzer to scrub”

**Skip**

- Full tick replay, every round automatically, animated trails, aggregated habits across 12 demos

**Who it's for:** post-match debrief handout, Discord/email attachment, coach prep before a call.

### Tier 2 — Round pages (differentiator)

One or two pages per **marked moment** — what you'd screen-cap today.

Per bookmark / note group / picked round:

- Radar snapshot: map PNG + rendered strokes at saved tick/window
- Caption: round number, clock, economy tag, score context
- Optional: mini killfeed or opening duel for that round

**Technical core:** composite what `RadarCanvas` already draws onto an offscreen canvas → PNG → embed in PDF. Tables and text are easy; this is the hard part.

**Default export set:** one-pager + **bookmarked rounds only** (not all 30 rounds).

### Tier 3 — Series / habits report (later)

Only if multi-demo coaching PDFs become a real ask:

- Focal team + map filter, util-set frequency, action beat counts
- One or two aggregated overlay stills (bucket A freeze-relative frame)

Heavy layout work; wait until Tier 1–2 feel good.

## Export entry points

| Where | Output |
|---|---|
| Saved notes row | Tier 1 (demo optional) |
| Viewer header / Notes tab | Tier 1 + user picks rounds/groups for Tier 2 |

Optional pre-export checkboxes: scoreboard, review, text notes, radar frames (bookmarks / current round / pick rounds).

## What not to put in PDF

- Raw CSV duplicate (attach CSV separately if needed)
- FACEIT-style “official” rating (we show HLTV 2.0-style — label it)
- Heatmap/trail animation frames unless curated to one still

## Implementation approaches (simplest first)

1. **Print CSS (`window.print()`)** — report layout in DOM, user saves as PDF. Fast; radar still needs an `<img>` snapshot; print layout fiddly.
2. **Client PDF (`pdf-lib` or `jspdf`)** — programmatic pages, embed PNG snapshots. One-click download; table layout by hand.
3. **Report canvas** — reuse `buildRadarFrame` + stroke renderer on offscreen canvas (same path as viewer). Right long-term approach for Tier 2.

Stay **local-first** — no server; input is `ReviewProject` + optional live `Replay`.

## Suggested module layout

```
apps/web/src/lib/export/
  matchReport.ts      # Tier 1 data: sections from ReviewProject (+ replay?)
  radarSnapshot.ts    # offscreen canvas → PNG (Tier 2)
  pdfDocument.ts      # pdf-lib wrapper: pages, tables, embed images
```

## Implementation order

One behavior per commit (`AGENTS.md`). Tests on synthetic `ReviewProject` fixtures, never `.demos/*.dem`.

1. **`matchReport.ts`** — pure function: `{ title, scoreboardRows, noteSections, reviewBullets }` from `ReviewProject`.
2. **Tier 1 PDF** — button on saved notes + viewer; `pdf-lib`, no radar yet.
3. **`radarSnapshot.ts`** — one round at one tick with strokes; unit test with fake cal + strokes.
4. **Tier 2** — export bookmarked rounds; checkbox UI.
5. **Print CSS fallback** (optional) — if pdf-lib bundle size hurts Vite build.

## Open questions

- Bundle size budget for `pdf-lib` vs print-only v1?
- Re-open demo required for Tier 2 when strokes use tick windows but demo unlinked?
- Include callout layout labels on radar stills when `places` loaded?

## One-line scope

**PDF = shareable match summary plus annotated radar stills for the moments you marked — not a printable version of the whole app.**
