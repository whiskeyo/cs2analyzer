# Web app code quality (refactor backlog)

Improve **`apps/web`** structure, testability, and maintainability without a framework rewrite. Parser stays Rust; React + TS stays the shell (`docs/frontend-migration.md` option **D** is in scope long-term; full Leptos port is **out of scope** here).

Goal: make the next features (PDF export, strat planner, user settings) cheap to add — not a big-bang cleanup.

---

## Part 1 — Guidelines

These are **project-specific** rules for this repo. They extend AGENTS.md (`components/` vs `lib/`, one behavior per commit, named constants).

### Architecture (SOLID, adapted)

| Principle | Rule for cs2analyzer web |
|---|---|
| **Single responsibility** | One module = one reason to change. `stats.ts` doing scoreboard + HUD + CSV + caching is a violation. UI files > ~250 lines with domain logic should move logic to `lib/`. |
| **Open/closed** | Extend via new functions/modules, not `if (aggregated)` branches sprinkled in unrelated files. Series vs single-demo behavior goes behind small predicates or separate components. |
| **Liskov** | Prop-driven radar/playback pieces must work **without** `AppStateProvider` (tests, future strat editor). Do not require `useApp()` inside leaf canvas code. |
| **Interface segregation** | Avoid 15+ flat props. Group into `{ playback, review, view }` bundles or a narrow hook return type. Consumers take only what they need. |
| **Dependency inversion** | **Hooks depend on data/callbacks, not on sibling hooks.** `useReviewProject({ demo, playback })` is OK; `useReviewProject()` calling `useApp()` internally is not. Composition stays in `appState.tsx` only. |

### Layering (strict)

```
components/     JSX, layout, event wiring — no formulas, no IndexedDB, no worker
lib/<feature>/  pure functions + hooks + types
lib/state/      composition root only (wires hooks together)
lib/shared/     cross-cutting constants + tiny helpers (no feature imports)
lib/testing/    fixtures only (tests import from here, not vice versa)
```

**Forbidden**

- Stats formulas in TSX (use `lib/stats` or `lib/match`)
- Direct `indexedDB` outside `projectStore` / future `userSettingsStore` / `stratStore`
- Importing `components/` from `lib/`
- New `Foo.tsx` beside `lib/foo/` (AGENTS.md)

### DRY

- **One canonical helper** for repeated patterns: file download, series-mode checks, demo-load reset, clamp/parse settings.
- **Do not dedupe Rust ↔ TS stats** by deleting TS — keep parity until WASM stats API exists (`parity.test.ts`). DRY applies inside the web app first.
- **Barrel files** (`lib/notes/index.ts`): OK for public API; do not re-export everything if call sites import 20 symbols anyway — prefer direct imports or a smaller surface.

### React rules (this codebase)

1. **Canvas / playback hot path** — tick and rAF state live in **refs**; React state updates at most ~16 Hz for tick integer. Do not fix `react-hooks/exhaustive-deps` in `RadarCanvas` / `useRadarPointer` by adding reactive deps — document with eslint-disable + comment (already the pattern).
2. **`react-hooks/refs` stays off** in ESLint (AGENTS.md).
3. **One context** (`AppStateContext`) — do not add SettingsContext, NotesContext, etc. New global prefs → `useUserSettings` merged into `AppState` or passed from composition root.
4. **Context vs props** — pick one layer and stick to it:
   - **Shell chrome** (`SeriesBar`, `ViewerHeader`, `Splash`): `useApp()` OK.
   - **Radar subtree**: prop-driven from `RadarStage` (testable).
   - **Sidebar tabs**: props from `Viewer` (no `useApp()` in tab panels).
   - Do not mix without reason — today `Sidebar` breaks this (uses `useApp()` for series mode **and** takes props).
5. **Effects** — prefer `useLayoutEffect` for demo-switch resets that must run before paint; consolidate the three “reset on demo id” implementations into one helper.
6. **Memo** — use on heavy list/canvas wrappers (`Sidebar`, `Controls`, `RoundStrip`); do not wrap every leaf.
7. **No default exports** except Vite entry / lazy routes (project uses named exports).

### TypeScript rules

