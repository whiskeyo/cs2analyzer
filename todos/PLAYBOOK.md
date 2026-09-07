# Playbook

Local-first tactics board: pick a **map**, pick or create a **playbook** on that map, fill **named strats** (pages) with radar drawings and movable tokens. **No `.dem` required.** Persist in IndexedDB. From the Analyzer, **Snapshot to playbook** copies the current view (single demo **or** aggregated series) onto a new named page of a playbook you choose.

This is adjacent to, not a replacement for:

- **Demo notes** — same `Note` type, owned by a match round
- `apps/layouts` — callout polygon editor (dev tool, not deployed)

PDF export is **out of scope**. Do not couple the two.

---

## Product

1. Nav: **Playbook** (`/playbook`) renders `pages/Playbook.tsx`. That page owns maps, books, strats, and the board. Analyzer owns the demo viewer. FAQ owns articles. No shared “mode.”
2. Pick a map → that map’s **playbooks** (zero or many) → open one, or create another.
3. A playbook has **pages**. Each page is a **named strat** (“A exec”, “B default”, …). Rename anytime.
4. Open a strat → radar (upper/lower when the map has floors) + draw tools + token palette.
5. Drop and drag **pawns** (CT and T), **grenades**, **bomb**; draw **pen / arrow / text** on the same canvas; move them freely.
6. From a loaded demo **or** aggregated series view: **Snapshot to playbook** → pick a playbook on this map (or create one) → new named page with entities from what is on the radar.

Playbook pages have no playback, scoreboard, parse worker, bookmarks, or moment clocks. Aggregated habits stay in the Analyzer; snapshot is how they land in a playbook as **static** tokens.

Optional: read-only callout overlay from `layouts/{map}.json`.

---

## Prerequisite: Round / strat owns a Note

**Do this first. Playbook UI does not start until demo notes use this model.**

Today a drawing **points at** a round:

```
ReviewProject.strokes: Stroke[]     // each Stroke.round, start_tick, group, …
notesByRound(strokes)               // reconstruct ownership
overlayVisible(st, tick, round)     // st.round !== round → hide
```

That is backwards. A **Note** is the shared document (analyzer + playbook). Geometry does not know about rounds, ticks, or groups.

```
Analyzer:  Round  → Note
Playbook:  Strat (page) → Note
```

```typescript
// apps/web/src/lib/notes/types.ts

/** Geometry only. No round, no ticks, no group. */
export type Drawing =
  | { type: "pen"; color: string; points: { x: number; y: number }[] }
  | { type: "arrow"; color: string; from: { x: number; y: number }; to: { x: number; y: number } }
  | {
      type: "text";
      color: string;
      x: number;
      y: number;
      text: string;
      box_w?: number;
      box_h?: number;
    };

export interface DrawingGroup {
  id: string;
  name: string;
  hidden?: boolean;
  /** Demo moment window. Omit both = whole round / whole strat. Ignored on playbook. */
  start_tick?: number;
  end_tick?: number;
  drawings: Drawing[];
}

export interface Bookmark {
  color: string;
  text: string;
  /** Pin tick. Demo only. */
  tick: number;
  start_tick?: number;
  end_tick?: number;
  hidden?: boolean;
}

export interface Note {
  groups: DrawingGroup[];
  loose: Drawing[];
  pieces: Piece[];
  bookmarks: Bookmark[];
}
```

- **`Note.visibleDrawings(tick | null)`** (pure function, e.g. `visibleDrawings(note, tick)`) decides what to paint. Analyzer passes the current tick: hidden off, group windows, loose = whole round unless we later wrap a loose item in its own group (today’s “squash into group” already does that). Playbook passes `null`: everything not `hidden`.
- **Loose vs group** stays the sidebar model (`NoteRoundList` already clusters this way). Grouping mutates `note.groups` / `note.loose`, not a `group` string on each stroke.
- **Bookmarks** live on the Note, not as a drawing type. Playbook notes keep `bookmarks: []`. Moment clocks stay Analyzer-only.
- **`groups.ts` / `visibility.ts` / `list.ts` / drag** operate on a `Note`, not a flat `Stroke[]` keyed by `round`. No `` `${s.round}:${s.group}` ``.

`Stroke` as it exists now (`round` + ticks + group + union type, including bookmark) goes away after the migration.

**IndexedDB notes** (`PROJECT_SCHEMA` 2 → 3):

```
ReviewProject.notes: { round: number; note: Note }[]
```

Parse buckets old `strokes` by `round`, splits group vs loose, lifts windows onto the group (shared window of members, same as `overlayWindow` today), bookmarks into `note.bookmarks`. Accept both JSON shapes so old exports still import.

