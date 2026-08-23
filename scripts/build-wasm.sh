#!/usr/bin/env bash
# Compile cs2analyzer-wasm and emit JS bindings for the Vite app.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/apps/web/src/parser"
TARGET="$ROOT/target/wasm32-unknown-unknown/release/cs2analyzer_wasm.wasm"
BINDGEN_VERSION="0.2.127"

mkdir -p "$OUT"

if ! command -v wasm-bindgen >/dev/null 2>&1 || [[ "$(wasm-bindgen --version 2>/dev/null | awk '{print $2}')" != "$BINDGEN_VERSION" ]]; then
  echo "Installing wasm-bindgen-cli $BINDGEN_VERSION..."
  cargo install wasm-bindgen-cli --version "$BINDGEN_VERSION" --locked
fi

echo "Building wasm32 release..."
cargo build -p cs2analyzer-wasm --target wasm32-unknown-unknown --release --manifest-path "$ROOT/Cargo.toml"

echo "Generating JS bindings..."
wasm-bindgen "$TARGET" --target web --out-dir "$OUT" --out-name cs2analyzer_wasm

echo "Wrote $OUT"
ls -lh "$OUT"