- **`strict` stays on** — no `@ts-ignore`; fix types or narrow with type guards.
- **Prefer `interface` for object shapes** exported across modules; `type` for unions (`DrawTool`, `Side`).
- **Discriminated unions** for stroke types, worker messages, settings patches — already good in `notes/types.ts` / `replayTypes.ts`; extend that pattern.
- **No `as Foo` casts** to silence parse/IDB — use `parseProject`-style validators.
- **Shared constants** — CS2/domain numbers in `lib/shared/constants.ts` with names; UI pixels OK as literals.
- **Export types next to hooks** (`DemoSession`, `ReviewStore`, `Playback`) — consumers should not infer huge return types.

#### `any` vs `unknown` (policy)

**Audit (Aug 2025):** almost no explicit `any` in `apps/web` / `apps/layouts` — `strict: true` is doing its job. What looks like “everything is `unknown`” is mostly **boundary parsing** (IndexedDB, file import, layout JSON, WASM JSON). That is intentional: `unknown` forces narrowing before use; swapping to `any` would be a regression.

| Location | Today | Target |
|---|---|---|
| `JSON.parse` | returns `any` from lib; callers cast to `unknown` | single `parseJson(text): unknown` helper; never assign `JSON.parse` to a typed variable |
| `parseProject` / `parseMapLayout` / `decodeReplay` | `raw: unknown` → typed output | keep `unknown` **only** on these entry points |
| Inner helpers (`parseStroke`, `parseCallout`, …) | repeated `v as { x?: unknown; … }` | shared validators (see Track H) |
| `catch (err)` | `unknown` in layouts; mixed elsewhere | always `catch (err: unknown)` + narrow for message |
| Tests / DOM mocks | `as unknown as Worker` | OK in tests; do not spread to prod code |
| `useResetOn(key: unknown)` | generic reset key | prefer `string \| number \| null` or branded id if call sites allow |

**Do not “fix” `unknown` by erasing it** — fix by **confining** it to the parse boundary and returning strong types (`ReviewProject`, `MapLayout`, `Replay`).

**Tooling (enforce, Track H):**

```javascript
// eslint base — add alongside curly (Track G)
"@typescript-eslint/no-explicit-any": "error",
"@typescript-eslint/no-unsafe-assignment": "error",      // optional phase H2 — catches any leakage
"@typescript-eslint/no-unsafe-member-access": "error",   // optional phase H2
"@typescript-eslint/no-unsafe-call": "error",            // optional phase H2
"@typescript-eslint/consistent-type-assertions": [
  "error",
  { assertionStyle: "never", objectLiteralTypeAssertions: "never" },
], // H3 — ban `as Foo` except tests; use type guards / satisfies
```

Start with **`no-explicit-any` only** (zero or few fixes today). Enable `no-unsafe-*` after parsers are consolidated — otherwise eslint fights every `Record<string, unknown>` field read. **`consistent-type-assertions`** last: many legitimate narrow steps in validators; migrate to guards first.

