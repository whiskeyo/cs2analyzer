# Why did a demo stop parsing after a CS2 update?

GOTV files are Source 2 protobufs. This app reads them with the [`source2-demo`](https://crates.io/crates/source2-demo) crate. Valve can change those messages after a game update, so a drop that used to work can fail until the crate is bumped.

If you are only watching demos, wait for a site update and re-drop the `.dem`. A stale parser cache in this browser can look the same.

## Do not patch generated proto

Do not hand-edit generated protobuf bindings. Bump the crate, rebuild, and re-test.

## Bump the crate

`source2-demo` is a workspace dependency in the root `Cargo.toml` (`default-features = false`, `cs2` feature). Check [crates.io](https://crates.io/crates/source2-demo) for a release that includes the new CS2 protos, raise the version there, and refresh `Cargo.lock`. Keep those features. WASM already disables `mimalloc` and `match-stats`.

## Rebuild, re-test, redeploy

Run the usual Rust checks, then `./scripts/build-wasm.sh`. Commit the generated `apps/web/src/parser/` bindings with the bump — CI fails if they drift.

Parse a post-update GOTV `.dem` with `cs2analyzer-cli`, then **re-drop the demo** in the viewer. If JSON field names changed, update `apps/web/src/lib/parse/decode.ts` in the same change.

A push to `master` deploys the viewer (upload to staging, then swap). Never wipe the live folder first.
