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

# --upgrade argument handling. No network: these must fail before cargo/npm.
if "$ROOT/scripts/run.sh" --update --upgrade >"${scratch}/excl.out" 2>"${scratch}/excl.err"; then
  fail "--update and --upgrade together should exit 1"
fi
grep -F -q 'mutually exclusive' "${scratch}/excl.err" || fail "mutual exclusion message"
if "$ROOT/scripts/run.sh" --upgrade --update >"${scratch}/excl.out" 2>"${scratch}/excl.err"; then
  fail "--upgrade and --update together should exit 1"
fi

if "$ROOT/scripts/run.sh" --latest >"${scratch}/latest.out" 2>"${scratch}/latest.err"; then
  fail "--latest alone should exit 1"
fi
grep -F -q -- '--latest requires --upgrade' "${scratch}/latest.err" \
  || fail "--latest alone should say it requires --upgrade"
if "$ROOT/scripts/run.sh" --update --latest >"${scratch}/latest.out" 2>"${scratch}/latest.err"; then
  fail "--latest with --update should exit 1"
fi
grep -F -q -- '--latest requires --upgrade' "${scratch}/latest.err" \
  || fail "--latest with --update should say it requires --upgrade"

peer_args="$(LATEST=0 ncu_upgrade_args | paste -sd' ' -)"
[[ "$peer_args" == "-u --peer" ]] || fail "default upgrade should pass --peer (got: ${peer_args})"
latest_args="$(LATEST=1 ncu_upgrade_args | paste -sd' ' -)"
[[ "$latest_args" == "-u" ]] || fail "--latest should drop --peer (got: ${latest_args})"

# Hide cargo-upgrade even when it is installed. run.sh does not put it back on PATH.
if (
  PATH="/usr/bin:/bin"
  hash -r
  require_cargo_edit
) 2>"${scratch}/edit.err"; then
  fail "missing cargo-edit should exit 1"
fi
grep -F -q 'cargo install cargo-edit' "${scratch}/edit.err" \
  || fail "preflight should tell the user to cargo install cargo-edit"

# cmd_upgrade must hit that preflight before any upgrade command.
if (
  require_cargo_edit() {
    die "cargo upgrade (cargo-edit) is missing. Install it with: cargo install cargo-edit"
  }
  cmd_upgrade
) 2>"${scratch}/wire.err"; then
  fail "cmd_upgrade should stop when cargo-edit is missing"
fi
grep -F -q 'cargo install cargo-edit' "${scratch}/wire.err" \
  || fail "cmd_upgrade should run the cargo-edit preflight"
grep -F -q 'failed during: cargo-edit preflight' "${scratch}/wire.err" \
  || fail "preflight failure should name its step"

guard_repo="${scratch}/guard-repo"
mkdir -p "$guard_repo/apps/web/src/parser" "$guard_repo/crates/demo"
printf '[workspace]\nmembers = ["crates/demo"]\n' >"$guard_repo/Cargo.toml"
printf '[package]\nname = "demo"\nversion = "0.1.0"\n' >"$guard_repo/crates/demo/Cargo.toml"
printf '{}\n' >"$guard_repo/Cargo.lock"
printf '{"name":"web"}\n' >"$guard_repo/apps/web/package.json"
printf '{"lockfileVersion":3,"packages":{}}\n' >"$guard_repo/apps/web/package-lock.json"
printf 'ok\n' >"$guard_repo/apps/web/src/parser/cs2analyzer_wasm.js"
git -C "$guard_repo" init -q
git -C "$guard_repo" add .
git -C "$guard_repo" \
  -c user.email=test@example.com \
  -c user.name=test \
  -c commit.gpgsign=false \
  commit -qm init

(
  ROOT="$guard_repo"
  require_clean_dependency_tree --upgrade
) || fail "clean dependency tree should pass"

echo dirty >>"$guard_repo/README.md"
(
  ROOT="$guard_repo"
  require_clean_dependency_tree --upgrade
) || fail "files outside the dependency tree should be ignored"

