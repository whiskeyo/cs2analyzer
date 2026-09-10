# React / TypeScript quality audit (`apps/web`)

**Date:** 2026-09-09  
**Scope:** Vite + React 19 + TypeScript viewer (`apps/web`). Parser/WASM coupling noted only where it produces odd web patterns.  
**Method:** File-size inventory, searches for `any` / casts / context / effects / DOM APIs, then read of the composition root, pages, canvas trio, notes/parse types, CSS, and ESLint caps.  
**This is not the product backlog.** `todos/PLAYBOOK.md`, `todos/USER-SETTINGS.md`, and `todos/PDF-EXPORT.md` stay product plans. They are mentioned only when a smell blocks them.

Effort key: **S** = one small PR; **M** = one focused PR with tests; **L** = cross-cutting, split if it approaches ~1000 lines.

---

## Executive summary

The web app is **not** “hacks stacked on hacks.” The domain layer (`lib/stats`, `lib/match`, `lib/replay`, `lib/parse/decode.ts`) is closer to production TypeScript than the React shell is to idiomatic production React.

**Health: B- / mid-maturity.** Layout conventions in `AGENTS.md` are mostly followed (pages vs `components/` vs `lib/<feature>/`; no `Foo.tsx` beside a `foo/` folder; no class components; no production `any`). Pure logic is extracted and usually tested. The debt is concentrated in a few clusters:

1. **Two note documents at once** (`Stroke[]` on the analyzer canvas vs `Note` on playbook) plus matching dual group APIs and on-disk shims.
2. **One god context** (`useApp` / `AppState`) mounted on every route, with effect-driven sync between radar selection and series `playerKey`.
3. **Kitchen-sink surfaces** (`Header`, `Playbook` page, `useReviewProject`) that own too many lifecycles.
4. **A CSS monolith** (`index.css` ~3500 lines, ~400 hardcoded hex colors) while `tokens.css` only holds page type scale.

The canvas/rAF/ref style is **intentional**, documented in ESLint (`react-hooks/refs` and `react-hooks/immutability` off), and should stay. The path to “real React” is not a rewrite: finish the Note model, split analyzer state off the FAQ/Playbook tree, and stop syncing two selection sources with effects.

Largest TSX files sit just under the repo’s own `max-lines` warn (400 for components): `Header.tsx` (~405, already over), `RadarCanvas.tsx` (~400), `Controls.tsx` (~382), `LayoutsApp.tsx` (~380), `Playbook.tsx` (~368). The 500+ line files are **lib** modules (`projectStore.ts` ~597, `radarFrame.ts` ~596, `paintRadarFrame.ts` ~586, `execute.ts` ~532) — domain density, not JSX gods. Business logic is **not** generally trapped in JSX; it is trapped in **dual models and a single context facade**.

---

## What is already healthy (do not “fix”)

- **Pages are thin routers.** `Analyzer.tsx` is a four-line switch. FAQ is static markdown. Playbook does **not** call `useApp()`.
- **Leaf radar widgets stay prop-driven.** `RadarStage.tsx` says this out loud; `RadarCanvas` / `Controls` / `Hud` can render without the provider.
- **Hook composition under `appState.tsx` is real.** Session, playback, review, view, and habits are separate hooks with explicit arguments — the comment about `docs/frontend-migration.md` matches the code.
- **WASM boundary is disciplined.** `decode.ts` exists so a serde rename fails on drop instead of a blank radar. `validate/json.ts` refuses to leak `JSON.parse` as `any`.
- **Test culture is strong** for an indie viewer: co-located tests on stats, paint, pointer, decode, notes persist, playbook merge, series overlay. The `as unknown as ReturnType<typeof useApp>` pattern in tests is a smell of the god context, not missing tests.
- **No class components, no `@ts-ignore`, no production `: any`.**
- **Playbook isolation is the right product cut** (local `usePlaybooks` + IndexedDB; snapshot is a one-way copy). Keep that.

---

## P0 — correctness / maintainability fires

### P0-1. Dual note document: `Stroke[]` and `Note` kept in sync

**Files / symbols:** `lib/notes/types.ts` (`Stroke`, `Note`, `RoundNote`); `lib/notes/groups.ts` vs `lib/notes/noteGroups.ts`; `lib/notes/index.ts` (aliases `nextGroupId as nextNoteGroupId`); `lib/notes/migrate.ts`; `lib/notes/projectStore.ts` `parseProject`; `lib/notes/useReviewProject.ts` (`strokes` / `commitStrokes`); `lib/notes/noteParse.ts` (`drawings` **or** `loose`); `components/radar/RadarCanvas.tsx`; `pages/Playbook.tsx` (`page.note`).

