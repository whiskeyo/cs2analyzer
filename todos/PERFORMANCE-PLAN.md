# Performance plan

Local-first speed audit of the viewer (`apps/web`) and the WASM parse path (`crates/cs2analyzer`, `crates/cs2analyzer-wasm`). **No features removed.** Large refactors are allowed later; this pass is a prioritized plan.

Product backlogs in `todos/PLAYBOOK.md`, `todos/USER-SETTINGS.md`, and `todos/PDF-EXPORT.md` are not this work. Quality refactor PRs **#2–#18** (from [`todos/REACT-QUALITY-AUDIT.md`](https://github.com/whiskeyo/cs2analyzer/pull/1)) may land soon — conflicts are called out below.

No production code changed. No WASM rebuild.

## Method

Read: `AGENTS.md`, `docs/frontend-migration.md`, `usePlayback`, `RadarCanvas` / `paintRadarFrame` / `radarFrame`, `computeStats` / `liveScore` / `hud.ts`, `useDemoSession` / `parseWorker` / `parsePool` / `decode.ts`, `useSeriesHabits` / `seriesOverlay.ts`, `observer.rs` / `assemble.rs` / `cs2analyzer-wasm`, `scripts/build-wasm.sh`, `Cargo.toml` `wasm-release`, open PRs **#1–#18**.

**Not profiled on a real `.dem`.** This environment has no GOTV fixtures under `.demos/` and `wasm-opt` is not installed. Findings below are from structure and complexity. Labels:

- **Verified** — the code always does this; cost follows from the data sizes CS2 GOTV produces.
- **Hypothesis** — likely hot, but needs Chrome / CLI numbers on a 30-round (and a 12-demo series) before treating it as the first patch.

A 30-round MR12 GOTV is the mental model: ~64 Hz, ~10 players, tick stride **4** (≈16 Hz snapshots), `weapon_fire` shots in the tens of thousands, `player_hurt` in the thousands, grenade polylines per throw.

---

## Executive summary

The architecture is already the right one: parse in a Worker + WASM, SoA tick buffers transferred (not JSON), canvas driven from `tickRef` + rAF, React supposed to see **integer ticks only**. Three gaps undo a lot of that:

1. **React still updates at demo-tick rate (~64 Hz at 1×).** `usePlayback` publishes `setTick(Math.floor(next))` every rAF. HUD, scoreboard, kill feed, spectator economy, sidebar, and the whole `AppState` tree re-render every integer tick. `computeStats` is cached per `(replay, tick)`, so the cache **misses every tick** and recomputes the full match. *(Verified.)*

2. **The canvas paints every animation frame even when paused.** `RadarCanvas` starts a perpetual rAF on `replay` and never dirty-checks. Each frame rebuilds a `RadarFrame` (kills-up-to-tick, nades, trails walking the whole SoA) and redraws the map PNG. Habits overlay additionally clips every trail and **rebuilds the heatmap** via `overlayAtPlaySec`. *(Verified.)*

3. **Parse wall time is dominated by `source2-demo` + per-tick entity walks, then a JSON event dump.** Stride-4 snapshots are already compact. Every demo tick still walks the entity list several times (`pawn_to_steam`, infernos, flash, ammo). After parse, ten `serde_json::to_string` payloads (`hurts`, `shots`, `grenades`, …) are `JSON.parse`d and shape-checked on the worker. Tick buffers are copied out of WASM, then transferred — that part is fine. Workers are **terminated after every file**, so WASM is fetched/compiled again per demo. *(Entity walks + JSON dump: verified. Rank vs protobuf decode: hypothesis.)*

WASM itself is in good shape for a first ship: `wasm-release` uses LTO, `opt-level = 3`, `panic = abort`, `strip`; shipped `cs2analyzer_wasm_bg.wasm` is **428 KB**. `wasm-opt -O3` is optional and **skipped when binaryen is missing** (this environment, and CI does not run `build-wasm.sh`).

**Do not** chase a Leptos/Yew rewrite, server-side parse, or lower default tick fidelity. `docs/frontend-migration.md` already says the hot path is Canvas2D + rAF, not the VDOM. Option D there (thicken WASM for live stats) is a later P2, not a quality-track change.

---

## Conflict with quality PRs #2–#18

Land or rebase around these; do not fight them.

