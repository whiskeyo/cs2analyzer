# Migrating the web UI off React + TypeScript

This is optional background, not a scheduled rewrite. The parser crates stay; only `apps/web` would move.

## Why React + TS was chosen

The Rust crate is the product. The website is one consumer of WASM bindings, not the core.

That split was deliberate:

- **Parse is CPU-heavy and already WASM.** A 200–400 MB GOTV demo should not share a thread with canvas redraw. The current design is: JS worker loads `cs2analyzer-wasm`, transfers SoA typed arrays to the main thread, React owns playback UI.
- **The hot path is Canvas2D + `requestAnimationFrame`, not a virtual DOM.** Radar, nades, shots, pan/zoom, and drawing tools are imperative. React is only the shell (sidebar, HUD, file drop). Putting that shell in Leptos/Yew does not make the radar faster; `web-sys` `CanvasRenderingContext2d` is more verbose than the JS API the browser already exposes.
- **Iteration speed.** Vite HMR for CSS/TSX is seconds. A full Leptos/Yew UI rebuilds WASM on most UI tweaks. That hurts a viewer that changes weekly (scoreboard columns, spectator panels, review tab).
- **Worker + transferable buffers.** `postMessage(..., { transfer })` of `Uint32Array`/`Float32Array` is a JS-platform feature. You can do it from Rust (`web_sys::Worker`), but the wasm-bindgen glue we already have is generated JS meant to be called from JS.
- **Tooling default.** Cursor, ESLint, Prettier, Vitest, and in-browser click-through checks are all first-class for React. Yew/Leptos work; they are a smaller ecosystem for this kind of app.

Leptos or Yew would have been reasonable if the goal was “one language everywhere” or a mostly-Rust shop with little canvas/DOM. For a local-first radar viewer, mixed Rust (parse) + TS (shell + canvas) is the boring fit.

## What not to rewrite

Keep as-is:

- `crates/cs2analyzer` (observer, assemble, analysis, types)
- `crates/cs2analyzer-wasm` wasm-bindgen surface (`parseDemo`, typed-array getters, `free()`)
- `scripts/build-wasm.sh` + `wasm-bindgen` **0.2.127**
- Vendored maps/weapons under `apps/web/public/`
- Domain rules in `AGENTS.md` (ADR cap, trades, OT scores, yaw, knife rounds)

`apps/web/src/stats.ts` duplicating `analysis.rs` is the awkward part. A migration is a good time to **call into WASM for live stats** (`compute_stats_until`) instead of porting the formula a third time.

## Target options

| Option | Keep worker? | UI language | Notes |
|---|---|---|---|
| **A. Leptos (CSR)** | Yes, still JS or a second WASM worker | Rust | Fine-grained signals; `web-sys` canvas; Trunk or `wasm-bindgen` + bundler. Prefer this over Yew in 2026. |
| **B. Yew** | Same | Rust | Component model closer to React. Heavier VDOM than Leptos for a 10 Hz scoreboard. |
| **C. Dioxus Web** | Same | Rust | Closer to React mentally. Still WASM UI + `web-sys` canvas. |
| **D. Stay React, thicken WASM** | Yes | TS | Move `stats.ts` / `sample.ts` math into the crate; UI stays. Cheapest “more Rust” win. |

If the motive is “more Rust,” do **D** first. A full UI rewrite does not fix ADR/KAST; those already live in `analysis.rs`.

## Suggested order (if you still want A)

Do not flip `apps/web` in one commit. Cap commits ~1000 lines; this rewrite is several PRs.

1. **Extract a UI-agnostic playback model** (even while still in TS): `Replay`, `tick`, `playing`, `selected`, `layers`, `strokes`. Today that state lives in `App.tsx`. A Leptos `RwSignal` set should match this 1:1.
2. **One WASM stats API** used by the UI: `compute_stats_until(tick)` over the already-parsed `Match`, instead of JSON-snapshot + TS recompute. Delete the duplicated formula after both sides match tests.
3. **Worker stays JS (or a tiny `parse-worker` crate).** Parsing must not run on the UI WASM instance. Either keep `parseWorker.ts` or a dedicated `cdylib` worker that posts transferable buffers. Do not parse on the Leptos main module.
4. **Port shell first:** DropZone, progress, Controls, Sidebar tabs, Scoreboard. Leave `RadarCanvas` in TS behind a canvas element until the shell is done (interop: Leptos mounts a `<canvas>`, existing TS `draw(tick)` runs). Hybrid is allowed for a while.
5. **Port radar last.** `RadarCanvas.tsx` is the largest, most imperative file (rAF, pan, draw tools, image cache). Rewrite as a Rust struct that owns `HtmlCanvasElement` + refs, not as Leptos components per player.
6. **Retire Vite/React:** Trunk or `leptos --csr` + copy `public/maps` and `public/weapons`. CI: drop the npm job’s ESLint/Prettier/Vitest; add `cargo clippy`/`test` for the UI crate; keep a browser smoke of drop → radar if possible.

## Port map (`apps/web/src` → roughly)

| Today | Leptos equivalent |
|---|---|
| `App.tsx` state + worker | Root component + `provide_context` / signals; `web_sys::Worker` |
| `parseWorker.ts` | Keep JS **or** `cs2analyzer-parse-worker` cdylib |
| `types.ts` | `cs2analyzer::types` via serde-wasm-bindgen or typed arrays only |
| `stats.ts`, `sample.ts`, `review.ts` | `analysis.rs` + small UI helpers |
| `RadarCanvas.tsx` | Imperative `RadarView` using `web_sys` |
| `Hud`, `Scoreboard`, `Economy`, `SpectatorEconomy`, `Sidebar`, … | Leptos components, same CSS classes (`index.css` can stay) |
| `weapons.ts` / `loadout.tsx` | Rust maps aligned with `inventory.rs` (one source of truth) |
| `index.css` | Unchanged; class names are the stable contract |

## Pitfalls

- **Two WASMs.** UI crate + parser crate means two `init()`s or one merged crate. Merging makes the UI binary pull `source2-demo` (large). Prefer two modules: parser worker vs thin UI.
- **No mimalloc in WASM.** UI crate must also use `cs2analyzer` with `default-features = false`.
- **Typed arrays.** Do not JSON-serialize tick buffers. Keep SoA + `FLAG_*` bits. Leptos should hold `js_sys::Float32Array` or copied `Vec` once at parse-done, not per frame.
- **`currentRound` / yaw / OT scores.** Copy the rules in `AGENTS.md`; do not “simplify” during the port.
- **HMR / draw tools.** Expect slower UI iteration. Stroke/erase state is ref-based today because React must not re-render at 60 fps; the same constraint exists in Leptos — do not put `tick` into a signal that rerenders the canvas DOM every frame. Drive the canvas from rAF reading a `Cell<u32>` / `AtomicU32` tick.
- **CI.** Replace `apps/web` npm scripts; do not leave a half-migrated Vite app in the same job.

## When not to migrate

Stay on React if the next six months of work is features (clutches, more FACEIT columns, better review), not language purity. The costly bugs so far (KAST, ADR, OT score) were **formulas**, not the UI framework.