In-memory Analyzer review: `Map<roundNumber, Note>` (or the array above). Undo commits whole notes-by-round, not a global stroke list. `notesByRound()` is unnecessary — the owner list **is** the sidebar.

This is **commit 1**. Touches notes + radar pointer, not the parser. Analyzer behavior must stay the same from the user’s point of view.

---

## Map → playbooks

Not one book per map. A map has **many** playbooks.

```
de_mirage
  "Defaults"          pages: Mid control, A default, …
  "A execs"           pages: Standard A, Split A, …
  "Anti-strats"       …
```

```typescript
// apps/web/src/lib/playbook/types.ts

export interface PlaybookPage {
  id: string;
  /** Strat name. Always set; default “Untitled strat”, user renames. */
  title: string;
  floor: FloorMode;
  note: Note;
}

export interface Playbook {
  schema: number;
  key: string;          // uuid — not playbook|map
  mapName: string;      // de_mirage
  title: string;        // "A execs"
  savedAt: number;
  pages: PlaybookPage[];
  activePageId: string;
  paletteId: string;
  color: string;
}
```

- List playbooks with `mapName === selectedMap`.
- New playbook on a map: prompt for title, one empty named strat.
- Duplicate playbook, delete, rename the book and every strat.
- Empty strat = `emptyNote()` (no drawings, no pieces).

**Snapshot** is a picker: playbooks for the **current map**, plus “New playbook…”. Then append a page to the chosen book.

---

## Shared board (drawings + tokens)

The strat’s `Note` **is** the board. Drawings and tokens sit together: click to place, drag to move, eraser / delete to remove.

```typescript
export type PieceKind =
  | "pawn"
  | "smoke"
  | "flash"
  | "he"
  | "molotov"
  | "incendiary"
  | "decoy"
  | "bomb";

export interface Piece {
  id: string;
  kind: PieceKind;
  x: number;
  y: number;
  z?: number;
  /** Pawn facing — same raw yaw as replay (`m_angEyeAngles`). */
  yaw?: number;
  side?: "CT" | "T";
  label?: string;
  alive?: boolean;
  carriesC4?: boolean;
}
```

World XY, same as `RadarFrame` pawns. Reuse pawn triangle, nade icons (`useRadarImages`), C4 icon.

Analyzer: round Note pieces sit **on top of** live pawns (optional after Playbook drag works — same `Note`, not a second model).

**Move:** text already drags. Pieces: hit-test + drag; pawns rotate yaw. Pen / arrow: translate the whole drawing. Playbook has no tick filter.

Token palette: CT pawn, T pawn, smoke, flash, HE, molly, decoy, bomb.

---

## What to ignore from the old strat-planner sketch

Checked against the tree. Do not follow the old file.

| Old assumption | Reality |
| --- | --- |
| Fork map blit + stroke draw from `RadarCanvas` | Already in `lib/radar/staticMapPaint.ts` (`paintStaticMap`). Viewer uses those helpers, then paints replay on top. |
| `MapToolbar` is “the draw bar” | Draw tools + undo on **review**; follow / trails / moment / layers on **view**. Playbook gets its **own** toolbar (pan, pen, arrow, text, eraser, colors, floor, undo) + token palette. Do not hide buttons on the demo toolbar. |
| Strat cards on the demo DropZone | Home is intro + drop. Saved notes are Analyzer. Playbook is **SiteNav** → `/playbook`. |
| Fake `Stroke.round = 0` for strats | Wrong. Fix ownership (Note) first; playbook reuses that Note. |
| PDF as a Playbook step | Separate todo. |

Do **not** overload `ReviewProject`. New object store. Do **not** make `RadarCanvas.replay` nullable.

---

## Pages (one route, one job)

There is **no** app-wide mode flag — not for Playbook, not for Analyzer, not for anything else. Do not add `appMode`, `viewMode`, or “switch back to demo.” The URL is the page. The page owns its UI.

| Path | Page | Owns |
| --- | --- | --- |
| `/` | `Home` | Intro + drop into Analyzer |
| `/analyzer` | `Analyzer` | Parse, **Viewer**, demo notes, snapshot-from-demo |
| `/playbook` | `Playbook` | Map → books → named strats → board |
| `/faq` | `Faq` | Articles |
| `/layouts` | `LayoutsApp` (dev) | Callout editor |

`App.tsx` Shell today hijacks Home **and** Analyzer when `session.replay != null` (`showViewer && !onFaq`). That is already a hidden mode: “a demo is loaded, so show Viewer.” **Do not extend it** (`&& !onPlaybook`). Playbook is not “Viewer, but hidden.”