| PR | Topic | Perf advice |
|---|---|---|
| **#1** | Quality audit | Same “leave canvas rAF / `tickRef` / SoA / `decode.ts` / TS `computeStats`” rule. This plan adds **speed** work those PRs explicitly deferred (WASM live-stats, tick publish rate). |
| **#2** | `decode.ts` require `is_knife` / `BombEvent.z` | Keep `decode.ts`. Event-transfer changes must update shapes, not add shims. |
| **#3, #8** | `Note`-only persistence | Do not mix note-schema work with canvas dirty flags or overlay clipping. |
| **#4** | Preference keys | `USER-SETTINGS.md` already owns `parsePoolMax` / trail window. Perf knobs go there, not new `localStorage` keys. |
| **#6** | React Router | Deep links do not change the playback hot path. Do not block Router on perf, or vice versa. |
| **#10** | `decodeList` first/last/stride | Extra shape checks are noise vs `JSON.parse` of 50k shots. Keep the tighter check. |
| **#11** | Split Session / Analyzer providers | **Align.** FAQ/Playbook constructing `usePlayback` + `useSeriesHabits` is both a quality smell and wasted work. Prefer #11 first; then put tick state only in the Analyzer provider. |
| **#13** | Bucket overlay transport out of `Viewer` | **Align.** `Viewer` already runs a second rAF for `bucketPlaySec`. Move it with #13; then share one clock with the canvas dirty flag. |
| **#14** | Sidebar via analyzer context | After #14, sidebar still must not subscribe to 64 Hz `tick`. Pass a throttled tick or a scoreboard store. |
| **#16** | Canvas `propsRef` | **Align.** One `propsRef` is cheaper than 22 ref writes per React render. Do that cleanup, then add dirty-checking — do not invent a third ref style. |
| **#5, #7, #9, #12, #15, #17, #18** | Naming, review hook, selection, playbook extract, Header, CSS tokens, types | No perf conflict. Do not bundle speed fixes into those diffs. |

Quality audit said: *do not add Redux/Zustand or WASM live-stats in the quality track.* This plan may add a **thin tick store** (or a 10 Hz publisher) and, later, optional WASM `compute_stats_until`. Not in the same PR as Note migration or provider split.

---

## Frontend findings

### 1. Playback publishes every integer tick — React tree at ~64 Hz

**Verified.** `usePlayback` (`apps/web/src/lib/playback/usePlayback.ts`):

- `tickRef` holds the sub-tick playhead; the canvas reads it. Good.
- `publish()` does `setTick` whenever `Math.floor(next)` changes. At 1× and `tick_rate = 64` that is **~64 React commits/s**. The comment even says 0.25× is 16 Hz — implying 1× is 64 Hz.
- `AppStateProvider` rebuilds `{ status, session, playback, … }` every render (unstable context value). `useApp()` consumers: `App`, `Header`, `Analyzer`, `DemoDrop`, `Viewer`, `RadarStage`, `Sidebar`, `SeriesBar`, `SeriesFilters`, `SeriesBucketPanel`.
- Leaf `memo` (`Hud`, `Scoreboard`, `KillFeed`, `SpectatorEconomy`, `Controls`) still re-render because **`tick` is a prop**.

Per published tick the UI typically:

| Caller | Work |
|---|---|
| `Hud` | `liveSituation` + `liveTeams` + `currentRound` |
| `Scoreboard` / `SpectatorEconomy` / weapons tab | `computeStats(replay, tick)` |
| `KillFeed` | `recentKills` + `currentSide` per row |
| `Controls` / `RoundStrip` | scrubber math, `currentRound` |
| `RadarCanvas` | React commit + 22 ref writes (rAF is independent) |

`liveSituation` → `plantClock` / `defuseClock` can call `trailingFlagStart`, which **scans every SoA frame** (~40k frames on a long GOTV) while a plant/defuse flag is set. *(Verified algorithm; cost only on those clocks.)*

**Win:** publish HUD tick at ~10 Hz, or only when scoreboard-visible fields change (round, alive counts, bomb state). Keep `tickRef` at full rate for the canvas. **Risk:** scrubber thumb / freeze countdown looking stepped if the publisher is too slow — 10–15 Hz is enough; freeze can stay on rAF via a small HUD ref.

