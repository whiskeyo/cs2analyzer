# User settings

Local-first preferences stored in **IndexedDB** (same `cs2analyzer` database as saved notes). One place for defaults that today are hardcoded in `constants.ts`, split across **localStorage**, or only live in React state.

**Reset to defaults** restores the same values the app ships with today — not “empty”, not “factory wipe of notes”.

## Problem today

| Preference | Where it lives | Survives refresh? |
|---|---|---|
| Sidebar width | `localStorage` (`sidebarWidth.ts`) | Yes |
| Event scrub lead-in | `localStorage` (`roundEvents.ts`) | Yes |
| Habits trail window | `localStorage` (`seriesOverlay.ts`) | Yes |
| Parse worker cap | `PARSE_POOL_MAX = 3` in `constants.ts` | No (fixed) |
| Default pen palette / color | `COLOR_PRESETS[0]` via `defaultPaletteId()` | Per saved note only |
| Default floor mode | `"auto"` hardcoded on new note | Per saved note only |
| Radar layer toggles | `DEFAULT_LAYERS` in `viewState` | Resets each demo |
| Playback speed | `useState(1)` | Resets each demo |
| Saved notes page size | `SAVED_NOTES_PAGE_SIZE = 5` | No |
| Series file cap | `SERIES_MAX_FILES = 12` | No |
| Draw undo depth | `DRAW_HISTORY_LIMIT = 80` | No |

Notes/demo projects (`ReviewProject`) keep their **own** palette, floor, and summary filter when saved. User settings define **global defaults for new sessions** and **layout/performance prefs** that apply everywhere.

## Product

### Settings entry points

- **Splash:** gear icon → Settings modal (or small `/settings` panel below drop zone).
- **Viewer:** same modal from header (next to Export CSV).

Changes apply immediately where safe; parse pool applies on the **next** multi-file drop.

### Reset to defaults

- Button: **Reset all settings** (confirm dialog).
- Writes `defaultUserSettings()` to IndexedDB — values documented below, matching current production behavior.
- Does **not** delete saved notes, linked demo handles, or playbooks (future).

Optional later: reset individual sections (Appearance / Playback / Performance).

## Settings schema (v1)

Single document in IndexedDB store `settings`, key `"user"`.

```typescript
export const USER_SETTINGS_SCHEMA = 1;

export interface UserSettings {
  schema: number;
  updatedAt: number;

  /** Concurrent WASM workers (queue the rest). */
  parsePoolMax: number;

  /** Sidebar width in px (clamped same as today). */
  sidebarWidth: number;

  /** Saved-note cards per page on splash. */
  savedNotesPageSize: number;

  /** Default pen palette + swatch for new demos / new playbook pages. */
  defaultPaletteId: string;
  defaultColor: string;

  /** Default radar floor when opening a demo. */
  defaultFloorMode: FloorMode;

  /** Default nade summary filter for new demos. */
  defaultSummaryFilter: SummaryFilter;

  /** Default radar layer toggles when a demo loads. */
  defaultLayers: MapLayers;

  /** Playback speed when a demo opens (positive = forward). */
  defaultPlaybackSpeed: number;

  /** Seconds before a round event when jumping from Util / Action / Review. */
  eventLeadInSec: number;

  /** Aggregated habits overlay trail length (seconds after freeze). */
  habitsTrailWindowSec: number;

  /** Default Moment overlay length on the radar (Notes tab). */
  noteMomentSec: number;

  /** Max files accepted in one multi-demo drop (≤ hard cap). */
  seriesMaxFiles: number;
}
```

### Default values (= current app behavior)

These live in **`defaultUserSettings()`** in code — the single source for reset and for “unset” fallback. Constants in `constants.ts` stay as **hard limits** (min/max clamp), not as the runtime default source once settings ship.

| Field | Default | Clamp / notes |
|---|---|---|
| `parsePoolMax` | `3` | `1 … min(8, hardwareConcurrency)` — replaces `PARSE_POOL_MAX` at runtime |
| `sidebarWidth` | `480` | `SIDEBAR_MIN_WIDTH … SIDEBAR_MAX_WIDTH` |
| `savedNotesPageSize` | `5` | `3 … 20` |
| `defaultPaletteId` | `"neon"` | must exist in `COLOR_PRESETS` |
| `defaultColor` | `#ff2d6a` | first swatch of default palette |
| `defaultFloorMode` | `"auto"` | `auto \| upper \| lower` |
| `defaultSummaryFilter` | `DEFAULT_SUMMARY_FILTER` | copy object |
| `defaultLayers` | `DEFAULT_LAYERS` | copy object |
| `defaultPlaybackSpeed` | `1` | one of `0.25, 0.5, 1, 2, 4, 8` |
| `eventLeadInSec` | `1.5` | `0 … 5` (existing lead-in clamp) |
| `habitsTrailWindowSec` | `20` | `SERIES_HABITS_WINDOW_MIN … MAX` |
| `noteMomentSec` | `5` | `NOTE_MOMENT_MIN … reasonable max` |
| `seriesMaxFiles` | `12` | `2 … 12` (keep 12 as hard ceiling in constants) |

### v2 candidates (defer unless easy)

| Setting | Why |
|---|---|
| Default draw tool (`pan` vs `pen`) | Minor UX |
| Follow player on select (on/off default) | Today always on when selecting |
| Default sidebar tab (`score` vs `notes`) | Niche |
| Heatmap on by default | Heavy canvas |
| Skip knife round on demo open (always jump to first pistol) | Playback policy |
| Export bundle includes linked handles | Privacy |
| Theme (dark only today) | Only if a light theme exists |
| Locale / 12h clock | No i18n yet |