Correct split:

- Shell **routes**: pathname → one page component. No `if (replay) Viewer`.
- **Analyzer** renders Viewer when *it* has a demo, DropZone when it does not.
- **Playbook** always renders the playbook UI. A demo sitting in `AppState` is just data (snapshot on Analyzer can write `playbookStore`). Opening `/playbook` does not pause, teardown, or “leave” the session; you are simply not on Analyzer.
- Playbook state (open map, book, strat) lives on the Playbook page, not on `appState` next to playback.

```
ROUTES.playbook = "/playbook"
```

SiteNav gets a Playbook link. Snapshot on Analyzer: picker → `playbookStore` → notice. “Open strat” navigates to `/playbook` (that page’s job).

| Goal | Where |
| --- | --- |
| Note, visibility, groups (shared) | `apps/web/src/lib/notes/` — **first** |
| Playbook types, IDB, snapshot | `apps/web/src/lib/playbook/` |
| Editor, palette, page list, book list | `apps/web/src/components/playbook/` |
| Route | `apps/web/src/pages/Playbook.tsx` |
| Token + map paint | `apps/web/src/lib/radar/` |

---

## Radar

Playbook canvas (`PlaybookCanvas`):

- Inputs: `cal`, `mapName`, `floorMode`, `note`, `tool`, `color`, `onNote`.
- Layers: map PNG, optional callouts, `visibleDrawings(note, null)`, pieces.
- No HUD, killfeed, economy, habits overlay.
- Pan/zoom: `lib/radar/viewport.ts`, `panZoom.ts`.
- Images: `useRadarImages` (no replay).

`useRadarPointer` today reads `replay` for round / tick / moment / bookmarks. Split a draw/drag pointer that takes a `Note` + optional Analyzer context (`tick`, `moment`). Playbook passes the Note only.

---

## Snapshot to playbook

Analyzer action (the Viewer lives there). Always **choose the playbook** (this map’s list + new). Then a **new named page**. Stay on Analyzer; notice includes the book title. “Open strat” is a navigation to `/playbook`, not a mode switch.

Do **not** copy Analyzer drawings. Snapshot is entities, so the page works without the `.dem`.

### Single demo (normal playback)

At `playback.tick`, from `buildRadarFrame` / `bombView` / `samplePlayers`:

| Source | Piece |
| --- | --- |
| Present pawns | `pawn` — x, y, z, yaw, side, name, alive, `carriesC4` |
| Visible nades | grenade kind at head / linger / centroid |
| Bomb planted or loose | `bomb` at x, y |
| Bomb carried | flag on that pawn |

**Default strat title:**

`{Team A} - {Team B} ({fileName}) · {roundLabel} {clock}`

Example: `NaVi - FaZe (faceit.dem) · R12 1:24`

- Team A / Team B = starting sides (`matchScorecard` / header `team_ct`–`team_t`), same names as saved notes.
- `fileName` = the loaded demo.
- Round label + `roundClock` at the snapshot tick.

User can rename after.

### Aggregated series (habits view)

Not live habits on a playbook page. Snapshot **the aggregated radar as it is now**.

When `isAggregatedView` (and overlay on): `habitsOnly` frames have **no** live pawns (`buildRadarFrame` early-return). Use `overlayAtPlaySec(habits.overlay, bucketPlaySec)`:

| Source | Piece |
| --- | --- |
| Each visible trail | `pawn` at the last point ≤ playhead (yaw from that point, `label` = player name, `alive` = no death yet). Dead trails → pawn at `deathAt`, `alive: false`. |
| Visible habits nades | grenade at `habitsNadeViewTick` land/head |
| Heatmap-only display | still snapshot trail heads (heatmap is not a piece) |

Many ghosts (one per matched round × player) is correct — that is the picture on screen.

**Default strat title (aggregated):**

`{focalTeam} series ({n} demos) · {bucketLabel} · {playClock}`

Example: `Spirit series (12 demos) · CT pistol · 0:24`

Picker still uses **the series map**.

---

## Persistence

Store `playbooks`, same DB `cs2analyzer`. Each row is one `Playbook` (uuid key, `mapName` field).

**Centralize `openDb`.** `projectStore.ts` owns `indexedDB.open` (`DB_VERSION = 3`: `projects`, `demoHandles`). User-settings also needs a bump. One `lib/storage/idb.ts` `onupgradeneeded` so Playbook and settings do not fight over version numbers.