**What’s wrong:** Analyzer still treats a drawing as a flat `Stroke` that *points at* a round (`round`, `start_tick`, `group`). Playbook already owns a `Note` (groups + drawings + pieces). `ReviewProject` stores **both** `notes` and `strokes`. Load path accepts old flat `strokes[]` or new `notes[]` and converts (`parseProject` lines 237–254). Two nearly identical `groupSerial` / `nextGroupId` implementations exist.

`types.ts` already says the quiet part: *“Flat Analyzer stroke. … prefer `Note` for new code. Kept so schema ≤2 JSON and the current canvas/sidebar can migrate in place.”*

**Why it hurts:** Every notes feature is implemented twice or flattened through `migrate.ts`. Sidebar list (`list.ts` / `groups.ts`) and playbook (`noteGroups.ts`) drift. This is the prerequisite in `todos/PLAYBOOK.md` (“Round / strat owns a Note”) — the Playbook **UI shipped anyway**, so the dual model is now live debt, not a gate.

**Recommended refactor:** One canonical in-memory model: `Round → Note` (analyzer) and `Page → Note` (playbook). On load, migrate `strokes[]` once into `notes[]` and stop writing the flat array. Point `RadarCanvas` / Notes sidebar at `Note` (reuse playbook drawing helpers). Delete `groups.ts` stroke API after the canvas/sidebar cut over. Keep `migrate.ts` as import-only.

**Effort:** L (split: (a) persist/read only `notes[]`, (b) canvas+pointer on `Note`, (c) delete stroke list helpers).  
**Risk:** High if done as one PR — saved notes in IndexedDB / export JSON. Mitigate with a schema bump and a one-way load migrator; pre-release banner already warns notes may break.

---

### P0-2. Two player-selection sources synced by a large effect

**Files / symbols:** `lib/state/usePlayerSync.ts` (`usePlayerSync`, `lastRef`); `lib/state/viewState.ts` (`selected` / `select` / `setSelected`); `lib/state/useSeriesHabits.ts` (`filter.playerKey` vs exported `playerKey`); `lib/state/appState.tsx` (wires both into the effect).

**What’s wrong:** Radar/scoreboard selection (`view.selected`: player **index**) and series habits filter (`habits.playerKey`: Steam/name **key**) are independent React state. `usePlayerSync` (~90-line `useEffect`) diffs a snapshot and calls `select` / `setPlayerKey` / `setFocalTeam` in both directions. `playerKey` is also a **derived** projection of `filter.playerKey` (invalid keys silently become `null`). `select` turns follow off on deselect; `setSelected` does not — and hotkeys use `view.setSelected` (`appState.tsx` line 136 → `useHotkeys`).

**Why it hurts:** Classic “two sources of truth + effect” bug farm. Ordering vs demo switch (`useResetOnDemoChange`) and series hops is hard. Tests exist (`usePlayerSync.test.tsx`) because the behavior is already subtle. Esc/deselect can leave `follow === true` if it goes through `setSelected`.

**Recommended refactor:** One store for “who is tracked.” In multi-demo mode, `selected` is derived from `playerKey` + current replay (`playerIndexForKey`). In single-demo mode, `playerKey` is unused. Delete most of `usePlayerSync`. Export only `select` (hide `setSelected` from the public `ViewState`, or make `setSelected` call the same path).

**Effort:** M  
**Risk:** Medium — series player filter, focal-team flip, demo hop. Keep the existing `usePlayerSync` tests and invert them to assert the new single source.

---

### P0-3. `useReviewProject` is a lifecycle state machine hidden in six effects

**Files / symbols:** `lib/notes/useReviewProject.ts` (`useLayoutEffect` clear, restore `useEffect`, debounce persist, `beforeunload`, series-cache flush, seed-stats); `lib/notes/seriesReviewCache.ts` (module `Map`); `lib/notes/reviewPersistence.ts`; `lib/parse/useDemoSession.ts` (`onBeforeSelectDemo` → `stashForSeriesSwitch`).

**What’s wrong:** The hook owns drawings, undo, palette, floor, saved-project list, IDB load/save, series-switch stash, and “restored → autoplay” policy. Restore vs persist is gated by `restoredRef` and `prevDemoIdRef`. Cleanup of the restore effect persists the *outgoing* demo only when `!inSeries`. `stashForSeriesSwitch` is assigned onto a ref **during render** in `appState.tsx` (lines 62–63) so the session hook can call it before swapping files.

**Why it hurts:** This is the easiest place to lose drawings or double-save. A follow-up that “just adds a setting” will touch the wrong effect. The module-level series cache is React state that lives outside the tree.

**Recommended refactor:** Extract a pure `reviewLifecycle` reducer / functions: `{ type: "demo-enter" | "demo-leave" | "series-stash" | "series-restore" | "persist" }`. Hook becomes: subscribe to `demo.id`, call those functions, set state. Move `seriesReviewCache` behind the same module (or a `WeakMap` keyed by demo id) so tests drive transitions without mounting six effects.

