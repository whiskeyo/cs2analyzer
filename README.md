# CS2 Analyzer

Rust library and local-first website for Counter-Strike 2 demo analysis.

Drop a `.dem` file in the browser to parse it with WebAssembly (the file never leaves your machine), then replay the match on a 2D radar: players, grenade trajectories, shot tracers, and a per-player scoreboard (K/D/A, ADR, KAST, HS%, first kills, utility damage).

## Layout

```
crates/cs2analyzer       Native library (parse + stats + radar math)
crates/cs2analyzer-cli   `cs2analyzer parse match.dem`
crates/cs2analyzer-wasm  wasm-bindgen wrapper
apps/web                 Vite + React 2D viewer
```

## Native library

```rust
use cs2analyzer::{parse_demo, ParseOptions, calibration};

let bytes = std::fs::read("match.dem")?;
let m = parse_demo(&bytes, ParseOptions::default())?;
println!("{}  {}-{}", m.header.map_name, m.header.score_ct, m.header.score_t);
if let Some(cal) = calibration(&m.header.map_name) {
    let (px, py) = cal.world_to_radar(m.ticks.x[0], m.ticks.y[0]);
}
```

CLI:

```
cargo run -p cs2analyzer-cli -- parse path/to/match.dem
cargo run -p cs2analyzer-cli -- parse path/to/match.dem --json out.json
```

## Website

```
# regenerate WASM bindings after changing the Rust crates
./scripts/build-wasm.sh

cd apps/web
npm install
npm run dev
```

Open the printed localhost URL and drop a GOTV `.dem`.

## Radar images

Overview PNGs under `apps/web/public/maps/` come from [cs2-map-icons](https://github.com/MurkyYT/cs2-map-icons) (extracted from the CS2 game files). They are Valve’s property, vendored so this fan project works offline. Do not claim ownership of those assets.

Killfeed and equipment SVGs under `apps/web/public/weapons/` come from [ChetdeJong/cs2-killfeed-generator](https://github.com/ChetdeJong/cs2-killfeed-generator) (MIT) and [Juknum/counter-strike-icons](https://github.com/Juknum/counter-strike-icons) (Valve panorama icons). Same rule: vendored for offline use, not ours.

## Notes

- Demos do not store full bullet physics. Tracers are drawn from `weapon_fire` along the shooter’s look direction.
- `source2-demo` protobufs can break after CS2 updates; bump that crate and re-test.
- Parsing runs in a Web Worker. Large demos (200–400 MB) need a few seconds and a decent amount of RAM.
