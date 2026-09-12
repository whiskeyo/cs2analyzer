#!/usr/bin/env bash
# Compile cs2analyzer-wasm and emit JS bindings for the Vite app.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$ROOT/target}"
PROFILE="wasm-release"
OUT="$ROOT/apps/web/src/parser"
TARGET="$CARGO_TARGET_DIR/wasm32-unknown-unknown/$PROFILE/cs2analyzer_wasm.wasm"
BINDGEN_VERSION="0.2.127"

mkdir -p "$OUT"

if ! command -v wasm-bindgen >/dev/null 2>&1 || [[ "$(wasm-bindgen --version 2>/dev/null | awk '{print $2}')" != "$BINDGEN_VERSION" ]]; then
  echo "Installing wasm-bindgen-cli $BINDGEN_VERSION..."
  cargo install wasm-bindgen-cli --version "$BINDGEN_VERSION" --locked
fi

echo "Building wasm32 $PROFILE..."
cargo build -p cs2analyzer-wasm --profile "$PROFILE" --target wasm32-unknown-unknown --manifest-path "$ROOT/Cargo.toml"

if [[ "${SKIP_WASM_OPT:-}" == "1" ]]; then
  echo "SKIP_WASM_OPT=1; skipping post-link shrink (match CI / laptop without binaryen)"
elif command -v wasm-opt >/dev/null 2>&1; then
  echo "Running wasm-opt..."
  wasm-opt -O3 --enable-bulk-memory --strip-debug "$TARGET" -o "$TARGET"
else
  echo "wasm-opt not found; skipping post-link shrink (install binaryen for smaller/faster wasm)"
fi

echo "Generating JS bindings..."
wasm-bindgen "$TARGET" --target web --out-dir "$OUT" --out-name cs2analyzer_wasm

echo "Wrote $OUT"
ls -lh "$OUT"