**Effort:** M–L  
**Risk:** High for persist bugs. Do **not** combine with P0-1 in the same PR. Existing `useReviewProject.test.tsx` must stay green and gain series-hop-mid-debounce cases.

---

### P0-4. `decode.ts` does not enforce fields TypeScript calls required

**Files / symbols:** `lib/parse/decode.ts` (`ROUND`, `BOMB_EVENT`, comment at lines 39–42); `lib/replay/replayTypes.ts` (`Round.is_knife`, `BombEvent.z`).

**What’s wrong:** `Round.is_knife` is required in TS (`replayTypes.ts` line 54) and is a documented domain rule (FACEIT knife / 0–0 reset). `decode.ts` `ROUND` shape never checks `is_knife`. `BombEvent.z` is required in TS; `BOMB_EVENT` only checks `tick`, `kind`, `player`, `x`, `y`. The file comment says `#[serde(default)]` fields are left out on purpose — these two are **not** optional in the TS types.

**Why it hurts:** The whole point of `decode.ts` is that a Rust rename fails on drop with a named error. Today a missing `is_knife` becomes `undefined`, typecheck stays green, knife-round playback/start can silently misbehave. Same for bomb `z`.

**Recommended refactor:** Add `is_knife: flag` to `ROUND` and `z: number` to `BOMB_EVENT`. Extend `decode.test.ts`. After that, only omit fields that are **optional** in `replayTypes.ts` (`playback_end_tick`, `team_ct` / `team_t`, `GrenadeThrow.fires`, `haskit`, `site`). Do not add `#[serde(default)]` shims on the web side — AGENTS.md prefers a clean break while pre-release.

**Effort:** S  
**Risk:** Low. First drop after a WASM rebuild that omitted the field will error loudly (desired).

---

## P1 — structure (what makes it feel unlike production React)

### P1-1. `AppState` is a god facade mounted on every route

**Files / symbols:** `lib/state/appState.tsx` (`AppState`, `useAppState`, `AppStateProvider`, `useApp`); `components/app/App.tsx` (`App` wraps all pages); `pages/Playbook.tsx` / `pages/Faq.tsx` (never call `useApp`).

**What’s wrong:** The provider value is a new object every render (`onFiles` is an inline closure, not `useCallback`; no `useMemo` on the value). One hook returns session + playback + review + view + habits + cal + places. FAQ and Playbook still **construct** the full analyzer graph (worker session, playback, review persist, hotkeys, habits) because the provider sits above the router.

**Why it hurts:** Any tick/habits update can re-render every `useApp()` subscriber (`Header`, `SeriesBar`, `Sidebar`, `RadarStage`, …). Tests mock the entire `ReturnType<typeof useApp>` with `as unknown as`. Playbook/FAQ pay for analyzer subscriptions they do not read. The **hooks** are compositional; the **React boundary** is a god object.

**Recommended refactor:**

1. Stabilize: `useCallback(onFiles)` + `useMemo` value (S, limited win).
2. Split contexts: `SessionProvider` (status + session + `onFiles`) at root so Home drop still works; `AnalyzerProvider` (playback, review, view, habits, cal, places) **only** when `session.replay != null` or under `/analyzer`.
3. Add `useSession()` / `usePlayback()` / `useReview()` instead of one `useApp()`.

Do **not** add `use-context-selector` unless tick-driven `Header` re-renders show up in a profile after the split.

**Effort:** M  
**Risk:** Medium — Home drop → navigate to Analyzer must keep the same session instance. Mount `AnalyzerProvider` inside `Analyzer` **or** lift session only.

---

### P1-2. Sidebar is both context consumer and prop dump

**Files / symbols:** `components/app/Viewer.tsx` (nine props into `Sidebar`); `components/sidebar/Sidebar.tsx` (`useApp()` again; `view?.setFollow`).

**What’s wrong:** `Viewer` drills `replay`, `tick`, `strokes`, `selected`, `onSelect`, `onJump`, `onStrokes`, `places`, `activeRound`. `Sidebar` then reads `session`, `habits`, `view` from context. `view?.` optional-chains a field that `useApp()` already guarantees.

**Why it hurts:** Unclear ownership. Adding a tab means guessing which bag to extend. The `?.` teaches the next reader that `view` might be missing.

**Recommended refactor:** Pick one. Preferred: Sidebar reads analyzer slices from split hooks (after P1-1) and **stops** taking the nine props. Alternative: keep Sidebar presentational and pass a `sidebarModel` object built once in `Viewer`. Delete `view?.`.

**Effort:** S–M  
**Risk:** Low.

---

### P1-3. `Viewer` owns aggregated-bucket transport (rAF in a layout component)

**Files / symbols:** `components/app/Viewer.tsx` lines 21–59; `lib/state/useSeriesHabits.ts` (`bucketPlaySec` + `bucketPlaySecRef`); `lib/state/appState.tsx` line 104 (`bucketTransportRef.current = …` **during render**); `lib/playback/usePlayback.ts`.

