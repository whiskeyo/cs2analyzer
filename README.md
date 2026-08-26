# CS2 Analyzer

Local-first Counter-Strike 2 GOTV demo analyzer. Drop a `.dem` in the browser: it is parsed on your machine (Web Worker + WASM), then you can replay the match on a 2D radar and inspect FACEIT-style stats.

The file never leaves the computer. This is a fan project, not affiliated with Valve.

## What the app does

The viewer (`apps/web`, http://localhost:5173/) is the product:

- Parse a GOTV demo in the browser and keep a tick-by-tick replay
- 2D radar: players, yaw, grenades, shot tracers, bomb, freeze / C4 HUD
- Scoreboard through the current tick: K/D/A, ADR, KAST, HS%, first kills, utility, side swaps and overtime
- Sidebar: Review, Notes (drawings, clocks, bookmarks), Action (executes / round story), Util, Clutches, Rounds, Weapons
- Callout names on Action/Util come from per-map layout JSON. Empty layout → positions stay hidden

A second local app (`apps/layouts`, http://localhost:5174/) draws those callout polygons and writes `apps/web/public/layouts/{map}.json`. It is not deployed.

## Architecture

```
.dem  →  Web Worker + WASM  →  Match / Replay  →  React viewer (radar + sidebar)
                                      ↑
                         layout JSON + radar PNGs (local assets)
```

**Parse (Rust).** `crates/cs2analyzer` walks the demo, then assembles a `Match`: header, rounds, kills, hurts, blinds, grenades, bomb events, and a structure-of-arrays tick buffer (`frame * playerCount + player`). Pipeline: `observer.rs` → `assemble.rs` → `analysis.rs`.

**WASM.** `crates/cs2analyzer-wasm` is a thin `wasm-bindgen` wrapper (no `mimalloc`). `./scripts/build-wasm.sh` emits generated JS into `apps/web/src/parser/` — do not edit that folder by hand. Keep `wasm-bindgen-cli` at **0.2.127**.

**Viewer (TypeScript).** Playback, radar canvas, HUD, and live stats live in `apps/web`. The UI **recomputes** scoreboard stats in `lib/stats/stats.ts` as you scrub; WASM `statsJson` is only a snapshot at parse time. After parser changes, rebuild WASM **and re-drop the demo**. UI-only work does not need a re-drop.

**Layouts.** Polygons are radar-pixel coordinates on Valve’s 1024 overview. The editor saves JSON the viewer already knows how to load.

```
crates/cs2analyzer       Parse, assemble Match, stats, radar math
crates/cs2analyzer-wasm  wasm-bindgen wrapper
apps/web                 Vite + React viewer
apps/layouts             Callout overlay editor (local only)
scripts/build-wasm.sh    Rebuild WASM → apps/web/src/parser/
.demos/                  Local GOTV files (gitignored)
```

Web `src/` is view vs logic: `components/` (TSX) and `lib/<feature>/` (hooks + pure code). Tests sit next to the module they cover.

| Goal | Start here |
|---|---|
| Demo events, rounds, knife detect | `crates/cs2analyzer/src/observer.rs`, `assemble.rs` |
| ADR, KAST, trades, team scores | `analysis.rs` **and** `apps/web/src/lib/stats/stats.ts` |
| Tick sampling, `currentRound` | `apps/web/src/lib/replay/sample.ts` |
| Radar, yaw, nades, shots | `components/radar/RadarCanvas.tsx`, `lib/radar/` |
| HUD / scoreboard | `components/radar/Hud.tsx`, `components/sidebar/Scoreboard.tsx` |
| Notes / bookmarks | `components/sidebar/Notes.tsx`, `lib/notes/` |
| Playhead, hotkeys, round strip | `lib/playback/`, `components/playback/` |
| Parse worker / drop | `lib/parse/` |
| Executes, clutches, util | `lib/match/`, matching tab in `components/sidebar/` |
| Callout overlays | `apps/layouts`; JSON in `apps/web/public/layouts/` |

More domain rules (knife rounds, ADR caps, trades, OT score) are in `AGENTS.md`.

## Working on the repo

Rust and Node 22. First time:

```
./scripts/build-wasm.sh   # if parser/ WASM is missing
cd apps/web && npm install && npm run dev
```

Open the printed URL and drop a GOTV `.dem`. Keep demos in `.demos/` (never commit them).

```
# Rust
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

# WASM — after changing the parser or its types
./scripts/build-wasm.sh

# Viewer
cd apps/web
npm run dev                                          # http://localhost:5173/
npm run format:check && npm run lint && npm run typecheck && npm test

# Callout editor (not deployed)
cd apps/layouts
npm install                                          # first time
npm run dev                                          # http://localhost:5174/
# Save to folder writes apps/web/public/layouts/{map}.json
```

CI runs the same Rust, web, and layouts checks, plus a production build of the viewer.

Keep changes small and one concern per commit (parser vs UI vs stats). When a stats formula changes, update both Rust and `lib/stats/stats.ts` and add a test on the side you touched. Named CS2/FACEIT values belong in `apps/web/src/lib/shared/constants.ts` and `crates/cs2analyzer/src/constants.rs`, not magic numbers.

## Assets

Radar PNGs under `apps/web/public/maps/` come from [cs2-map-icons](https://github.com/MurkyYT/cs2-map-icons) (extracted from CS2). Killfeed and equipment SVGs under `apps/web/public/weapons/` come from [ChetdeJong/cs2-killfeed-generator](https://github.com/ChetdeJong/cs2-killfeed-generator) (MIT) and [Juknum/counter-strike-icons](https://github.com/Juknum/counter-strike-icons). Vendored for offline use; do not claim ownership.

Demos do not store full bullet physics — tracers follow `weapon_fire` look direction. `source2-demo` protobufs can break after CS2 updates; bump that crate and re-test rather than patching generated proto by hand. Large demos (200–400 MB) need a few seconds and a decent amount of RAM.
