<p align="center">
  <img src="apps/web/public/favicon.svg" width="96" height="96" alt="CS2 Analyzer" />
</p>

<h1 align="center">CS2 Analyzer</h1>

<p align="center">
  Local-first Counter-Strike 2 GOTV demo analyzer.<br />
  Drop a <code>.dem</code> in the browser — parse, replay, and review on your machine.<br />
  Live at <a href="https://cs2analyzer.whiskeyo.pl">cs2analyzer.whiskeyo.pl</a>
</p>

<p align="center"><em>Fan project. Not affiliated with Valve. Your demos never leave the computer.</em></p>

## What you get

### Single demo & multi-demo analysis
- **Drop one demo** for a full match review: tick-by-tick radar, live scoreboard, and sidebar deep-dives.
- **Drop several demos** for habits analysis: same-map or mixed-map series, focal team filters, buy-type buckets (pistol / eco / force / full), and an aggregated overlay of paths, trails, and heat.
- **Parse in the browser** (Web Worker + WASM) — large GOTV files stay local; nothing is uploaded.

### Radar replay
- 2D overview with players, yaw, loadouts, floors (upper / lower where the map has them).
- Grenades, shot tracers, deaths, openings, names, view cones, heat, and nade summaries — toggle layers as you like.
- Freeze countdown, C4 / defuse timers, live clutch banner, kill feed, and spectator economy.
- Playback: scrub, speeds, skip freeze, round autoplay, keyboard hotkeys, and a round strip with event marks.

### Scoreboard & player detail
- FACEIT-style live board through the current tick: K/D/A, ADR, KAST, rating, entry, money, CT/T splits.
- Side swaps and overtime scored the way you expect from competitive matches.
- Per-player detail: trades, flashes, utility damage, clutches (1v1–1v5 W/A), multikills, plants / defuses.
- Export a full-match **stats CSV** from the header (handy for spreadsheets and rating experiments).

### Review, Action & Utility
- **Review** — openings, clutches, and mistake-style moments you can jump straight into.
- **Action** — round story, executes, plants, retakes, and fights with site / callout labels.
- **Utility** — every throw by kind and place; filter by match or selected player; series mode adds frequency and first-wave util sets.
- **Rounds** — expandable event timeline with configurable lead-in.
- **Weapons** — kill breakdown for the current window or the whole game.

### Notes & drawings
- Draw on the radar: pen, arrow, text, bookmarks; undo / redo; color palettes; moment-timed strokes.
- Layers, clocks, groups, and round-scoped visibility.
- Notes auto-save in the browser; **export / import JSON** backups from Settings; re-link a demo to restore drawings with the match.

### Callout layouts (development)
- In `npm run dev` / `./scripts/run.sh --dev`, Settings → **Layouts editor** lets you draw map callout polygons used by Action and Utility labels.
- Editor is not shipped in production builds.

## Run it locally

Everything goes through [`scripts/run.sh`](scripts/run.sh):

| Flag | What it does |
|---|---|
| `--prepare` | Install Rust toolchain, `wasm-bindgen-cli`, and npm deps |
| `--update` | Update Rust and npm deps within current semver ranges, keep `wasm-bindgen` pinned to the CLI, rebuild WASM, and run tests. Does not commit. |
| `--upgrade` | Bump Rust and npm deps to the newest peer-compatible versions, including outside current semver ranges. Skips the `=0.5.8` `source2-demo` pin, every `wasm-bindgen*` crate, `js-sys`, and `web-sys`. Rebuilds WASM, runs tests, then the production build. Does not commit. Restores the dependency tree on failure. |
| `--latest` | With `--upgrade` only. Take the newest versions even when they break peer dependencies. |
| `--build-wasm` | Compile the parser WASM into the web app |
| `--check` | rustfmt, clippy, prettier, eslint, typecheck |
| `--test` | Rust + web test suites |
| `--dev` | Dev server at http://localhost:5173/ (layouts editor at `/layouts`) |
| `--prod` | Production build + preview (default http://localhost:4173/) |

`--update` and `--upgrade` need a clean dependency tree: every workspace `Cargo.toml`, `Cargo.lock`, `apps/web/package.json`, `apps/web/package-lock.json`, and `apps/web/src/parser/`. Commit or stash those first. The two flags are mutually exclusive.

### `--upgrade`

`--update` stays inside the ranges already written in the manifests. `--upgrade` rewrites those ranges to the newest published versions that still satisfy peer dependencies (`npm-check-updates --peer`), refreshes the lockfiles, rebuilds WASM, and runs the Rust tests, the web tests, and `npm run build` (the production prerender). It prints a table of resolved version changes and leaves the diff in the working tree. It does not commit.

`--upgrade --latest` drops `--peer` and takes the newest versions even when another package's peer range cannot accept them. `--latest` on its own is an error.

If a step fails after files have changed, or the run is interrupted with Ctrl-C or SIGTERM, the script puts every workspace `Cargo.toml`, `Cargo.lock`, `apps/web/package.json`, `apps/web/package-lock.json`, and `apps/web/src/parser/` back to the pre-run state, runs `npm ci` in `apps/web` so `node_modules` matches that lock, and does that restore only once. A failed step names the step and exits non-zero. Ctrl-C exits 130 and SIGTERM exits 143. If `npm ci` fails, it tells you to run that command manually and does not try again. A second interrupt during that restore leaves whatever was already restored in place and prints once: check `git status`, then run `npm ci` in `apps/web`.

Not a CI step. On success, review `git diff` and commit the bumps you want to keep.

Requires [cargo-edit](https://github.com/killercup/cargo-edit) (`cargo install cargo-edit`). npm packages are bumped with `npx npm-check-updates@22` (no global install). Major 23 rejects Node 24.11 (`^24.15.0`); major 22 accepts `>=24`.

Left unchanged:

- `source2-demo`, `source2-demo-macros`, and `source2-demo-protobufs` — pinned to `=0.5.8` in the workspace `Cargo.toml` (the last two are dev-dependencies of `cs2analyzer` only to hold the lock). `0.5.9` changes view-angle decoding; lift the pin with a real-demo angle test.
- `wasm-bindgen*` — the whole family stays on the `wasm-bindgen-cli` pin in `scripts/build-wasm.sh` (currently 0.2.127). A bump to 0.2.129 is a separate decision.
- `js-sys` and `web-sys` — each release exact-pins `wasm-bindgen`, so the newest one would move that pin.

`--upgrade` uses that as one skip list for `cargo upgrade --exclude` and for the `cargo update -p name@version` filter (prefix match for `wasm-bindgen*`). `--latest` does not drop it, and the Cargo step does not pass `--pinned` for those crates.

Typical first run:

```bash
./scripts/run.sh --prepare --build-wasm --dev
```

Flags combine and run in the order above. `--dev` and `--prod` are mutually exclusive and block while the server is up. `--update` and `--upgrade` are mutually exclusive.

## Credits

Radar map images are vendored from [cs2-map-icons](https://github.com/MurkyYT/cs2-map-icons). Weapon / killfeed icons from [ChetdeJong/cs2-killfeed-generator](https://github.com/ChetdeJong/cs2-killfeed-generator) and [Juknum/counter-strike-icons](https://github.com/Juknum/counter-strike-icons). Offline use only — we do not claim ownership of those assets.

## License

MIT — see [LICENSE](LICENSE).