**What’s wrong:** When habits overlay is in bucket mode, `Viewer` runs a `requestAnimationFrame` loop that mutates `habits.bucketPlaySecRef` and periodically `setBucketPlaySec`. Playback’s play/pause is reused, but the clock is a second playhead. `bucketTransportRef` is written in render so `usePlayback` can skip demo-tick transport.

**Why it hurts:** Layout components should not own transport. Two playheads (`playback.tick` vs `bucketPlaySec`) already exist; hiding the second one in `Viewer` makes the next overlay feature land in JSX again.

**Recommended refactor:** Move the bucket rAF into `useSeriesHabits` or a `useBucketTransport(playback, habits)` hook next to `usePlayback`. Write `bucketTransportRef` in `useEffect`/`useLayoutEffect`, not during render.

**Effort:** S  
**Risk:** Medium — pause-at-window-end and 100ms UI throttle must stay. `Viewer.test.tsx` already covers some of this.

---

### P1-4. `Header` is the settings app, import/export, and chrome

**Files / symbols:** `components/app/Header.tsx` (~405 lines; over the component `max-lines` warn of 400); `lib/playbook/events.ts` (`PLAYBOOKS_CHANGED_EVENT` on `window`).

**What’s wrong:** One component: brand, `SiteNav`, match file meta, New demo, Export CSV, gear menu (notes import/export/wipe **and** playbook import/export/wipe), confirm dialogs, merge dialog, `document` click-outside, playbook count via window event. This is also where `todos/USER-SETTINGS.md` will want to grow.

**Why it hurts:** Header re-renders with `useApp()` on every analyzer tick-ish update. Settings work will keep inflating a file that is already over the lint cap. Playbook list freshness is a DOM event instead of a store subscription.

**Recommended refactor:** `Header` = brand + nav + match chrome + gear trigger. `SettingsMenu` (and later a settings modal from `USER-SETTINGS.md`) owns import/export. Playbook count: pass a callback from `usePlaybooks` **or** a tiny `useSyncExternalStore` over the IDB/module store — keep the window event only as the notify mechanism inside that store.

**Effort:** M  
**Risk:** Low.

---

### P1-5. `Playbook` page is a local god (but a good one)

**Files / symbols:** `pages/Playbook.tsx` (~368 lines, ~10 `useState`s, four `useEffect`s including a 50-line keydown handler); `lib/playbook/usePlaybooks.ts`; `lib/playbook/history.ts` (`useNoteHistory`, no dedicated test).

**What’s wrong:** The page owns map load, tool, nade trail/style, selection, tree collapse, panel widths, focus handoff from Analyzer (`sessionStorage` via `consumePlaybookFocus`), undo keybindings, and all wiring to tree/canvas/palette. This is **better** than stuffing it into `useApp`, but it is still a page-level orchestrator.

**Why it hurts:** Hard to test without mounting the whole page (page tests exist but stay shallow). Hotkeys live in the page while Analyzer hotkeys live in `lib/playback`.

**Recommended refactor:** `usePlaybookBoard({ mapName })` for tool/selection/viewEpoch/nade + keybindings (mirror `useLayoutHotkeys`). Keep the page as layout. Do **not** invent a Playbook context until a third consumer appears (YAGNI).

**Effort:** M  
**Risk:** Low.

---

### P1-6. Incomplete demo-change reset

**Files / symbols:** `lib/state/viewState.ts` `useResetOnDemoChange` (lines 21–25).

**What’s wrong:** Comment says view state “Resets whenever a different demo is loaded.” Implementation only clears `selected`, `follow`, and `layers`. Leaves `trails`, `moment`, `tool`, `viewEpoch`.

**Why it hurts:** New demo can open with eraser/text still armed, trails/moment still on. Habits have **no** demo reset (filters persist) — that may be intentional for series, but it is undocumented.

**Recommended refactor:** Reset `trails`, `moment`, `tool` (and optionally bump `viewEpoch`) in the same callback. Document habits persistence: “filters survive demo hops inside a series; they reset when `series` identity changes.”

**Effort:** S  
**Risk:** Low. Add a `viewState` test for the reset list.

---

### P1-7. Two `loadCalibrations` / two `MapCalibration` types

**Files / symbols:** `lib/radar/maps.ts` (cached, `publicUrl`, `as Record<string, MapCalibration>`); `lib/layouts/maps.ts` (uncached, raw `/maps/`, same cast); `lib/layouts/types.ts` (`MapCalibration` without `floors`); `lib/replay/replayTypes.ts` (full type).

**What’s wrong:** Same name, different cache and URL helpers. Layouts type is a subset. Both skip runtime validation (unlike `decode.ts` / `parseMapLayout`).

**Why it hurts:** Layouts editor and Playbook/Analyzer can disagree after a calibrations.json change. Uncached layouts fetch repeats work. A bad JSON file is a silent `as` success.