### 2. `computeStats` cache is per exact tick

**Verified.** `computeStats` (`lib/stats/computeStats.ts`) returns the same array only when `replay ===` and `tick ===`. Playback therefore full-recomputes ~64 times/s.

Inside one call:

- `applyDamage` **copies and sorts all hurts**, then for **each competitive round** scans **all hurts** → `O(H log H + R·H)`.
- Each started round `filter`s the full kill list.
- `presentAt` / `currentSide` / clutches call `samplePlayers` (64-tick LRU — good), but `currentSide` is invoked per kill/hurt/blind at **that event’s tick**, so the LRU thrashes across many ticks.
- Trades are `O(K_round²)` (fine).
- Rust `analysis.rs` is the same shape (`match-stats` feature; **not** in WASM).

`liveTeams` is cached the same way; cheap compared to ADR/KAST.

**Win:** (a) throttle the React tick so the cache hits; (b) incremental stats: keep last `(tick, stats)` and apply events in `(prev, next]`; (c) index hurts/kills by round once per demo. (b) must preserve ADR cap, knife skip, trade window, survive-KAST-only-if-present-at-freeze. **Risk:** formula drift vs `analysis.rs` / `parity.test.ts`.

### 3. Canvas: perpetual rAF + full-scene rebuild

**Verified.** `RadarCanvas` `useEffect(..., [replay])` loops `requestAnimationFrame` forever.

Each frame:

1. Resize/DPR check, clear, `setTransform`.
2. `buildRadarFrame` — `samplePlayers`, `nadeRenders` (windowed), `tracers` (windowed; `eventIndex` binary search is good), `heatDots` = `upToTick(kills)` **allocates a prefix array of every kill so far**, `sampleTrail` **linear-scans all frames** per trailed player (2.5 s window but the loop is `for f in 0..frameCount`).
3. `paintMapImage` — draw the radar PNG under pan/zoom every frame.
4. `paintRadarFrame` / `paintPawns` — many `beginPath`, `measureText` for names, `save`/`restore` per pawn.
5. If habits: `paintHabitsOverlay` → `overlayAtPlaySec` (see §5).

No “tick/layers/view unchanged → skip”. Paused playback still burns a full paint.

`eventIndex.ts` already sorts once per array (WeakMap). Trails and heatmap prefixes do not.

**Win:** dirty flag (`tickRef` floor, view, layers, strokes, habits `playSec`). Optional: static map on its own canvas / `OffscreenCanvas` so the PNG is not redrawn at 60 Hz. Trail lookup: binary search `ticks[]` for the lookback start (same as `frameAt`). **Risk:** missed invalidation (follow-cam, text editor, image load). Prefer an explicit `needsPaint` set from those paths.

Do **not** replace Canvas2D with WebGL in the first pass. A GL port can keep every layer but is an L rewrite with yaw/hit-test risk.

### 4. Worker / WASM transfer

**Verified.**

