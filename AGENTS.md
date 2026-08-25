# AGENTS.md

Local-first CS2 GOTV demo analyzer. whiskeyo is the owner. Prefer working in code: implement, debug, iterate. Do not commit unless asked.

Parse a `.dem` in the browser (Web Worker + WASM; the file never leaves the machine), replay it on a 2D radar, and show FACEIT-style stats.

## Layout

```
crates/cs2analyzer       Parse, assemble Match, stats, radar math
crates/cs2analyzer-wasm  wasm-bindgen wrapper (no mimalloc)
apps/web                 Vite + React viewer (dev: http://localhost:5173/)
scripts/build-wasm.sh    Rebuild WASM → apps/web/src/parser/
.demos/                  Local GOTV files (gitignored; never commit)
```

Parser pipeline: `observer.rs` (tick walk) → `assemble.rs` (`Match`) → `analysis.rs` (stats). The web UI **recomputes** live stats in `apps/web/src/stats.ts`; WASM `statsJson` is a snapshot at parse time. After parser changes, rebuild WASM **and re-drop the demo**. UI-only stats/HUD changes apply without a re-drop.

Do not edit `apps/web/src/parser/` by hand. Keep `wasm-bindgen-cli` at **0.2.127** (same as the `wasm-bindgen` crate). WASM disables the `mimalloc` feature (`default-features = false`).

## Commands

```
# Rust
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings   # unwrap/expect denied outside tests
cargo test --workspace

# WASM (after Rust parser/types changes)
./scripts/build-wasm.sh

# Web
cd apps/web
npm install          # first time
npm run dev
npm run format:check && npm run lint && npm run typecheck && npm test
```

CI (`.github/workflows/ci.yml`) runs the same Rust and web checks, plus `npm run build`. Push to `master`/`main` also FTPs `apps/web/dist` to OVH: upload to `/cs2analyzer_staging/`, then rename over `/cs2analyzer/` (Vite `base` is `/` because that folder is the subdomain document root). Never wipe the live folder first.

## Where to change what

| Goal | Start here |
|---|---|
| Demo events, hurts, rounds, knife detect | `crates/cs2analyzer/src/observer.rs`, `assemble.rs` |
| ADR, KAST, trades, team scores | `analysis.rs` **and** `apps/web/src/stats.ts` (keep them aligned) |
| Tick sampling, `currentRound` | `apps/web/src/sample.ts` |
| Radar, yaw, nades, shots | `apps/web/src/RadarCanvas.tsx`, `radar/` |
| HUD / scoreboard labels | `Hud.tsx`, `Scoreboard.tsx`, `liveTeams()` in `stats.ts` |
| Notes layers / clocks | `Notes.tsx`, `overlay/`, `notes/` |
| Weapon icons / def indices | `inventory.rs` + `apps/web/src/weapons.ts` + `public/weapons/*.svg` |
| Review tab | `apps/web/src/review.ts` |

Tick buffers are structure-of-arrays: index = `frame * playerCount + player`. Flags: `PRESENT`, `ALIVE`, `DUCKED`, `SCOPED`, `CT` (`1<<4`). Max 16 player slots (`MAX_PLAYERS`).

## Named values (no magic numbers)

Do not drop unexplained numeric literals into parser, stats, or UI logic. Put CS2 / FACEIT values in `apps/web/src/constants.ts` and `crates/cs2analyzer/src/constants.rs` (keep both sides aligned when the number is shared) and use the name.

Examples: tick rate `64`, full HP `100`, knife-round equipment `200`, eco `2000`, MR12 `12`/`24`/`3`, trade window `5s`, bomb `40s`, defuse `5`/`10s`, grenade linger times, HLTV rating weights, round-win reason codes.

OK as raw literals: `0` / `1` / `-1` sentinels, loop indexes, `x` / `y` / `z`, test fixture ticks, and purely visual canvas/CSS pixels.

Prefer full words in identifiers (`entry`, `headshots`, `entity`, `kills_per_round`, `headshot_percent`). Industry scoreboard acronyms that we also show in the HUD may stay (`adr`, `kast`, `kd`).

## Domain rules (easy to get wrong)