**Recommended refactor:** One `loadCalibrations()` in `lib/radar/maps.ts` (already cached). Layouts imports it. Validate with the existing `guards` helpers (required numeric `pos_x` / `pos_y` / `scale`, string `radar`). Delete `lib/layouts`’s copy and the slim type (or `Pick` the replay type).

**Effort:** S  
**Risk:** Low. DEV layouts editor only for the deleted path.

---

### P1-8. `lib/layout` vs `lib/layouts` vs `lib/radar/layouts`

**Files / symbols:** `lib/layout/` (schema/types for callout JSON); `lib/layouts/` (DEV editor); `lib/radar/layouts.ts` (viewer fetch of `public/layouts/{map}.json`).

**What’s wrong:** Three “layout” words. The split is purposeful (shared schema vs DEV app vs viewer load) but the names lie to newcomers.

**Why it hurts:** Agents and humans put editor mutations in the schema package or vice versa.

**Recommended refactor:** Rename is optional and noisy. Prefer **comments + AGENTS.md table** (already started) over a mass rename. If renaming: `lib/mapLayout` (schema), `lib/layoutEditor` (DEV), keep `lib/radar/layouts.ts` as the viewer loader.

**Effort:** S (docs) or M (rename).  
**Risk:** Low / medium if rename without import map.

---

### P1-9. RadarCanvas mirrors 22 props into refs

**Files / symbols:** `components/radar/RadarCanvas.tsx` lines 100–~160 (`replayRef` … `onHabitsJumpRef`).

**What’s wrong:** ESLint refs-off is justified for rAF. The implementation is a wall of `fooRef.current = foo`. Playbook/Layouts canvases do the same with ~8–10 refs.

**Why it hurts:** Easy to add a prop and forget the ref — stale closure in the paint loop (the class of bug the ref pattern exists to prevent, ironically).

**Recommended refactor:** `const propsRef = useRef(props); propsRef.current = props;` (or a typed `RadarFrameInput` object built in `RadarStage`). Pointer hook reads `propsRef.current.tool`. No behavior change.

**Effort:** S  
**Risk:** Low if tests (`RadarCanvas` / `useRadarPointer`) stay green.

---

### P1-10. Toolbar / icon SVG copied three times

**Files / symbols:** `components/radar/MapToolbar.tsx` (`Icon`, `IconBtn`, `I.*` paths); `components/playbook/TokenPalette.tsx` (`ToolGlyph`, `TOOL_PATHS`); `components/layouts/LayoutToolbar.tsx` (local `Icon` / `IconBtn`); shared `styles/map-toolbar.css` + `components/notes/ColorPalette.tsx`.

**What’s wrong:** Pan/pen/arrow/eraser/undo/redo/reset path `d` strings and button chrome are triplicated. CSS is already shared. Feature sets correctly **diverge** (replay layers vs tokens vs shapes).

**Why it hurts:** Tool-order tweaks (already happening per recent commits) get applied to one toolbar and missed on another.

**Recommended refactor:** `components/map/ToolbarIcon.tsx` + `toolbarPaths.ts` for shared glyphs. Keep three toolbar **compositions**. Do **not** unify pointer hooks or paint pipelines (YAGNI — different coordinate spaces and commit paths).

**Effort:** S  
**Risk:** Low.

---

### P1-11. Custom history routing is fine; the name “app” is not

**Files / symbols:** `lib/app/devNavigate.ts` (`navigate`, `usePathname`); `components/app/App.tsx` (`fillBoard ? "app" : "app splash"`); no `react-router` in `package.json` (intentional).

**What’s wrong:** Four routes do not need React Router (YAGNI). “App state” and CSS class `app` / `splash` mean “analyzer chrome vs marketing column,” not application lifecycle. `docs/frontend-migration.md` still says “Today that state lives in `App.tsx`” — it now lives in `appState.tsx`.

**Why it hurts:** Follow-up agents look for a Shell / router store that does not exist.

**Recommended refactor:** Leave the history helper. Rename CSS when tokens are done (`app-shell` / `app-page`). Update the one sentence in `frontend-migration.md` if you touch that doc. Do not add React Router unless nested layouts appear.

**Effort:** S  
**Risk:** None.

---

### P1-12. Module singletons that leak across tests / features

**Files / symbols:** `lib/playback/playbackCommands.ts` (`let sink`); `lib/notes/seriesReviewCache.ts`; `lib/stats/computeStats.ts` / `lib/stats/liveScore.ts` (tick caches — documented); `lib/radar/layouts.ts` + `lib/radar/maps.ts` (fetch caches); `lib/playbook/events.ts` + `lib/playbook/focus.ts` (`sessionStorage`).

**What’s wrong:** Playback commands are a process-wide mutable sink. Series review cache is a process-wide `Map`. Stats caches are keyed by replay identity (tests already warn: mutate replay identity to recompute).