**Optional runtime schema lib:** [Zod](https://zod.dev) / Valibot — generates types + parse in one place. Heavier dependency; the hand-rolled `Shape` pattern in `decode.ts` already works. Prefer **extending that pattern** into `apps/shared/validate/` before adding Zod unless USER-SETTINGS / strat stores need many new schemas.

### Formatting rules (owner preference — enforce in tooling)

**Semicolons:** always. Already `"semi": true` in both apps’ `.prettierrc.json`. Prettier is the source of truth for semicolons — run `format:check` in CI.

**Braces:** always, including single-statement bodies. C/C++/Rust-style:

```typescript
if (someCondition) {
  return null;
}

for (const x of xs) {
  if (x.hidden) {
    continue;
  }
}
```

Prettier **does not** enforce block braces (it may leave `if (x) return;` as one line). Use **ESLint `curly`**:

```javascript
// shared eslint base (apps/web + apps/layouts)
rules: {
  curly: ["error", "all"],
}
```

`eslint --fix` auto-inserts braces for many violations. After enabling, one mechanical commit per app (or per directory if diff > ~1000 lines).

**Not required:** Allman/braces on new line for functions — Prettier keeps K&R (`if (x) {`). Do not fight Prettier on brace placement; only require **block** braces.

**Shared config:** hoist `.prettierrc.json` + eslint base to repo root or `apps/shared/config/`; both apps extend it so web and layouts never drift.

### Testing rules

- **Pure logic** → `*.test.ts` (node project).
- **Components** → `*.test.tsx` (jsdom); mock minimal props, not whole `useApp`.
- **Fixtures** → `lib/testing/fixtures.ts`; extend there instead of inline replay builders in tests.
- **New `lib/` modules** ship with tests in the same commit when behavior is non-trivial.
- **Hooks** — test via extracted pure functions first; hook smoke tests optional unless regression-prone (`useDemoSession` worker lifecycle).

### Commit / scope rules (unchanged)

One behavior per commit, ~1000 line cap. Refactor commits say **why** (e.g. “extract note drag so strat planner can reuse it”), no drive-by feature work.

---

## Part 2 — Current state (audit summary)

~141 TS/TSX files, ~22.5k LOC (excl. generated `parser/`).

### Strengths

- Clean `components/` vs `lib/` split; matches AGENTS.md.
- Single composition root (`appState.tsx`); hooks testable in isolation when given mocks.
- `lib/match/` fully unit-tested; stats have good coverage + opt-in Rust parity.
- Strict TS + Prettier; intentional eslint exceptions documented.
- Radar prop-driven at leaves (`RadarStage` adapter pattern).

### Pain points (prioritized)

| Priority | Area | Issue |
|:---:|---|---|
| P0 | `lib/stats/stats.ts` (~950 lines) | God module: computeStats, live HUD, scorecard, CSV, weapon breakdown, caches |
| P0 | `components/sidebar/Notes.tsx` (~656 lines) | UI + drag + grouping + moment clocks inline |
| P1 | `components/radar/RadarCanvas.tsx` (~443 lines) | rAF loop + paint + habits + strokes + pointer |
| P1 | `lib/notes/useReviewProject.ts` (~517 lines) | persistence + undo + import/export + series cache + debounce |
| P1 | `lib/state/*` | **Zero tests** despite being coupling hub (refs, bucket transport, player sync) |
| P2 | Series mode checks | `aggregated && series && …` duplicated in `Viewer`, `Sidebar`, `SeriesFilters`, `ViewerHeader` |
| P2 | `lib/parse/series*.ts` (8 modules) | Parallel naming; color split (`seriesDemoColor` vs `seriesSteamColor`); no index doc |
| P2 | Settings scattered | localStorage in 3 places + constants (see `USER-SETTINGS.md`) |
| P3 | `components/app/DropZone.tsx` (~406 lines) | Splash + saved list + pagination + marketing |
| P3 | `MapToolbar.tsx` | 18 flat props |
| P3 | Component tests | 6/44 components; `Notes`, `RadarCanvas`, playback untested |
| P3 | **`apps/web` ↔ `apps/layouts`** | Duplicate `radarLayout`, layout JSON parser, `.map-toolbar` CSS, eslint/prettier configs |
| P3 | **Parse validators** | `unknown` + `as Record<string, unknown>` repeated in `projectStore.ts`, `layouts.ts`, `layout.ts`; no shared guard helpers |
| P4 | Rust/TS stats duplication | Correctness burden; long-term WASM stats (separate track) |

### Intentional patterns (do not “fix”)

- Ref bridges in `appState` (`stashSeriesReviewRef`, `bucketTransportRef`) — avoids hook cycles.
- Hybrid context + props — keep, but **narrow** (see guidelines).
- Module-level caches in `stats.ts` / `liveTeams` — performance; test with new replay identity when needed.

---

## Part 3 — Proposed changes

### Track A — Structure (SOLID / file shape)

#### A1. Split `lib/stats/stats.ts`

Target layout (re-export from `stats.ts` temporarily for small diffs):

```
lib/stats/
  stats.ts           # re-exports + computeStats orchestration only
  computeStats.ts    # K/D/A, ADR, KAST, trades, rating, cache
  liveScore.ts       # liveScore, liveTeams, roundSidesSwapped, currentSide
  scorecard.ts       # matchScorecard, formatScorecard, MatchHalfScore
  hud.ts             # bomb, defuse, freeze, roundWinBanner, liveSituation
  format.ts          # formatAdr, formatKast, exportStatsCsv
  weaponBreakdown.ts
  types.ts           # SavedPlayerSnapshot, LiveTeams, …
```

Each split file gets tests moved/added from `stats.test.ts`. **No formula changes** in split commits.

#### A2. Extract note UI logic from `Notes.tsx`

Move to `lib/notes/`:

- `useNoteDrag.ts` — drag state, drop targets (or extend `drag.ts`)
- `NoteRoundList.tsx` subcomponents in `components/sidebar/notes/` **only if** JSX; else keep one `NotesPanel.tsx` ~200 lines

Target: `Notes.tsx` = layout + wiring; round list rows as small components.

#### A3. Extract `lib/radar/staticMapPaint.ts` (shared with strat + PDF)

From `RadarCanvas` paint path: **map PNG + strokes only** (no replay). Used by:

- Strat planner (`STRAT-PLANNER.md`)
- PDF radar snapshots (`PDF-EXPORT.md`)

Refactor `RadarCanvas` to call shared helper for stroke layer — DRY, not duplicate fork.

#### A4. Slim `useReviewProject`

Extract:

- `lib/notes/reviewPersistence.ts` — debounced save, load, seed, flush series cache
- `lib/notes/reviewHistory.ts` — undo/redo stacks
- `lib/notes/reviewImportExport.ts` — bundle import/export + download

Hook becomes orchestration (~150 lines).

#### A5. Series mode predicate

```typescript
// lib/parse/seriesMode.ts
export function isMultiDemoSeries(session: DemoSession): boolean;
export function isAggregatedView(habits: SeriesHabitsState, session: DemoSession): boolean;
export function isBucketOverlayActive(habits: SeriesHabitsState, session: DemoSession): boolean;
```

Replace duplicated boolean chains in `Viewer`, `Sidebar`, `ViewerHeader`, `SeriesFilters`.

#### A6. Demo-switch reset helper

```typescript
// lib/state/demoReset.ts
export function useResetOnDemoChange(demoId: string | null, reset: () => void, mode: "layout" | "effect"): void;
```

Unify `usePlayback`, `viewState`, `useResetOn` patterns.

#### A7. Prop bundles for radar toolbar

```typescript
type MapToolbarReviewProps = { tool; color; paletteId; floorMode; canUndo; canRedo; … };
type MapToolbarViewProps = { follow; trails; moment; layers; … };
```

Reduces `MapToolbar` arity; same for `RadarCanvas` if feasible.

---

### Track B — DRY utilities

| Helper | Location | Replaces |
|---|---|---|
| `downloadBlob(filename, mime, data)` | `lib/shared/download.ts` | `downloadJson` in `useReviewProject`, CSV in `ViewerHeader` |
| `loadPersistedNumber(key, parse, fallback)` | removed when `USER-SETTINGS.md` lands | sidebar width, lead-in, habits window localStorage |
| `requestIdleCallback` wrapper | `lib/shared/idle.ts` | copy-paste in `RoundStrip` etc. |

---

### Track C — Tests (fill critical gaps)

Order by risk:

1. **`lib/state/seriesMode.test.ts`** — pure predicates (quick win).
2. **`lib/notes/groups.test.ts` + `visibility.test.ts`** — note operations used everywhere.
3. **`useReviewProject` persistence** — test via extracted `reviewPersistence.ts` with fake IDB.
4. **`appState` integration** — one smoke test: mock hooks, assert `onFiles` routes JSON vs dem.
5. **`Notes` drag** — logic tests in `lib/notes/drag.test.ts` (may already exist partially).
6. **Playback** — `roundTimeline` done; add `useHotkeys` map table test (static config).

Do **not** block features on 100% component coverage.

---

### Track F — Shared with `apps/layouts` (DRY across frontends)

`apps/layouts` is a local callout editor (not deployed); it writes JSON to `apps/web/public/layouts/`. It shares radar canvas UX, map assets, and layout schema with the viewer — but today **duplicates** code instead of importing it.

#### Duplication inventory (audit)

| Area | Web | Layouts | Notes |
|---|---|---|---|
| Radar viewport math | `lib/radar/maps.ts` (`radarLayout`, world↔screen) | `lib/maps.ts` (`radarLayout`, radar↔screen) | Same math; web hardcodes `1024` / `pad=16`, layouts uses named constants |
| Map calibrations | `loadCalibrations()` + cache | `loadCalibrations()` fetch | Same `/maps/calibrations.json` |
| `MapCalibration` | `replayTypes.ts` (+ floors) | `types.ts` (subset) | Layouts missing `floors[]`; should extend shared type |
| Layout JSON schema | `lib/radar/layouts.ts` (parse + cluster + load) | `lib/layout.ts` + `types.ts` | **Two parsers** for the same `{map,callouts,groups}` file |
| Group ids / labels | `lib/notes/groups.ts` (strokes) | `lib/groups.ts` (callouts) | Similar `nextGroupId` / `groupLabel`; different entity types |
| Pan/zoom pointer | `lib/radar/useRadarPointer.ts` (~438 lines) | `lib/useLayoutPointer.ts` (~380 lines) | Shared: wheel zoom, pan ref, rAF; diverged: draw tools vs polygon edit |
| Canvas rAF shell | `RadarCanvas.tsx` | `LayoutCanvas.tsx` | DPR resize, map blit, view transform — same skeleton |
| Toolbar CSS | `index.css` `.map-toolbar` | `index.css` `.map-toolbar` | **Copy-pasted** (~40 lines identical) |
| Theme tokens | `:root` colors, IBM Plex Sans | same | Identical dark palette |
| Tooling | `.prettierrc.json`, `eslint.config.js` | same | Duplicate configs |
| Constants | `shared/constants.ts` | `lib/constants.ts` | `RADAR_OVERVIEW_SIZE`, `LAYOUT_GROUP_NAME_MAX`, zoom limits |

#### Recommended shared package

Add **`apps/shared/`** (plain TS + CSS, no React — both apps import via Vite alias `@shared/*`):

```
apps/shared/
  package.json              # "name": "@cs2analyzer/shared", private
  radar/
    viewport.ts             # RadarView, radarLayout, screenToRadar, radarToScreen
    constants.ts              # RADAR_OVERVIEW_SIZE, RADAR_FIT_PAD, VIEW_SCALE_*
  layout/
    schema.ts               # MapLayout, LayoutCallout, parseMapLayout, formatLayout
    types.ts                # shared layout types (move from web layouts.ts)
  css/
    tokens.css              # :root colors, font stack
    map-toolbar.css         # .map-toolbar, .swatch, .floor-picks
    canvas-stage.css        # .radar-col, canvas wrap, touch-action
  config/
    eslint.base.js          # recommended + curly: all + prettier disable
    prettier.config.json    # semi, printWidth 100
```

**Ownership rules**

- **Web owns** layout schema — layouts app is an editor for files the viewer consumes (`public/layouts/{map}.json`).
- **Shared owns** radar pixel math and CSS tokens — no demo/parser/stats imports in `apps/shared`.
- **Layouts keeps** polygon geometry (`geometry.ts`), callout CRUD, Save-to-folder API (`api.ts` → web `public/layouts/`).
- **Web keeps** world coords (`worldToRadar`, `worldToScreen`), replay-specific paint, notes strokes.

#### Migration steps (incremental)

1. Create `apps/shared` + Vite/tsconfig paths in **both** apps.
2. Move `radarLayout` + screen transforms + constants → `shared/radar/viewport.ts`; delete duplicates in `layouts/lib/maps.ts` and trim `web/lib/radar/maps.ts` (world helpers stay).
3. Move `parseMapLayout` / `MapLayout` types → `shared/layout/schema.ts`; layouts `layout.ts` re-exports or wraps; **delete** duplicate parser in layouts.
4. Extract shared CSS; both apps `@import "@shared/css/tokens.css"` etc.
5. Hoist eslint/prettier base; enable `curly: all` in both apps.
6. **`staticMapPaint.ts`** (Track A3) lives in `web` but uses `shared/radar/viewport` — strat planner and layouts canvas use the same blit math.
7. Optional later: extract `usePanZoom(viewRef)` hook fragment shared by both pointer hooks (keep tool-specific handlers separate).

#### What not to merge

- Do not fold layouts into the web Vite app (different dev port, different deploy story per AGENTS.md).
- Do not share React components wholesale — prop models differ (callouts vs pawns). Share **math, schema, CSS**, not `RadarCanvas` ↔ `LayoutCanvas`.
- Do not block web refactors on layouts — shared extractions are small commits either app can trigger.

---

### Track G — Formatting rollout (braces + shared Prettier)

| Step | Action |
|---|---|
| G1 | Add `apps/shared/config/eslint.base.js` with `curly: ["error", "all"]` |
| G2 | Root or shared `.prettierrc.json`; apps extend (keep `semi: true`) |
| G3 | Wire `apps/web/eslint.config.js` + `apps/layouts/eslint.config.js` to extend base |
| G4 | `npm run lint -- --fix` in web, then layouts (mechanical brace inserts) |
| G5 | CI already runs `format:check` + `lint` for both — no new jobs |

Expect a **large diff** on G4; split by `apps/web/src/lib` then `components` then `apps/layouts` if over ~1000 lines per commit. Behavior unchanged.

---

### Track H — Type safety (`any` ban + shrink `unknown` noise)

**Goal:** no new `any`; `unknown` only at untrusted-data boundaries; inner code works on typed models.

#### H1 — ESLint guardrails (small diff)

| Step | Action |
|---|---|
| H1a | Add `@typescript-eslint/no-explicit-any: error` to shared eslint base (Track G) |
| H1b | Add `parseJson(text: string): unknown` in `apps/shared/validate/json.ts` (or `web/lib/shared/` until shared exists); replace bare `JSON.parse` at call sites |
| H1c | Standardize `catch (err: unknown)` + `err instanceof Error ? err.message : String(err)` helper |

Run lint — expect **zero or handful** of fixes today.

#### H2 — Shared validators (medium; pairs with Track F14)

Extract the **`decode.ts` `Shape` pattern** (or thin wrappers) into `apps/shared/validate/`:

```
shared/validate/
  json.ts       # parseJson
  guards.ts     # isRecord, isFiniteNumber, isString, field(obj, key, check)
  errors.ts     # ParseError with path (optional)
```

Refactor in order (one commit each, no behavior change):

1. `shared/layout/schema.ts` — `parseMapLayout(data: unknown)` uses guards (deletes duplicate `as { x?: unknown }` blocks).
2. `projectStore.ts` — `parseProject` / `parseBundle` / stroke parsers use same guards.
3. `decode.ts` — optionally delegate field checks to shared guards (keep replay-specific `Shape` tables local).

After consolidation, enable **`@typescript-eslint/no-unsafe-*`** trio if lint stays green without eslint-disable spam.

#### H3 — Reduce assertion casts (optional, later)

- Enable `consistent-type-assertions` with exceptions only in `**/*.test.ts`.
- Replace `value as Record<string, unknown>` with `isRecord(value)` type guard.
- Prefer **`satisfies`** for const objects that must match an interface (settings defaults, fixture shapes).

#### H4 — Zod / Valibot (only if schemas explode)

USER-SETTINGS, strat planner, and PDF export may add many persisted shapes. Re-evaluate a schema library when **>3 new IDB/JSON schemas** land — not required for the current refactor.

#### What stays `unknown` forever (by design)

- Public parse APIs: `parseProject(raw: unknown)`, WASM JSON before `decodeReplay`.
- Type guard parameters: `function isPoint(v: unknown): v is LayoutPoint`.
- Test doubles: `as unknown as Worker`.

---

### Track D — ESLint / CI (optional, later)

- `max-lines` warn at 400 for `components/**`, 600 for `lib/**` (exclude `parser/`).
- `import/no-restricted-paths`: `lib/**` cannot import from `components/**`.
- Keep `react-hooks/refs` off; do not enable `exhaustive-deps` globally.
- **`curly: all`** is required (Track G), not optional.
- **`no-explicit-any`** is required (Track H1), not optional.

---

### Track E — Long-term (separate backlog, not this refactor)

From `docs/frontend-migration.md`:

- **WASM `compute_stats_until`** — shrink TS stats to formatting + HUD-only helpers; keep `parity.test.ts`.
- Not a substitute for Tracks A–C; do after split makes TS stats small.

---

## Part 4 — Implementation order

One commit per row where possible. Refactor-only commits must not change behavior (run existing tests).

| Phase | Commit focus | Est. |
|:---:|---|---|
| 0 | `apps/shared` scaffold + config (eslint curly, prettier, **no-explicit-any**) | small |
| 0b | ESLint `--fix` braces — web `lib/`, then web `components/`, then layouts | large (mechanical) |
| 0c | `parseJson` helper + `catch (err: unknown)` sweep | small |
| 1 | `lib/shared/download.ts` + adopt in export paths | small |
| 2 | `lib/parse/seriesMode.ts` + replace boolean chains | small |
| 3 | `lib/state/demoReset.ts` + adopt in playback/view | small |
| 4 | Split `stats.ts` → `scorecard.ts` + `format.ts` | medium |
| 5 | Split `stats.ts` → `liveScore.ts` + `hud.ts` | medium |
| 6 | Split `stats.ts` → `computeStats.ts` | medium |
| 7 | Extract `reviewPersistence` / history / import | medium |
| 8 | Extract note drag/list from `Notes.tsx` | medium |
| 9 | `staticMapPaint.ts` + RadarCanvas uses it | medium |
| 10 | `MapToolbar` prop bundles | small |
| 11 | Tests: groups, visibility, seriesMode, persistence | medium |
| 12 | ESLint max-lines (warn only) | small |
| 13 | Shared `radar/viewport.ts` — web + layouts adopt | medium |
| 14 | Shared `layout/schema.ts` — single `parseMapLayout` | medium |
| 14b | Shared `validate/guards.ts`; refactor `projectStore` parsers | medium |
| 15 | Shared CSS tokens + map-toolbar | medium |
| 16 | `usePanZoom` fragment (optional) | medium |
| 17 | Enable `no-unsafe-*` eslint rules (if green after H2) | small |

**Defer until feature todos land**

- User settings store (`USER-SETTINGS.md`) — replaces localStorage DRY helpers.
- Strat planner store — separate IDB store, not mixed into `ReviewProject`.
- PDF export — consumes `staticMapPaint` from phase 9.

---

## Part 5 — Anti-patterns to avoid during refactors

- Big-bang “move everything to context” — worsens testability.
- Splitting files without moving tests — coverage illusion.
- Changing stats formulas while splitting — two concerns in one commit.
- Extracting hooks that secretly call `useApp()`.
- Adding `any` or disabling strict for “just this refactor”.
- Replacing boundary `unknown` with `any` to make eslint quiet — add guards instead.
- Re-export maze — if `stats/index.ts` re-exports 40 symbols, importers still need grep; prefer stable subpaths (`@/lib/stats/scorecard`).
- Copy-pasting CSS or viewport math into layouts — import from `apps/shared` instead.
- Enabling `curly` without `--fix` pass in the same PR as logic changes — style commits stay separate.

---

## Part 6 — Definition of done (refactor track)

- No file in `components/` > ~400 lines except generated/vendor.
- `lib/stats/stats.ts` < ~200 lines (orchestration + re-exports only).
- Series aggregated/bucket mode: single `seriesMode.ts` source of truth.
- `useReviewProject` < ~200 lines; persistence testable without React.
- `RadarCanvas` stroke/map paint delegates to `staticMapPaint` (unblocks strat + PDF).
- `lib/state` or extracted pure modules have ≥1 test file.
- All existing `npm test` + CI checks green after each commit.
- ESLint `curly: all` passes in **both** `apps/web` and `apps/layouts`.
- ESLint `@typescript-eslint/no-explicit-any` passes in both apps.
- `unknown` appears only on parse boundaries + type-guard params (not in feature logic).
- Layout JSON has **one** parser (`shared/layout/schema.ts` or web-owned export consumed by layouts).
- Radar viewport math has **one** implementation (`shared/radar/viewport.ts`).
- Toolbar/theme CSS not copy-pasted between apps (shared `@import`).

---

## Related todos

| Doc | Relationship |
|---|---|
| `USER-SETTINGS.md` | New settings store; migrate localStorage during that work |
| `STRAT-PLANNER.md` | Needs `staticMapPaint`, separate IDB store, splash mode; uses shared radar viewport |
| `PDF-EXPORT.md` | Needs `matchReport.ts`, `radarSnapshot` / `staticMapPaint` |
| `MULTI-DEMO-ANALYSIS.md` | Series modules stay; clarify with `seriesMode` + optional `series/README` comment block |
| `docs/frontend-migration.md` | Track E WASM stats — after TS split |
| **`apps/layouts`** | Callout editor; consumer of shared layout schema + radar CSS (this doc Track F) |

## One-line scope

**Tighten web + layouts layering: shared radar/layout/CSS, enforced brace style, typed parse boundaries — refactor for shape, not for a new framework.**
