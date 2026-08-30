# Strat planner (map-only notes)

Local-first: pick a **map**, create one or more **strat pages** (blank radar + drawings), save to IndexedDB — **no** `.dem` **required**. Same drawing tools as match review (pen, arrow, text), but organized as a playbook rather than round-scrubbed GOTV notes.

This is adjacent to, not a replacement for:

- **Demo notes** — strokes tied to rounds/ticks in a parsed match (`ReviewProject`)
- `apps/layouts` — callout polygon editor (dev tool, not deployed); edits `apps/web/public/layouts/{map}.json`

## Product sketch

1. Splash (or sub-mode): **Strat planner** → pick map (`de_mirage`, …).
2. **Strat set** list for that map (e.g. “A exec”, “B default”, “Mid control”).
3. Open a set → blank radar (upper/lower when map has floors) + drawing toolbar.
4. Draw pen/arrow/text; title on the set - each strat should have some name given.
5. **New page** within a set (second radar canvas state) or **new set** on same map.
6. Persist in IndexedDB; export/import JSON bundle (like notes today).

No playback, scoreboard, habits, or parse worker. Optional: show callout layout overlay read-only (from `layouts/{map}.json`) to snap strats to site names.

## Difficulty: **medium** (UI + storage) / **medium–hard** (clean reuse of radar drawing)

Not a greenfield app — most drawing code exists. Cost is **decoupling** demo-bound review from a static-map mode and **not** polluting demo saved-notes UX.


| Area                  | Reuse                                               | Gap                                                                                 |
| --------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Map PNG + calibration | `loadCalibrations`, `radarUrl`, `worldToScreen`     | Already map-only                                                                    |
| Stroke model          | `Stroke` in `notes/types.ts`                        | Every stroke has `round: number` (demo-centric)                                     |
| Draw on canvas        | `RadarCanvas` pointer path, `draw.ts`, `strokes.ts` | `RadarCanvas` **requires** `Replay`; paint loop pulls players, nades, kills         |
| Toolbar               | `MapToolbar`                                        | Wired in `RadarStage` to playback/bookmarks                                         |
| Sidebar list          | `Notes.tsx`                                         | Round clusters, moment clocks, jump-to tick — all need `Replay`                     |
| Persistence           | `projectStore.ts` / `ReviewProject`                 | Key = `matchKey(replay, fileName)`; fields assume demo (`fileName`, `scorecard`, …) |
| Splash list           | `DropZone` saved notes                              | Demo scorecards; strat sets need separate row type or filter                        |


**Rough effort (one developer, familiar with codebase):**

- **Thin v1** (one map, one strat set, pen/arrow/text, IDB save): ~3–5 days
- **Full sketch** (map picker, multi-set, multi-page, export, callout overlay toggle, splash integration): ~1–2 weeks
- **Polish** (templates, side CT/T colors, duplicate set, PDF page per strat): add on top

Harder than PDF Tier 1 (mostly tables). Easier than multi-demo habits overlay.

## Recommended architecture



### Separate project type (do not overload `ReviewProject`)

```typescript
// apps/web/src/lib/strats/types.ts
export interface StratPage {
  id: string;
  title: string;
  floor: FloorMode;
  strokes: Stroke[]; // round: 0 or drop round for strats
}

export interface StratSet {
  schema: number;
  key: string;           // e.g. strat|de_mirage|a-exec
  mapName: string;
  title: string;
  savedAt: number;
  pages: StratPage[];
  paletteId: string;
  color: string;
}
```

- **IndexedDB:** new object store `strats` (DB version bump in `projectStore.ts` or sibling `stratStore.ts`) — keeps demo notes migration simple.
- **Key:** `strat|${mapName}|${slug(title)}` — no roster/fileName.



### App mode

Extend splash with two paths:


| Mode          | Entry                                  |
| ------------- | -------------------------------------- |
| Analyze demo  | Today’s drop zone                      |
| Strat planner | Map dropdown → strat set list → editor |


`appState` gains `appMode: "demo" | "strat"` and optional `stratSession` (active set + page index). Viewer stays demo-only; new `StratEditor` route/component reuses radar column without `usePlayback`.

### Static radar component

Extract from `RadarCanvas`:

```
StaticRadarCanvas
  cal, floorMode, strokes, tool, color, onStrokes
  layers: { callouts?: boolean }   // no players, nades, HUD
```

Implementation options (pick one for v1):

1. **Fork paint path** — copy map blit + stroke draw from `RadarCanvas` (~150 lines), skip `buildRadarFrame`. **Lowest risk** for v1.
2. **Nullable replay** — `replay: Replay | null`; guard all gameplay layers. Touches hot viewer path; easy to regress.
3. **Shared** `paintMapAndStrokes(ctx, …)` — refactor both viewer and strat editor to call it. Best long-term; slightly more upfront.

Prefer **(1) for v1**, **(3) when adding PDF radar snapshots** (same primitive).

### Strokes without rounds

For strats, either:

- Fixed `round: 0` on all strokes and teach `notesByRound` to treat 0 as “the page”, or
- Make `round` optional on `Stroke` (`round?: number`) and branch in list/visibility (touches demo notes tests).

Safer: `round: 0` **+ page id in stroke** `group` or store strokes per `StratPage` (no round field on strat strokes at all — duplicate a slim `StratStroke` type if we want zero demo coupling).

### Sidebar for strats

New `StratSidebar`: page list, rename, add/delete page, stroke list (flat, not by round). Reuse `groups.ts` for grouping arrows/text on a page.

## What to defer

- Linking a strat page to a demo round (“compare to actual exec”) — future bridge feature
- Animated “walk through strat” playback — no ticks without demo
- Editing callout polygons in-app — stay in `apps/layouts`
- Multi-map strat book — one map per set is enough for v1



## Implementation order

One behavior per commit. Tests next to modules; synthetic strokes, no `.dem`.

1. `stratStore.ts` — IDB CRUD + schema v1 for `StratSet`.
2. `StaticRadarCanvas` — map + pen/arrow/text only; unit test render hook optional.
3. **Splash strat entry** — map picker + empty set creation.
4. **Strat editor shell** — toolbar (reuse `MapToolbar` props), save debounce.
5. **Multi-page** — add/rename/delete pages within a set.
6. **Strat list on splash** — separate section or tab; delete/export/import bundle.
7. **Callout overlay toggle** — read-only `loadMapLayout` labels on radar.
8. **PDF** (optional) — one page per strat page via shared snapshot helper (`PDF-EXPORT.md` Tier 2 primitive).



## Risks

- **Scope creep** into a second full app — keep v1 to “draw on map and save pages.”
- **IDB migration** — new store is safer than overloading `projects`.
- **Shared stroke type** — demo notes assume round/tick windows; strat pages should not show moment clocks unless we add fake timelines later.



## Relation to PDF export

Strat planner pages are ideal **Tier-2 PDF inputs** (static radar + strokes, no demo). Building `StaticRadarCanvas` / `radarSnapshot.ts` once serves both features.

## One-line scope

**Strat planner = IndexedDB playbook of blank-map drawings per map, reusing draw tools but not the demo parser or round timeline.**



## My comments

- common code that could be easily reused should be extracted - by that I mean e.g. keeping "strokes" not bound to rounds by default; the behavior should be different: each round/strat should OWN strokes, not vice versa
- PDF export is not part of that plan - it will be tied together in future, but currently these features are completely separate