**Why it hurts:** Two providers in tests, or StrictMode + leftover sink, can route hotkeys to a dead callback. Analyzer → Playbook focus is invisible React state.

**Recommended refactor:** Instantiating the sink **inside** `AppStateProvider` (or `AnalyzerProvider`) and passing it down is enough. Keep stats/layout caches — they are memoization, not app state. Document `consumePlaybookFocus` next to the Snapshot button.

**Effort:** S  
**Risk:** Low.

---

### P1-13. `index.css` is the design system

**Files / symbols:** `src/index.css` (~3495 lines, ~405 hex literals); `styles/tokens.css` (fonts + `--page-*` only; global `button:hover` filter); `styles/layouts-editor.css` (~405 lines, repeats `#1c242e` / `#2c3846` / `#6aa4d8`); `styles/map-toolbar.css` (good extract).

**What’s wrong:** Almost every surface is one stylesheet. Tokens do not include background/border/accent. Layouts editor re-declares the same chrome colors.

**Why it hurts:** Visual tweaks are grep-the-hex. Dark-theme consistency is tribal knowledge. `USER-SETTINGS.md` appearance prefs have nowhere clean to bind.

**Recommended refactor:** Expand `tokens.css` (`--bg`, `--bg-panel`, `--border`, `--accent`, `--text`, `--text-muted`, `--danger`). Replace repeated hex in `index.css` / layouts editor in **one mechanical PR** (no behavior). Split `index.css` by surface only if a file still hurts after tokens (`header.css`, `sidebar.css`, `playbook.css`).

**Effort:** M  
**Risk:** Low (visual). Verify Analyzer + Playbook + FAQ + Home in a browser; no WASM rebuild.

---

### P1-14. Preference scatter (already a product todo)

**Files / symbols:** `lib/shared/sidebarWidth.ts`; `lib/parse/seriesOverlay.ts` `loadSeriesTrailWindowSec` / `SERIES_HABITS_WINDOW_STORAGE_KEY`; `lib/match/roundEvents.ts` (scrub lead-in); hardcoded defaults in `viewState` / `usePlayback`.

**What’s wrong:** `todos/USER-SETTINGS.md` already maps this. `seriesOverlay.ts` still reads a “legacy manual setting” from `localStorage` even if the UI control is gone.

**Why it hurts:** Quality issue only because it produces effect/localStorage sync in feature modules.

**Recommended refactor:** Do **not** start a settings rewrite in a quality PR. Either delete the unused trail-window storage key or wire it in the settings PR. Point the settings agent at this audit’s P1-4 (Header extraction) as a prerequisite.

**Effort:** S (delete dead key) or see `USER-SETTINGS.md`.  
**Risk:** Low / product.

---

## P2 — polish

### P2-1. Names that lie

| Symbol | Where | Honest name / fix |
|---|---|---|
| `ReviewStore` | `useReviewProject.ts` | Hook return type; not a store. `ReviewSession` or `useReviewProject` return only. |
| `useApp` / `AppState` | `appState.tsx` | Analyzer session graph. After split: `useSession` / `useAnalyzer`. |
| `splash` | `App.tsx` / `index.css` | Marketing/FAQ column layout, not a splash screen. |
| `TransportButtonish` | `playback/TransportButtonish.tsx` | `UnfocusableButton` or fold into `TransportButton`. |
| `aggregated` | `useSeriesHabits.ts` | Fine — derived from `seriesView`. Keep. |
| `parseDemo` | `useDemoSession.ts` | Starts a worker parse. Fine if callers know. |
| `MapCalibration` (layouts) | `lib/layouts/types.ts` | Subset type; delete after P1-7. |
| `nextGroupId` × 3 | notes strokes, notes Note, layouts | Keep domain prefixes (`nextNoteGroupId` is already an alias — make it the only export). |
| `view?.setFollow` | `Sidebar.tsx` | `view` is required. |

**Effort:** S (rename PRs, one name each). **Risk:** Low.

---

### P2-2. Small duplicated helpers

| Dup | Files |
|---|---|
| `darkenHexColor` | `lib/radar/draw.ts`, `lib/radar/paintRadarFrame.ts` |
| `circle()` canvas helper | `paintRadarFrame.ts`, `lib/playbook/paint.ts` |
| `typingInField` | `lib/playbook/hotkeys.ts`, `lib/layouts/useLayoutHotkeys.ts` |
| rAF + DPR resize loop | `RadarCanvas`, `PlaybookCanvas`, `LayoutCanvas` (~25 lines each) |
| wrap-local `pos()` | three pointer hooks |
| `hitStroke` vs `hitDrawing` | `draw.ts` vs `lib/playbook/drawings.ts` |
| `GroupNameField` | `components/layouts/` vs `components/sidebar/notes/` (same edit/blur machine, different commit) |

