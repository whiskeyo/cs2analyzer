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

**Viewer (TypeScript).** Playback, radar canvas, HUD, and live stats live in `apps/web`. The UI **recomputes** scoreboard stats in `lib/stats/stats.ts` as you scrub. WASM does not ship a whole-match stats snapshot — use the CLI for a Rust-side tally. After parser changes, rebuild WASM **and re-drop the demo**. UI-only work does not need a re-drop. A serde rename in the parser is caught by `lib/parse/decode.ts` instead of producing a blank radar.

**Layouts.** Polygons are radar-pixel coordinates on Valve’s 1024 overview. The editor saves JSON the viewer already knows how to load.

```
crates/cs2analyzer       Parse, assemble Match, stats, radar math
crates/cs2analyzer-cli   `cs2analyzer` binary: dump a demo as JSON
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

# Native CLI: JSON to stdout, progress to stderr
cargo run --release -p cs2analyzer-cli -- .demos/your.dem            # summary
cargo run --release -p cs2analyzer-cli -- .demos/your.dem -s replay  # everything, for fixtures

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

## TODOs to remember

web app:

- [ ] make the killfeed stay a little bit longer
- [ ] change the "headshot" icon on the killfeed, currently it's not really readable
- [ ] add steam trade link as a "donation" form
- [ ] somehow organize the main page so it looks nicer - having everything centered (as it is now) is fine, but with the growing list of saved notes, it's quite annoying; 
      maybe left-right layout with notes split into 10-item pages would be good? then the bottom of the page could be used for copyright, vendor information, github link etc.
- [ ] maybe introduce some kind of user settings so it's easier to configure everything how user likes it; at this point i have no particular idea about it, so i'm open for suggestions
- [ ] link github repo (after it's set to public), link to Issues for reporting bugs, the template for bug reports
- [ ] multi-demo environment: overlaying a few demos of the same team would allow tracking the same player's behaviors -> how to do it? can it be executed multi-threaded? 
      how to map different kinds of rounds/plays from different matches? e.g.
      -> game A starts with player X starting on T side; which means CT side starts in R13, so CT pistol = R13, but in game B the player X starts on CT side, so CT pistol = R1
      -> game A has 2 eco rounds where player X was playing in CT, but in game B there are 0 eco rounds (do not count pistol!!!), and in game C there are 3 eco rounds
      -> in game A player X throws similar set of grenades, in game B the same grenades are utilized, but in game C his behavior is completely different
      how would it store the data efficiently, to allow moving between demos? what's the hard limit of concurrent demos that could be analyzed?
- [ ] in saved notes, instead of printing the map name only (apart from the demo name, etc.), print more data, it could look like this:

      Inferno: EYEBALLERS - Phantom, 17:19 (6:6, 6:6, OT 5:7)
      eyeballers-vs-phantom-m2-inferno.dem
      163 drawings - 09.08.2026, 12:33:12

      Also, hovering the note could show the final stats of players at the end of the game 
- [ ] moving far away from the map shows the "outline" of png - remove it
- [ ] find out what causes issues printed to console on the deployed page:

      ```log
      Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received
      `WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:
      TypeError: Failed to execute 'compile' on 'WebAssembly': Incorrect response MIME type. Expected 'application/wasm'.
      B @ /assets/parseWorker-D_yCwlkP.js:1
      index-Bvqt1KJN.css:1  Failed to load resource: the server responded with a status of 404 ()
      parseWorker-D_yCwlkP.js:1 `WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:
      TypeError: Failed to execute 'compile' on 'WebAssembly': Incorrect response MIME type. Expected 'application/wasm'.
      ```

layout/callouts dev app:

- [ ] allow grouping callouts for easier analysis, e.g. { "stairs", "tetris", "jungle", "A site", "shadow", "GetRight" } belong to A side of the map
- [ ] allow reordering callouts, so the analysis page (e.g. Util in web) shows nearby places from the game next to each other

backend/WASM:

- [ ] find out if there can be something done to improve the performance of demo parsing, what data is exactly needed, what is dropped

CI:

- [ ] add coverage to all apps - both rust and js, so i know how much i can trust the code
- [ ] consider some kind of E2E tests, but these would require uploading demos somewhere and then fetching them with the job, which might be slow :(
