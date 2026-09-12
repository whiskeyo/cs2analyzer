#!/usr/bin/env bash
# Presence-only parser guards in scripts/run.sh (CI owns byte drift).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/run.sh
. "$ROOT/scripts/run.sh"

fail() {
  echo "fail: $*" >&2
  exit 1
}

parser_artifacts_complete || fail "committed apps/web/src/parser/ should be complete"

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
PARSER_DIR="$scratch"
parser_artifacts_complete && fail "empty dir should be incomplete"

for name in "${PARSER_ARTIFACTS[@]}"; do
  : >"${scratch}/${name}"
done
parser_artifacts_complete && fail "zero-byte artifacts should be incomplete"

for name in "${PARSER_ARTIFACTS[@]}"; do
  echo ok >"${scratch}/${name}"
done
parser_artifacts_complete || fail "non-empty bindgen outputs should be complete"

missing="${PARSER_ARTIFACTS[0]}"
rm "${scratch}/${missing}"
parser_artifacts_complete && fail "missing ${missing} should be incomplete"

if (have_wasm_toolchain() { return 1; }
  ensure_parser_artifacts) 2>"${scratch}/err"; then
  fail "ensure_parser_artifacts should die without a toolchain"
fi
grep -q 'run scripts/run.sh --build-wasm' "${scratch}/err" || fail "die message should mention --build-wasm"

echo "scripts/run.test.sh: ok"