**Recommended:** Shared `useCanvasLoop`, `wrapLocalPoint`, one `darkenHexColor`, one `typingInField` in `lib/shared`. Extract `useEditableName` for the two GroupName fields. **Do not** unify the three pointer hooks.

Radar wheel zoom still does **not** use `zoomViewAtCursor` (`lib/radar/panZoom.ts`) — Playbook and Layouts do. Aligning Analyzer zoom is a **behavior** change; treat as its own PR, not a drive-by.

**Effort:** S each. **Risk:** Low except cursor-anchored zoom (radar feel).

---

### P2-3. Production `as` casts that skip guards

Not test doubles — those are fine.

| Location | Issue |
|---|---|
| `lib/radar/maps.ts` / `lib/layouts/maps.ts` | `res.json() as Record<string, MapCalibration>` — see P1-7 |
| `lib/replay/eventIndex.ts` | `cached as T[]` on a `WeakMap<unknown[]>` |
| `lib/parse/seriesOverlay.ts` | `kind as HabitsNadeKind` |
| `lib/playbook/nadeTrail.ts` | `tool as Piece["kind"]` |
| `lib/notes/groups.ts`, `noteGroups.ts`, `visibility.ts` | `start_tick as number` after a filter TS cannot see |
| `lib/playback/playbackKeys.ts` | `target as HTMLInputElement` without `instanceof` |
| `components/app/Header.tsx` | `e.target as Node` — use `instanceof Node` |
| `components/layouts/LayoutCanvas.tsx` | `view.current as RadarView` |

**Effort:** S. **Risk:** Low. Prefer type predicates already in `lib/validate/guards.ts`.

---

### P2-4. Test gaps on smelly modules

Covered well: `decode`, `paintRadarFrame`, `radarFrame`, `useRadarPointer`, `seriesOverlay`, `projectStore`, `useReviewProject`, `usePlayerSync`, `usePlayback`, most playbook parse/merge.

Thin or missing:

| Module | Why it matters |
|---|---|
| `lib/parse/roundTags.ts` | Buy buckets drive series habits; only exercised indirectly |
| `lib/shared/usePanelResize.ts` | `querySelector` + pointer capture; used by Sidebar, Playbook, Layouts |
| `lib/playbook/history.ts` | Undo stack for playbook notes |
| `components/layouts/CalloutClusterList.tsx` (~349 lines) | Complex DnD, no co-located test |
| `components/playbook/PlaybookTreeMenu.tsx` | Outside-click menu |
| `viewState` reset list | After P1-6 |

Do not chase coverage %; add tests when the module is next touched.

**Effort:** S per file. **Risk:** None.

---

### P2-5. `decodeList` only checks the first element

**Files:** `lib/parse/decode.ts` lines 169–180 (documented: walking 100k kills on drop is too expensive).

**Leave the tradeoff**, but know it: a rename that only appears on later events will not fail at decode. Optional follow-up: check first + last, or a stride sample. Not a shim.

**Effort:** S. **Risk:** Low (decode cost).

---

### P2-6. `react-hooks/immutability` is off globally

**Files:** `apps/web/eslint.config.js` lines 27–30.

Refs-off is justified for canvas/playback. Immutability-off is broader and can hide real state mutations in Sidebar/Playbook. After P1-9, consider turning `immutability` back on for `src/components/**` except `radar/**`, `playbook/PlaybookCanvas.tsx`, `layouts/LayoutCanvas.tsx`.

**Effort:** S. **Risk:** Medium (lint fire drill). Own PR.

---

### P2-7. Over-abstraction that is **not** needed

Do **not**:

- Introduce Redux / Zustand / a generic “map editor framework.”
- Add React Router for four paths.
- Unify Analyzer / Playbook / Layouts pointer into one configurable hook.
- Call WASM for live stats in this quality track (`docs/frontend-migration.md` option D is a **product/perf** project, not a React cleanup).
- Invent cloud/backend features.

The codebase’s main abstraction problem is **duplicated models**, not missing frameworks.

---

## Phased roadmap (one phase = one later PR)

Do these in order so each PR lands on a simpler tree. Cap ~1000 lines; P0-1 is several PRs.