- **`currentRound`**: last round with `start_tick <= tick` (not “round that contains tick” by `end_tick`).
- **Knife rounds**: max equipment value under 200 and no gun kill (FACEIT 0–0 reset). Number `0`, label “Knife”. Playback should start at the first non-knife freeze.
- **Yaw**: stored raw `m_angEyeAngles`. Canvas: `yawToCanvas = ((-yaw + 180) * π) / 180`. Do not “fix” this without checking the radar.
- **Grenades on radar**: skip throws whose `start_tick` is outside the current round.
- **C4 HUD**: hide on defuse/explode, 40s timeout, next round, **or all CTs dead with bomb planted**. Round `end_tick` prefers `m_iRoundWinStatus` (synth win), not `round_officially_ended` (that tick is often the next freeze). Defuse timer needs `bomb_begindefuse` / `bomb_abortdefuse` (kit 5s, no kit 10s).
- **Freeze**: `start_tick` is round start / freeze; `freeze_end_tick` is `round_freeze_end`. Demos include freeze; playback and round jumps land on freeze end. HUD freeze countdown + “Skip freeze” while `tick < freeze_end_tick`. Home also jumps to freeze end.
- **ADR**: enemy-only health damage, capped at remaining HP (reset to 100 each competitive round). Not raw `dmg_health` sums.
- **Trades / KAST**: a trade is a *teammate of the victim* killing the attacker within **5s**. The killer’s next frag is **not** a trade. Survive-KAST only if the player was present at freeze.
- **Score / OT**: do not tally CT vs T round wins as team score. Track starting-side team wins, detect swaps from pawn `FLAG_CT` vs `start_side` (MR12 + OT blocks of 3 as fallback). Header `team_ct` / `team_t` are **starting** sides (first non-knife freeze). `Round.team_ct` / `team_t` are names at that freeze (follow swaps). HUD uses `liveTeams()`.
- Tracers are look-direction from `weapon_fire`, not bullet physics. GOTV ≠ hit registration; pitch is not stored.

FACEIT-style targets for a 30-round OT game: team score follows sides (e.g. 14–16, not 9–21); KAST is not 100 for everyone; ADR is ~damage/rounds with overkill stripped.

## Adding changes

1. Read the existing function before extending it. Match naming and structure in the file you touch.
2. **Every change should be as small as possible.** Do not bundle unrelated edits. One behavior, one fix, or one feature per diff — then stop. **Every functionality needs its own commit** (do not squash “text notes + sidebar + timeline” into one). **Cap a commit at about 1000 lines** (`git diff --stat`). Split by concern (parser vs UI vs stats vs CI). A larger commit is OK only when the change **cannot be smaller** (generated WASM, lockfile + one feature, rustfmt of a huge file, vendored assets).
3. Mirror stats logic in both Rust and `stats.ts` when the formula changes. Add a unit test on the side you touched (`analysis.rs` tests and/or `apps/web/src/stats.test.ts`).
4. After WASM rebuild, tell whiskeyo to **re-drop the demo**. UI-only work: verify the affected flow in the browser (behavior, not a single screenshot). No browser tools: say what you could not click through.
5. Do not add README/docs unless asked. Do not edit plan files. Do not commit `.demos/`, `.env`, or secrets. `apps/web/src/parser/` is generated — commit it only together with the parser change that produced it.
6. Do not commit unless asked. When asked: one commit per functionality, follow repo commit style, HEREDOC message focused on **why**, no `--no-verify`. Push only when asked.

## Web notes

- Prettier print width 100; ESLint 9 flat config. `react-hooks/refs` is off on purpose (playback/canvas keep latest props in refs).
- Ignore generated parser JS in lint/format.
- `computeStats` is cached per `(replay, tick)` — mutate replay identity if tests share an object and expect a recompute.
- Spectator economy: T left, CT right. Scoreboard groups by `currentSide()` at the current tick.

Why the UI is React/TS (and how to move it) is in `docs/frontend-migration.md`. Parser stays Rust either way. FACEIT scoreboard comparison and the analysis backlog are in `docs/faceit-parity.md`.

## Product context

This is a fan project. Radar PNGs and weapon SVGs are vendored Valve/community assets for offline use — do not claim ownership. `source2-demo` protobufs can break after CS2 updates; bump the crate and re-test rather than patching generated proto by hand.