### Do not expose

Parser/tick rate, ADR/KAST/trade formulas, `REGULATION_ROUNDS_*`, WASM build flags — changing these breaks parity with Rust/AGENTS.md and is not a “preference”.

## Storage

### IndexedDB

- DB: `cs2analyzer` (existing)
- Version bump: **v4** — add object store `settings` (`keyPath: "id"`), single row `id: "user"`.
- Module: `apps/web/src/lib/settings/userSettingsStore.ts` (parallel to `projectStore.ts`, not mixed into `ReviewProject`).

```typescript
loadUserSettings(): Promise<UserSettings>   // merge partial + defaults
saveUserSettings(patch: Partial<UserSettings>): Promise<void>
resetUserSettings(): Promise<UserSettings>  // write defaultUserSettings()
```

On load: unknown fields → ignore; missing fields → fill from `defaultUserSettings()`. Same pattern as `parseProject`.

### Migration from localStorage

One-time on first `loadUserSettings()` after upgrade:

| Old key | New field |
|---|---|
| `cs2analyzer.sidebarWidth` | `sidebarWidth` |
| `cs2analyzer.eventLeadInSec` | `eventLeadInSec` |
| `cs2analyzer.seriesTrailWindowSec` | `habitsTrailWindowSec` |

Then remove those localStorage keys (or leave read-only fallback for one release). New writes go only to IndexedDB.

### React integration

- `useUserSettings()` hook: loads once at app boot, exposes `{ settings, update, reset }`.
- Wire in `appState.tsx`; pass subsets into `useDemoSession`, `useReviewProject`, `useViewState`, `usePlayback`, `Sidebar`, `DropZone`.
- **`parsePoolSize(fileCount, settings.parsePoolMax)`** — drop constant-only cap.

Keep settings **out of** per-demo undo/history; changing palette in settings does not mutate open `ReviewProject` until user picks a swatch or starts a new demo.

## UI sketch

Modal sections:

1. **Performance** — parse worker pool (slider 1–N + RAM hint), max demos per drop.
2. **Layout** — sidebar width (slider or number), saved notes page size.
3. **Drawing** — default palette + color swatches (reuse `MapToolbar` preset UI).
4. **Radar** — default floor, layer checkboxes, nade summary CT/T + kinds.
5. **Playback** — default speed, event lead-in, moment length, habits trail window.

Footer: **Reset all to defaults** (destructive confirm).

Help text on parse pool: *“Each worker loads a full demo parser in memory. Higher = faster multi-drop, lower = safer on laptops.”*

## Consumers (what to change)

| Module | Setting |
|---|---|
| `parsePool.ts` | `parsePoolMax` |
| `useDemoSession.ts` | `seriesMaxFiles` |
| `sidebarWidth.ts` | read/write via settings store (drop direct localStorage) |
| `roundEvents.ts` | `eventLeadInSec` |
| `seriesOverlay.ts` | `habitsTrailWindowSec` |
| `useReviewProject.ts` | initial `paletteId`, `color`, `floorMode`, `summaryFilter` from settings |
| `useViewState.ts` | initial `layers` from settings on demo load |
| `usePlayback.ts` | initial `speed` from settings on demo load |
| `DropZone.tsx` | `savedNotesPageSize` |
| `Notes` / moment helpers | default moment length from settings |

Per-demo saves still persist overlay fields on `ReviewProject`; loading a saved note **overrides** globals with stored project values (today’s behavior).

## Implementation order

One behavior per commit. Tests for `userSettingsStore` + `defaultUserSettings` + migration; no `.dem` files.

1. **`defaultUserSettings()` + types** — `apps/web/src/lib/settings/userSettings.ts` (pure, no IDB).
2. **`userSettingsStore.ts`** — IDB v4, load/save/reset; unit tests with fake IDB or inject store.
3. **`useUserSettings` hook** — app boot load; `appState` provider.
4. **Migrate localStorage** — read old keys into first save; tests for migration.
5. **Wire parse pool + series max** — visible wins, low UI risk.
6. **Wire sidebar width + saved notes page size** — remove localStorage sidebar path.
7. **Wire drawing/radar defaults** — new demos only; test that existing projects unchanged.
8. **Wire playback + lead-in + habits window + moment** — replace remaining localStorage.
9. **Settings modal UI** — splash + viewer entry, reset button.

## Risks

- **Stale closure** — settings ref in parse pool / playback; read from ref or context at use site.
- **IDB unavailable** — fall back to in-memory `defaultUserSettings()` (same as notes today).
- **User sets `parsePoolMax = 8` on 8 GB RAM** — document risk; optional soft warning in UI above 4.
- **Schema drift** — bump `USER_SETTINGS_SCHEMA`, migrate in `parseUserSettings`.

## Testing

- `defaultUserSettings()` matches table above (snapshot or explicit expects).
- Partial IDB blob merges with defaults.
- Reset restores exact defaults.
- Migration copies localStorage fixtures once.
- `parsePoolSize` respects user cap but still `min(..., fileCount, hw)`.

## Relation to other todos

- **Playbook** — uses same `defaultPaletteId` / `defaultColor` for new playbook pages.
- **PDF export** — optional “include settings footer” later; not v1.

## One-line scope

**User settings = one IndexedDB document for performance and UI defaults, with reset matching today’s shipped behavior, without touching saved match notes.**