| Phase | Goal | Includes | Depends on |
|---|---|---|---|
| **1** | Type contract honesty | P0-4 decode `is_knife` / `BombEvent.z`; optional first+last list check (P2-5) | — |
| **2** | Canonical `Note` | P0-1 persist `notes[]` only; migrate on read; stop writing `strokes[]` | Phase 1 if decode/types move |
| **3** | Analyzer canvas on `Note` | Pointer + Notes sidebar + flatten helpers deleted | Phase 2 |
| **4** | Analyzer state boundary | P1-1 split/lazy providers; stabilize context; P1-12 sink per provider | — (parallel to 2–3) |
| **5** | One selection | P0-2 delete `usePlayerSync`; hide `setSelected`; P1-6 complete view reset | Phase 4 preferred |
| **6** | Shell extraction | P1-2 Sidebar one strategy; P1-3 bucket transport hook; P1-4 Header/settings split | Phase 4 |
| **7** | Playbook page hook | P1-5 `usePlaybookBoard` | — (parallel) |
| **8** | Shared map chrome | P1-7 calibrations; P1-9 `propsRef`; P1-10 toolbar icons; P2-2 loop/helpers | — (parallel, mechanical) |
| **9** | CSS tokens | P1-13 | — |
| **10** | Settings product | `todos/USER-SETTINGS.md` + delete dead habits window key (P1-14) | Phase 6 (Header) |
| **11** | Lint/tests polish | P2-3 casts, P2-4 tests, P2-6 re-enable immutability where safe | After 8 |

**What “real React” looks like after this:** FAQ/Playbook do not construct playback. Analyzer has session → analyzer providers. Notes are `Note` everywhere. Selection is one field. Header is chrome. Canvas still uses refs/rAF. CSS uses tokens. Follow-up agents implement **one phase per PR**.

---

## Leave alone

| Area | Why |
|---|---|
| `apps/web/src/parser/**` | Generated WASM bindgen. Never hand-edit. Commit only with the parser change that produced it. |
| Canvas rAF + prop refs | Hot path is Canvas2D, not VDOM. ESLint `react-hooks/refs` off is correct for playback/canvas. |
| `lib/playback/usePlayback.ts` `tick` + `tickRef` | Documented split so rAF does not re-render React at 64 Hz. |
| FACEIT / CS2 constants | `lib/shared/constants.ts` ↔ `crates/cs2analyzer/src/constants.rs`. Do not “simplify.” |
| TS `computeStats` mirroring `analysis.rs` | Intentional: WASM does not ship `Match::stats`. Change formulas in **both** places with tests. Not a React smell. |
| `decode.ts` as a concept | Keep the validator. Tighten it (P0-4); do not replace with `as Replay`. |
| `#[serde(default)]` omitted from decode | Correct while pre-release. Do not add compatibility shims for stale WASM caches. |
| SoA tick buffers / `FLAG_*` | Index = `frame * playerCount + player`. Do not wrap in objects per pawn per frame. |
| Yaw / `currentRound` / knife / ADR / trades / OT score rules | Domain rules in `AGENTS.md`. Wrong “cleanup” here is a product bug. |
| Vendored `public/maps`, `public/weapons` | Valve/community assets. |
| DEV layouts editor (`/layouts`) | Not shipped. Duplicate paint/pointer vs Analyzer is OK; only share dumb atoms (P1-10, P1-7). |
| No React Router | Four routes. `devNavigate.ts` is enough. |
| `mimalloc` off / wasm-bindgen **0.2.127** | Toolchain, not UI architecture. |
| Playbook not reading `useApp` | Correct isolation. Snapshot is the bridge. |
| `docs/frontend-migration.md` rewrite-to-Leptos | Background only. This audit assumes React stays. |

---

## Coupling notes (WASM / Rust) that create web patterns

- **Hand-mirrored types:** `replayTypes.ts` ↔ `crates/cs2analyzer/src/types.rs`. `decode.ts` is the runtime link. Drift = P0-4.
- **Live stats in TS:** Viewer must recompute through the current tick. Module caches in `computeStats` / `liveTeams` exist because `tick` updates often — that is why a god `useApp()` is expensive (P1-1), not a reason to move stats into React state.
- **Worker + transferables:** `useDemoSession` / `parseWorker` / `parsePool` are in good shape. Do not fold parse onto the UI thread to “simplify hooks.”
- **Optional Rust fields:** `Round.team_ct` / `playback_end_tick` / `GrenadeThrow.fires` being optional in TS is current reality, not a shim to keep forever. When the parser always sends them, make them required and add them to `PAYLOAD_SHAPES`.

---

## Out of scope (do not invent)

- Accounts, cloud sync, multiplayer playbooks, backend APIs.
- PDF export (`todos/PDF-EXPORT.md`).
- Replacing React with Leptos/Yew.
- A generic design-system package beyond CSS tokens + toolbar icons.

---

## How a follow-up agent should use this

1. Pick **one phase** from the roadmap. Do not mix P0-1 with provider splits.
2. Read the listed files before editing. Match local naming.
3. Add or extend the unit test on the side you touch.
4. Web PR: `cd apps/web && npm run format:check && npm run lint && npm run typecheck && npm test`.
5. Parser/decode-only: no WASM rebuild unless `types.rs` changed. If WASM types change: `./scripts/build-wasm.sh` and tell whiskeyo to **re-drop the demo**.
6. UI behavior changes: click through Analyzer + the other route that shares the state (Home drop, Playbook snapshot, FAQ nav). No browser tools → say what you could not click.

This pass is **doc-only**. No production code was changed.