printf '\n# dirty\n' >>"$guard_repo/crates/demo/Cargo.toml"
if (ROOT="$guard_repo" require_clean_dependency_tree --upgrade) 2>"${scratch}/dirty.err"; then
  fail "dirty workspace Cargo.toml should be refused"
fi
grep -F -q 'crates/demo/Cargo.toml' "${scratch}/dirty.err" \
  || fail "dirty message should name the Cargo.toml"
grep -F -q 'before running --upgrade' "${scratch}/dirty.err" \
  || fail "dirty message should name --upgrade"
git -C "$guard_repo" checkout -q -- crates/demo/Cargo.toml

printf '\n# dirty\n' >>"$guard_repo/Cargo.lock"
if (ROOT="$guard_repo" require_clean_dependency_tree --update) 2>"${scratch}/dirty.err"; then
  fail "dirty Cargo.lock should be refused"
fi
grep -F -q 'Cargo.lock' "${scratch}/dirty.err" || fail "dirty message should name Cargo.lock"
grep -F -q 'before running --update' "${scratch}/dirty.err" \
  || fail "dirty message should name --update"

# Cargo.lock is still dirty. A failure before any edits must leave it that way.
(
  ROOT="$guard_repo"
  UPGRADE_STEP="cargo-edit preflight"
  UPGRADE_MUTATED=0
  UPGRADE_TMP_FILES=()
  false || upgrade_report_failure
) 2>"${scratch}/norestore.err"
grep -F -q 'failed during: cargo-edit preflight' "${scratch}/norestore.err" \
  || fail "preflight failure should name its step"
if grep -F -q 'restored' "${scratch}/norestore.err"; then
  fail "a failure before any edits should not restore the tree"
fi
git -C "$guard_repo" diff --quiet -- Cargo.lock \
  && fail "Cargo.lock should still be dirty before a mutating failure"

echo changed >>"$guard_repo/apps/web/src/parser/cs2analyzer_wasm.js"
echo extra >"$guard_repo/apps/web/src/parser/extra.js"
(
  ROOT="$guard_repo"
  UPGRADE_STEP="npm install"
  UPGRADE_MUTATED=1
  UPGRADE_TMP_FILES=()
  false || upgrade_report_failure
) 2>"${scratch}/restore.err"
grep -F -q 'failed during: npm install' "${scratch}/restore.err" \
  || fail "restore failure should name the step"
grep -F -q 'restored to its pre-run state' "${scratch}/restore.err" \
  || fail "mutating failure should say the tree was restored"
git -C "$guard_repo" diff --quiet -- Cargo.lock apps/web/src/parser/cs2analyzer_wasm.js \
  || fail "Cargo.lock and parser output should be restored"
test ! -e "$guard_repo/apps/web/src/parser/extra.js" \
  || fail "untracked parser file should be removed"
grep -F -q dirty "$guard_repo/README.md" \
  || fail "files outside the dependency tree should stay dirty"

# 0.x minor bumps count as major; 1.x minor bumps do not.
is_major_bump 1.2.3 2.0.0 || fail "1.x to 2.x is a major bump"
is_major_bump 1.2.3 1.9.0 && fail "1.x minor is not a major bump"
is_major_bump 0.2.1 0.3.0 || fail "0.x minor is a major bump"
is_major_bump 0.2.1 0.2.9 && fail "0.x patch is not a major bump"
is_major_bump 0.9.0 1.0.0 || fail "0.x to 1.x is a major bump"
is_major_bump 2.0.0 1.5.0 && fail "a downgrade is not a major bump"
version_list_is_major_bump "1.0.0,2.0.0" "2.0.1" && fail "highest version staying on 2.0 is not major"
version_list_is_major_bump "0.2.4" "0.4.0,0.2.5" || fail "0.x minor among versions is major"

echo "scripts/run.test.sh: ok"