| Stage | What happens |
|---|---|
| `File.arrayBuffer()` | Main thread; buffer transferred into the worker. Good. |
| `ensureWasm` | `fetch` + `arrayBuffer` + `init`. MIME workaround is correct. |
| `parseDemo(data, 4, true, progress)` | Stride 4, skip warmup, JS callback every 512 ticks (`PROGRESS_TICK_INTERVAL`). |
| 10× `*Json()` | `serde_json` strings for header, players, rounds, grenades, shots, kills, hurts, blinds, bomb, buys. |
| `decodeList` | `JSON.parse` + check `[0]` only (#10 will sample more — still cheap). |
| SoA `view.slice()` | Copy out of WASM linear memory, then `parsed.free()`. |
| `postMessage(..., { transfer })` | Tick buffers move; event **objects** are structured-cloned. |

`parsePool`: cap `min(PARSE_POOL_MAX=3, 4, hardwareConcurrency, fileCount)`. Each job `new Worker` → parse → **`terminate`**. Series of 12 maps = 12 WASM instantiations. `USER-SETTINGS.md` already wants `parsePoolMax` as a pref.

Progress is rAF-coalesced on the main thread. Good.

**Hypothesis:** on a 200–400 MB GOTV, `parseMs` (protobuf + observer) >> `jsonMs` >> `buffersMs`. Confirm with the existing `console.info("[cs2analyzer parse]", timings)` after a re-drop. If `jsonMs` is hundreds of ms, replace event JSON with typed arrays or `postcard` / `serde-wasm-bindgen` **without** JSON strings. Tick SoA must stay transferable.

**Win:** reuse a warm worker pool (init once); optional binary event encode; do not `terminate` after each series file. **Risk:** stale WASM after a parser bump — version the worker or keep terminate-on-close.

### 5. Habits / series overlay

**Verified.**

- `useSeriesHabits` memos `buildSeriesOverlay`, `aggregateSeriesUtil`, `aggregateSeriesAction`, `collectSeriesUtilThrows`, `collectSeriesActionBeats`, `aggregateUtilSets` when `aggregated`. Opening a bucket walks every matched demo’s trails (`sampleForwardTrail` scans all frames) and nades. Cost is **once per filter change**, not per frame. Fine if the memo holds.
- `paintHabitsOverlay` each frame: `overlayAtPlaySec` **filters every trail point**, **rebuilds `heatDots` from scratch** (`trailsToHeatmap`), then `nadeRenderAt` for every visible nade.
- `habitsTrailAtScreen` (pointer) also calls `overlayAtPlaySec` and tests every point.
- `findExecutes` → `tPushTick` samples T positions every `T_PUSH_STEP_SECONDS` for the whole round (`lib/match/execute.ts`). Series Action tab runs that per tagged round. *(Hypothesis: noticeable on 12-demo aggregated open, not during 1× playback.)*

A 12-demo same-map series keeps **every `Replay` in memory** (`DemoSeries.demos`). SoA + shots/hurts/grenades × 12 is the RAM ceiling, not CPU. Do not evict the inactive demo’s buffers if overlay/habits still need them.

**Win:** clip trails with a stored prefix index / `frameAt` on freeze-relative ticks; cache heatmap for integer `playSec`; do not rebuild heat on every rAF. Optional: downsample trail points for paint only (keep full points for jump hit-test). **Risk:** death/survive markers drifting if clip is wrong.

### 6. Sidebar / match story

**Verified.** Sidebar is `memo` but takes `tick` and also `useApp()`. Inactive tabs do not mount (good). Active Score / Review / Action / Util / Weapons still run `computeStats` or `findExecutes` / `utilThrowsForRound` on that tick.

`findExecutes` is not cached per `(replay, places)` — Action tab rebuilds executes when the parent re-renders.

**Win:** cache executes/util per replay (+ places). After #14, subscribe sidebar to a 10 Hz tick, not `playback.tick`.

### 7. Bundle / boot

**Verified sizes (this tree):**

| Asset | Size |
|---|---|
| `cs2analyzer_wasm_bg.wasm` | 428 KB |
| `cs2analyzer_wasm.js` | 27 KB |
| `public/maps` | 1.5 MB (PNG radars) |
| `public/weapons` | 736 KB |
| `public/layouts` | 244 KB |

FAQ is `lazy()`; `katex` + `react-markdown` load with FAQ only. Playbook is **eager** (`App.tsx` static import). Layouts editor is DEV-only lazy. No `manualChunks` in `vite.config.ts`. Worker is a Vite ES worker (correct).

**Hypothesis:** Analyzer first-load JS is fine; Playbook-on-home is the only easy split. Map PNGs are cached by the browser after first map. Not a playback bottleneck.

**Win:** `lazy()` Playbook (P2). Optional `vite-bundle-visualizer` in CI artifact. Do not lazy-load the parse worker or radar (drop-path latency).

---

## Rust / WASM findings

### 1. Observer: full entity walks every demo tick

**Verified.** `on_tick_start` (`observer.rs`) even when `tick_stride` skips the snapshot:

1. Rebuild `pawn_to_steam` — iterate all entities, keep `CCSPlayerController`.
2. `sample_infernos` — iterate all entities.
3. `sample_flash_blinds` — iterate controllers.
4. `sample_ammo` — allocate a `Vec` of pawn pairs, then per pawn.

On stride ticks, **additionally**:

5. `collect_loadouts` — iterate **all** entities, `classify_entity` each.
6. Snapshot loop — controllers again.
7. Projectile loop — all entities for `proj_kind`.

`source2-demo` must visit the tick regardless; we cannot skip the crate’s walk. We **can** avoid 3–5 extra full scans on the 3/4 ticks we do not snapshot, and we can combine loadout + projectile + inferno into one pass on snapshot ticks.

`sample_ammo` / flash / infernos are on purpose every tick (ammo hold, molly cells, blinds). That is functionality. The fix is **one entity iteration** with a class switch, not dropping those samples.

`progress` every 512 ticks through `Function::call2` is cheap.

**Hypothesis:** this plus protobuf decode **is** `parseMs`. Confirm with a native `cs2analyzer-cli` release parse vs WASM timings on the same file.

### 2. Assemble allocations

**Verified.** `assemble.rs` maps `shots` / `kills` / `hurts` with `.clone()` on weapon strings; `build_ticks` allocates full SoA (`frame_count * player_count`). `RawFrame` holds a `Vec<RawFramePlayer>` per snapshot, then is copied into SoA — **peak RAM is roughly 2× tick data** until `Collector` is dropped.

Grenade `proj_points` is every stride tick the projectile exists (needed for flight paths).

**Win:** `build_ticks` can drain frames; intern weapon strings (`Arc<str>` / `&'static` for known names). Secondary to entity-walk and JSON.

### 3. WASM bindgen surface

**Verified.** `ParsedMatch` exposes typed-array **views** (unsafe `Uint32Array::view`) and JSON getters. Worker copies views then `free()`s — required, views dangle after free. `Match::stats` is correctly not exported.

`parseDemo` arguments are hardcoded in JS as `4, true`. Changing stride is a product setting, not a silent default change.

No SIMD target, no `wasm-bindgen` `serde-wasm-bindgen` for events, no persistent `ParsedMatch` across the worker boundary.

### 4. Build flags

**Verified.**

| Knob | Today | Note |
|---|---|---|
| `profile.wasm-release` | LTO, `opt-level=3`, `codegen-units=1`, `panic=abort`, `strip` | Keep. |
| `mimalloc` | **off** in WASM (`default-features = false`) | Keep off. WASM allocator + mimalloc is a footgun (`AGENTS.md`). |
| `match-stats` | **off** in WASM | Keep off until a dedicated `compute_stats_until` export is designed. |
| `wasm-opt -O3 --enable-bulk-memory --strip-debug` | If `wasm-opt` exists | **Not in CI.** This tree’s 428 KB wasm may already be unoptimized or previously opted. |
| `wasm-bindgen` | **0.2.127** | Do not bump in a perf PR. |
| Progress | 512 ticks | Fine. |

**Win:** install binaryen in the WASM build path / document it; measure `wasm-opt` on parse time (often size, sometimes speed). Optional `RUSTFLAGS='-C target-feature=+simd128'` experiment — measure, do not flip without a bench.

### 5. Tick stride

**Verified.** `DEFAULT_TICK_STRIDE = 4` (16 Hz). Playback lerps between snapshots (`sample.ts` `frameAt` + `lerp` / `lerpAngle`). Lowering stride to 2 or 1 **increases** parse RAM, JSON-adjacent event density is unchanged (events are every tick), and SoA size grows linearly.

Do not lower the default. An optional “high-fidelity ticks” setting (stride 2) is a quality knob in `USER-SETTINGS`, not a perf fix.

---

## Prioritized fixes

Effort: **S** < ~half-day / small PR · **M** multi-file, tests · **L** parse protocol or canvas rewrite.

Expected win is qualitative until measured; “high” means it sits on the 1× playback or drop-to-radar path.

| ID | Pri | Effort | Area | Change | Expected win | Risk to functionality |
|---|---|---|---|---|---|---|
| **F1** | P0 | S | Playback | Publish React `tick` at ~10 Hz (or on round/bomb/alive change). Canvas keeps `tickRef`. | High — 6× fewer `computeStats` + React commits at 1× | Scrubber / freeze UI stepping. Keep 15 Hz or rAF HUD clocks. |
| **F2** | P0 | S | Canvas | Skip `buildRadarFrame` + paint when tick/view/layers/strokes/habits `playSec` unchanged. | High — paused and 1× both drop GPU/CPU | Missed redraw (follow, images, editor). Explicit dirty bits. |
| **F3** | P0 | M | Stats | Incremental `computeStats` from last tick **or** pre-index hurts/kills by round. Keep FACEIT rules. | High after F1 still helps scrub/8× | ADR / KAST / trade mismatch. `stats.test.ts` + `parity.test.ts`. |
| **F4** | P0 | S | HUD | `trailingFlagStart`: binary search `ticks[]` then scan the short flag run; cache last plant/defuse start. | Medium on plant/defuse | Defuse 5/10 s clock. Existing HUD tests. |
| **F5** | P1 | S | Parse | Reuse workers; init WASM once per pool slot. Terminate on session `close` / gen bump. | Medium on multi-demo drop | Stuck worker after error — reset on `onerror`. |
| **F6** | P1 | M | Habits | `overlayAtPlaySec`: prefix-clip trails; cache heatmap per integer `playSec`. | High in aggregated bucket play | Jump hit-test / death marks. Overlay tests already exist. |
| **F7** | P1 | S | Canvas | `sampleTrail` / `sampleForwardTrail`: `frameAt` for window start, not `0..frameCount`. | Medium | Trails 2.5 s window. `radarFrame` tests. |
| **F8** | P1 | S | Match | Cache `findExecutes` / util rows per `(replay, places)`. | Medium on Action/Util + series open | Stale if places load late — key includes layout. |
| **F9** | P1 | M | Rust | Single entity pass per tick; skip loadout/projectile scan on non-stride ticks (keep inferno/flash/ammo). | High on `parseMs` *(hypothesis)* | Missed nade points or gear bits. Re-drop + CLI JSON diff. |
| **F10** | P1 | L | WASM | Replace event `*Json()` with binary / typed arrays. Keep `decode.ts` validation on a header + samples. | High on `jsonMs` if timings agree | Breaking parse. Rebuild WASM, update `decode.ts`, re-drop. No `#[serde(default)]` shims. |
| **F11** | P1 | M | State | After **#11**: Analyzer-only playback provider; Playbook/FAQ do not construct the clock. | Medium idle CPU / memory | Route bugs. Let #11 land first. |
| **F12** | P1 | S | Canvas | `#16` `propsRef` then dirty flag (F2). One style. | Low–medium | None if #16 is first. |
| **F13** | P2 | S | Build | Run `wasm-opt` in `build-wasm.sh` when missing (install binaryen) or document CI. Measure parse time. | Low–medium | Need same `wasm-bindgen` 0.2.127. |
| **F14** | P2 | M | Stats | Optional WASM `compute_stats_until` (migration doc option D). TS stays until parity is green. | Medium at 8× / scrub | Dual formula period. **Not** in quality PRs. |
| **F15** | P2 | S | Bundle | `lazy()` Playbook; optional visualizer. | Low (first paint on `/`) | Playbook route flash. |
| **F16** | P2 | M | Canvas | Second canvas (or Offscreen) for the map PNG. | Medium GPU fill | Floor swap / pan seams. |
| **F17** | P2 | S | Settings | `parsePoolMax`, optional stride 2 “quality”, optional 30 Hz HUD — via `USER-SETTINGS.md`. | User-tunable | Defaults stay as today. |
| **F18** | P2 | L | Canvas | WebGL/WebGPU painter behind the same `RadarFrame`. | High on 12-demo heatmap | Hit-test, yaw, DPR. Last resort. |

### Suggested order

1. **Measure** on a real 30-round `.dem` and a 6–12 file series (section below). Do not start F10 or F18 without timings.
2. **F1 + F2 + F4** (small, playback smoothness). One PR per item if they touch different files.
3. Let **#11 / #13 / #16** land or rebase F11/F12 onto them.
4. **F3** (stats) with tests; **F7** (trail scan); **F6** (habits clip).
5. **F5** (worker reuse) then **F9** (observer pass) — parse wall time.
6. If `jsonMs` is large: **F10**. If not, skip.
7. **F13–F17** as polish. **F14 / F18** only if 8× or series heatmap is still short of 60 fps.

---

## Do not do

These drop functionality or fight the product. Optional **settings** are fine if the default stays as today.

- Do not upload `.dem` files or move parse/stats to a server.
- Do not remove multi-demo / series / habits overlay / playbook snapshot.
- Do not drop radar layers (heatmap, summary, nades, shots, deaths, openings, names, cone, trails). A “performance” preset that **toggles existing layers** is OK; do not delete the code.
- Do not lower default `tick_stride` (do not go to 8/16) to “make parse faster.” That is lost pawn/lerp fidelity. Higher stride only as an explicit user setting.
- Do not skip warmup incorrectly or drop `weapon_fire` tracers, molly cells, blinds, or bomb begin/abort.
- Do not JSON-serialize SoA tick buffers.
- Do not enable `mimalloc` in WASM.
- Do not put `tick` into more React state, or “fix” rAF/refs into `useState` (quality audit + ESLint `react-hooks/refs` off are intentional).
- Do not rewrite `apps/web` in Leptos/Yew for speed (`docs/frontend-migration.md`).
- Do not delete `decode.ts` or add `#[serde(default)]` to hide breaking parser changes.
- Do not change FACEIT rules (ADR cap, 5 s trades, `currentRound`, knife, OT, yaw).
- Do not ship SharedArrayBuffer without a dedicated COOP/COEP discussion (breaks `file://` / some embeds).
- Do not squash this work into Note-model or Router PRs.

---

## How to measure

### Drop / parse (Worker)

Already logged: `console.info("[cs2analyzer parse]", timings)` (`initMs`, `parseMs`, `jsonMs`, `buffersMs`, `totalMs`). Series logs `wallMs`, `poolWorkers`, `maxWasmMs`.

1. Chrome DevTools → Performance, start, drop one 200–400 MB GOTV, stop when the radar appears.
2. Record the four timings from the console (stderr on CLI).
3. Repeat a 6- and 12-file same-map series.
4. Native baseline: `cargo run --release -p cs2analyzer-cli -- .demos/your.dem` (summary) and `-s replay` if comparing event counts — **not** a WASM substitute; no JSON/`postMessage`.
5. After observer/WASM changes: same file, compare `parseMs` / `jsonMs` / peak worker memory (Chrome Task Manager → the worker process).

**Fixtures:** keep real `.dem` gitignored. For CI, do **not** add GOTV binaries. Synthetic: `apps/web/src/lib/testing/fixtures.ts` plus a bench that builds N hurts/kills/rounds and times `computeStats` / `buildRadarFrame` / `overlayAtPlaySec` (new `*.bench.ts` or a documented `vitest` file, opt-in).

### Playback (main thread)

1. Load one demo, 1×, Score tab open, default layers, no habits.
2. Chrome Performance: 10 s. Check **Scripting** vs **Rendering** vs **Painting**. Expect Scripting dominated by React + `computeStats` today *(hypothesis)*.
3. React Profiler: commit count while playing. Target after F1: ~10–15 commits/s, not ~64.
4. `performance.mark` around `buildRadarFrame` + `paintRadarFrame` inside the rAF (dev-only flag). Paused: after F2, marks should stop.
5. Repeat at 4× / 8×, with trails + names, with heatmap, with a 12-demo bucket overlay (trails + nades).

### Habits

Time `buildSeriesOverlay` (once per bucket) vs `overlayAtPlaySec` (per frame). A 12-demo full-buy CT bucket is the stress case.

### WASM binary

`ls -lh apps/web/src/parser/cs2analyzer_wasm_bg.wasm` before/after `wasm-opt`. Parse the **same** demo; size ≠ speed.

### Bundle

`cd apps/web && npm run build` and read `dist/assets` chunk names. Optional `rollup-plugin-visualizer`. Playbook/FAQ should stay out of the analyzer graph after F15.

### Parity gates (any stats or parser change)

```
cd apps/web && npm run format:check && npm run lint && npm run typecheck && npm test
cargo fmt --all -- --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace
# parser / wasm types:
./scripts/build-wasm.sh
# opt-in, real demo:
cd apps/web && CS2_DEMO=.demos/your.dem npx vitest run src/lib/stats/parity.test.ts
```

Re-drop the demo after WASM changes.

---

## How a follow-up agent should use this

Pick **one ID** (F1 or F2 first). Read the listed files. Do not mix F10 with UI dirty flags. Do not start F11 until #11’s provider split is in or you are implementing that split. Web checks as in `AGENTS.md`. After parser/types: rebuild WASM and tell whiskeyo to **re-drop**. UI: click Analyzer playback **and** aggregated habits if you touched overlay clipping.
