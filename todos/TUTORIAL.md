# Tutorial

Optional, in-app walkthrough of Analyzer then Playbook. Starts on demand, loads a **pre-parsed two-round Replay fixture** (no WASM wait), teaches with **coach marks / spotlight**, then snapshots into a **temporary playbook**. Completing or leaving the tour cleans that book up and records `tutorialCompleted` in the IndexedDB user-settings document from [#37](https://github.com/whiskeyo/cs2analyzer/pull/37).

This is a product plan. No tour UI, no fixture, no settings field in this change.

Locale / copy: see `todos/I18N.md` (separate track).

## Problem today

The viewer is a full FACEIT-style desk: radar, transport, seven sidebar tabs, drawing tools, snapshot, then a second surface at `/playbook`. Home is a drop zone plus a FAQ link. There is no guided path, and the first real step is “find a GOTV `.dem` and wait for WASM.”

| Gap | What happens |
|---|---|
| No sample match | New users cannot try the radar without their own file |
| Parse is the greeting | Worker + WASM is correct for real drops, wrong for “show me the app” |
| Dense chrome | Playback, HUD, Score / Review / Notes / Action / Util / Rounds / Weapons, MapToolbar |
| Second product | Playbook is a different page (tokens, tree, strat notes). Snapshot is the bridge; nobody is shown it |
| Settings exist, tour does not | IDB `settings` row is on master; `tutorialCompleted` is not a field yet. Preferences UI is still a follow-up |

FAQ explains *what* the app is. It does not walk someone through clicking Skip freeze, then Snapshot.

## Goals

- One **opt-in** tour: Analyzer tools on a dummy match, then Playbook tools on a snapshot of that match.
- Dummy match is a **checked-in Replay fixture** (two live rounds), hydrated in the main thread. Instant load. Real `.dem` drops still use the parse worker / WASM.
- Teach by **doing**: short spotlight copy on the live control, not a modal essay. User can actually play, scrub, draw, and snapshot.
- After Analyzer steps: prompt **Snapshot to playbook**. That write goes to an **ephemeral** book, not the user’s real list.
- Playbook half: same spotlight style, option-by-option on that temp strat (tokens, draw, tree, strat notes).
- End: delete the temp book, mark `tutorialCompleted`, return to Home (or Playbook empty if they prefer — open question).
- Entry from **Home** and **FAQ** in v1; **Replay tour** in Settings once that menu has a preferences section.

## Non-goals

- Do **not** auto-start the tour on every visit, first paint, or demo drop.
- Do **not** ship a megabyte (or real) `.dem` in v1. No `.demos/` in git. WASM stays off the tutorial path.
- Do **not** teach series / habits / multi-file, layouts editor, CSV export, or PDF.
- Do **not** persist tutorial drawings as a saved `ReviewProject`, or leave the temp playbook in export / “Remove all playbooks.”
- Do **not** replace the FAQ. Tour is a walkthrough; FAQ stays reference.
- Do **not** block a real drop: if the user drops a `.dem` mid-tour, abort the tour, clean the temp book, parse as usual. Do not set `tutorialCompleted` on abort-for-drop (they never finished).
- Do **not** implement i18n, a tour modal, or the fixture in the same PR as this doc.

## Product

### Entry points

| Where | What |
|---|---|
| **Home** | Secondary control next to the drop zone: **Try the tutorial** (or equivalent). Not a blocking modal. |
| **FAQ** | Short article or lead-paragraph link that starts the same flow (`/analyzer?tutorial=1` or a start helper). |
| **Settings** (later) | **Replay tour** — re-run even if `tutorialCompleted` is true. Gear menu today is notes/playbook import; wait for the Preferences slice. |

No first-visit popup. Optional later: a one-line Home hint when `tutorialCompleted` is false, dismissible without starting. That hint is polish, not v1.

Starting the tour navigates to Analyzer and injects the fixture. It does not parse, prefetch WASM, or touch the user’s saved notes.

### Flow

```
Start
  → hydrate fixture Replay (two rounds)
  → Analyzer tour (watch + navigation + tools)
  → prompt Snapshot
  → write ephemeral playbook page
  → /playbook on that page
  → Playbook tour (tokens, draw, tree, notes)
  → End: delete temp book, tutorialCompleted = true
```

Skip / Exit is always available. Skip Analyzer → still offer snapshot + Playbook half, or exit entirely (see open questions). Exit at any point: cleanup temp book if it exists; **do not** mark completed.

### Analyzer half

Fixture is a normal `Replay` as far as Viewer, stats, HUD, and sidebar are concerned. Playback starts at first freeze end (same as a real demo). Two rounds so the round strip, Skip freeze, and “watch a round then jump” are real.

Spotlight targets (v1, not every button):

1. Radar + T/CT dots (what you are looking at).
2. Play / pause / speed.
3. Round strip + Skip freeze.
4. Follow / select a player.
5. Score tab (ADR / KAST exist; do not lecture formulas).
6. Action (jump to a kill).
7. Utility (one nade).
8. Notes: pen or bookmark + Moment, then undo.
9. **Snapshot to playbook** — the handoff.

Out of v1 Analyzer: Weapons, Review headlines, heatmap, habits, floor modes unless the fixture map has two levels (prefer a single-floor map so the tour does not stop on Upper/Lower).

Mix “click this to continue” (Snapshot, Play, a tab) with a few watch-only cards (HUD clock). Do not freeze the whole UI behind a hard modal.

### Snapshot bridge

Reuse the existing Snapshot control (`MapToolbar` → `SnapshotDialog` / `writeSnapshot`). During the tour:

- Pre-create (or lazily create) one **ephemeral** playbook on the fixture map.
- Snapshot writes a new named page on that book only. Hide the user’s real books from the picker, or skip the picker and confirm a single “Snapshot tutorial round” action.
- Stay on Analyzer only long enough to finish the write, then navigate to `/playbook` focused on that page (same focus helper snapshot already uses).

Do not copy Analyzer drawings into the page unless the user made some during the Notes step — snapshot remains **entities on the radar**, same as production.

### Playbook half

Option-by-option on the temp strat, same spotlight component:

1. Tokens already on the board (this is the snapshot).
2. Token palette: place or drag one pawn.
3. Draw (pen or arrow).
4. Strat notes textarea.
5. Tree: this map → this book → this strat (so `/playbook` without a demo makes sense).

Out of v1 Playbook: YouTube pins, duplicate/delete book, import/export, callout overlay. Those can be a later “Replay tour” extra pass.

### End

- Delete the ephemeral playbook (and only that row).
- `saveUserSettings({ tutorialCompleted: true })`.
- Leave Playbook or go Home — pick one in implementation and stick to it.
- If IndexedDB is missing, in-memory settings already fallback; completed may not survive refresh. Acceptable (same as notes).

## Proposed UX

Coach mark: dim the rest of the stage, cut a hole around one control (or a short copy card if the target is a region). One sentence, **Next** / **Back** / **Exit**. Focus trap inside the card; Esc = Exit (confirm if they have a temp book).

Do not:

- Overlay a wall of paragraphs.
- Drive the tour only with auto-play while the user watches a video of the UI.
- Invent a parallel toolbar. Highlight the real buttons.

Home CTA is quiet (text button / link), not a hero takeover. FAQ link uses the same start helper so there is one code path.

## Data model

### User settings

Same IndexedDB database `cs2analyzer`, store `settings`, key `"user"` (v5 from #37). Add a field; **do not** bump the IDB version for a new property on the existing document. `parseUserSettings` already fills missing keys from defaults.

```typescript
export interface UserSettings {
  // …existing v1 fields…
  /** True after the user finishes the tour. False = never completed (default). */
  tutorialCompleted: boolean;
}
```

- Default: `false`.
- Unknown / missing → `false`.
- **Reset all settings** should **not** clear this (it is progress, not a slider). Replay is the Settings action. If reset-all is implemented before Replay tour exists, document the exception in that PR.
- Optional later: `tutorialVersion: number` if the step list changes enough to offer the tour again. Not v1.

### Ephemeral playbook

Production `Playbook` has no tutorial flag today. Add an explicit marker so export, tree, and “Remove all” can ignore it:

```typescript
export interface Playbook {
  // …existing fields…
  /** Tutorial-only. Never export. Delete on tour end / abort / boot sweep. */
  ephemeral?: boolean;
}
```

Reserved title is not enough (user could name a real book “Tutorial”). Filter `ephemeral === true`.

Boot sweep: on app start, delete ephemeral rows even if the last session crashed. Do not delete non-ephemeral books.

During the tour, `countPlaybooks()` / export / Home create-playbook card ignore ephemeral rows.

### Fixture Replay

A `Replay` the Viewer already understands: header, 10 players, **two non-knife rounds** with freeze + live, a handful of kills, one smoke/flash, one plant so C4 HUD is not empty, tick buffers long enough to scrub.

Hydrate **TypedArrays** in JS (same shape `parseWorker` copies out of WASM). Store as JSON number arrays or a TS module that uses the test `makeTicks` helpers. Either way:

- Run through the same required-field checks as `decode.ts` (or share a hydrate helper that fails with a named error).
- Keep it small. Target: well under a typical GOTV JSON dump — synthetic or heavily downsampled (~16 Hz is fine; short round clocks).
- Map: a **single-floor** Active Duty map the radar PNGs already ship (`de_inferno` / `de_mirage` — pick one and keep it). Calibration comes from `loadCalibrations()` like a real demo.
- File name stub: `tutorial.dem` via `new File([], "tutorial.dem")` so `LoadedDemo.file` stays typed without a real handle. Notes save / File System Access must treat this as unlinkable.

Not a CLI dump of a full match. Not `public/` megabytes. WASM is **not** invoked.

### Session inject

`useDemoSession` today only fills `replay` from the parse pool. Tutorial needs a **load-without-parse** path:

```typescript
loadTutorialReplay(replay: Replay): void  // set demo + replay, clear series
```

Same Analyzer runtime (playback, stats, sidebar). Close / new drop clears it like any other session. Distinguish with `demo.id` (stable `tutorial|de_…`) so playback clock reset and review-project identity do not collide with a later real file of the same name.

Do not warm the parse worker when the tour starts.

## Implementation order

One behavior per PR. Tests on the side you touch. No `.dem` files.

1. **This doc** — `todos/TUTORIAL.md` only.
2. **Fixture** — hydrate helper + compact Replay; unit tests (round count, freeze ticks, decode/shape, TypedArray lengths). No UI.
3. **`tutorialCompleted` + start helper** — settings field + parse/default tests; Home + FAQ entry that loads the fixture into Analyzer **without** coach marks yet (shell: dummy match plays).
4. **Analyzer tour shell** — spotlight component, step list, Skip/Exit, abort-on-real-drop. Snapshot step can point at the button without forcing a write.
5. **Snapshot bridge** — ephemeral playbook flag, tour-only snapshot write, navigate to `/playbook`, boot sweep, exclude from export/count.
6. **Playbook tour** — steps on the temp strat; End cleanup + `tutorialCompleted`.
7. **Polish** — Replay tour in Settings, FAQ article, Home hint, a11y pass, maybe `tutorialVersion`.

## Risks

- **Fixture rot** — a serde rename / `decode.ts` required field will blank the radar the same as a stale WASM cache. Hydrate through the named checks; CI test that the fixture loads.
- **`LoadedDemo.file` stub** — anything that reads bytes, `file.size`, or a demo handle must no-op for the tutorial id.
- **Orphan playbook** — crash between snapshot and End. Boot sweep is mandatory.
- **Spotlight vs layout** — sidebar width, round strip, and Playbook tree are resizable. Target by `aria-label` / `data-tour`, not pixel boxes.
- **Stale settings hook** — `useUserSettings` is exported and not fully wired on master. Tour completion must use `saveUserSettings` (store), not a one-off localStorage key.
- **User drops mid-tour** — abort + cleanup before parse starts, or the temp book leaks into a real session snapshot picker.

## Testing

- Fixture: two non-knife rounds, freeze_end &lt; end, buffers `frameCount * playerCount`, hydrate is deterministic.
- Settings: missing `tutorialCompleted` → false; completed survives `parseUserSettings` round-trip; reset-all (when it exists) does not flip it.
- Ephemeral: export bundle omits it; boot sweep deletes it; real playbooks untouched.
- Start helper: Analyzer gets a replay without calling `ensureParser` / the worker.
- Tour: Exit before snapshot creates no playbook; Exit after snapshot deletes it; complete sets the flag and deletes it.
- Mid-tour `.dem` drop: worker path runs; ephemeral gone; `tutorialCompleted` still false.

No browser E2E required for v1 if component tests cover start, snapshot bridge, and cleanup.

## Relation to other todos

- **User settings** — `tutorialCompleted` lives on the #37 document. Do not add a second store. Replay-tour entry waits on the preferences modal.
- **Playbook** — snapshot and `/playbook` focus already exist; tutorial only adds `ephemeral` and a constrained picker. Do not introduce an app-wide `appMode`.
- **i18n** — `todos/I18N.md` (separate track). Hard-coded English step strings are acceptable until that ships.
- **PDF export** — out of scope.

## Open questions

- **Skip Analyzer → Playbook?** Jump straight to a pre-built ephemeral snapshot, or Exit-only until they snapshot themselves?
- **Home after End** vs stay on Playbook (empty, their books). Leaning Home so the temp book disappearing is not a blank board.
- **Fixture map** — `de_mirage` (playbook default) vs `de_inferno` (no floors). Single floor is simpler.
- **How canned is Snapshot?** Skip the dialog entirely vs dialog with one locked destination.
- **Resume** — v1 is start-from-beginning. Mid-tour refresh = boot sweep + not completed. Worth a `tutorialStep` in sessionStorage?
- **First-visit Home hint** — still optional; default off until polish.
- **Coach-mark implementation** — small custom overlay vs a dependency. Prefer custom; the app already avoids extra UI kits.

## One-line scope

**Tutorial = opt-in coach-mark walkthrough on a tiny pre-parsed two-round Replay, then an ephemeral snapshot playbook, with cleanup and `tutorialCompleted` in the existing settings document — no GOTV file, no WASM, no forced modal.**