Export/import: `{ schema, exportedAt, playbooks: Playbook[] }` from the Playbook page, not the demo drop zone (`isNotesFile` is any `*.json` today).

---

## Sidebar / toolbar

**Playbook page:** map → list of that map’s playbooks → inside a book, named strats (add, rename, duplicate, delete, reorder). Selected strat: `Note` groups / loose / pieces.

**Playbook toolbar:** pan, pen, arrow, text, eraser, colors, floor, undo/redo, clear strat, token palette. No follow, trails, moment, bookmark, heatmap, nade-summary, openings.

Analyzer `MapToolbar` unchanged.

---

## Difficulty

**Medium–hard**, dominated by the Note ownership refactor.

| Area | Reuse | Gap |
| --- | --- | --- |
| Map PNG + calibration | `loadCalibrations`, `radarUrl`, `worldToScreen` | Map picker = `Object.keys(calibrations)` |
| Map + drawing paint | `paintStaticMap` | Paint `Note` + pieces |
| Notes | today’s grouping / clocks / sidebar | Round owns `Note`; drawings are dumb |
| Pointer | `useRadarPointer` | `Note` in, replay optional |
| Snapshot (demo) | `buildRadarFrame`, `bombView` | `frameToPieces()` + title + book picker |
| Snapshot (aggregated) | `overlayAtPlaySec`, trail points, `habitsNadeViewTick` | `overlayToPieces()` |

Rough effort:

- Note ownership + migration tests: ~3–4 days
- Playbook shell (route, IDB, map → books → named strats, drawings): ~3–5 days
- Tokens + move + snapshot (demo + aggregated) + book picker: ~4–6 days
- Callouts, export/import: add on top

---

## Implementation order

One behavior per commit. Tests next to modules. No `.dem` except snapshot tests with fixture frames / overlay fixtures.

1. **Note ownership** — `Drawing` / `DrawingGroup` / `Note`; `ReviewProject.notes`; migrate parse; rewrite `visibility` / `groups` / `list` / drag / pointer / sidebar. Analyzer UX unchanged.
2. **Shared `openDb`** — add `playbooks` store.
3. **`playbookStore.ts`** — CRUD; many books per `mapName`; pages with titles + `Note`.
4. **`PlaybookCanvas`** — map + `visibleDrawings(note, null)`.
5. **Route `/playbook`** — map picker, playbook list, create/rename book, editor, save debounce.
6. **Named strats** — add / rename / duplicate / delete / switch pages.
7. **Pieces** — paint, palette, drag, pawn yaw, sidebar.
8. **Move drawings** — translate selected pen/arrow.
9. **Snapshot (single demo)** — picker of this map’s playbooks; `frameToPieces`; default title with teams + file + round clock.
10. **Snapshot (aggregated)** — `overlayToPieces` at playhead; series title.
11. **Export/import** playbook JSON.
12. **Callout overlay toggle**.

Defer:

- Linking a strat to a demo round (“compare to actual exec”)
- Animated walkthrough on a page
- Editing callout polygons (stay in `/layouts`)
- PDF
- Dropping playbook JSON on Home/Analyzer
- Analyzer piece layer on round notes (same `Note.pieces`, later)

---

## Risks

- Note ownership is the largest notes change since grouping. Tests for old+new JSON, groups, visibility, list, before any Playbook UI.
- IDB version vs user-settings — one `openDb`.
- Pointer split can regress Analyzer draw/eraser/text-move.
- Aggregated snapshot can create many pieces; that is intended, but keep drag/list usable.

---

## Relation to other todos

- **User settings** — `defaultPaletteId` / `defaultColor` for a new playbook / new strat. Reset must not wipe playbooks.
- **PDF export** — not this work. `paintStaticMap` (+ piece paint) is the likely radar image helper later.

## One-line scope

**Playbook = many named tactics books per map, each with named strats that own the same Note type as a demo round, plus snapshot from a single demo or an aggregated series into a book you pick.**

---

## Q&A

Decisions made while implementing. Answer later if you disagree; the code follows these until then.

**Timed loose drawings.** Plan said `loose: Drawing[]` (whole round). Analyzer still stamps a moment window on an ungrouped pen. To keep that, loose items are `{ drawing, hidden?, start_tick?, end_tick? }` — ticks live on the wrapper, not on `Drawing`.

**Group identity.** Old notes used `stroke.group` as both id and label. New `DrawingGroup` keeps `id` and `name` equal on migrate/create so flatten-back matches today’s JSON.

**Shell / Viewer.** Analyzer will own Viewer when the Playbook route lands. Until that commit, Shell still hijacks Home+Analyzer when a demo is loaded (unchanged).
