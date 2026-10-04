#!/usr/bin/env bash
# Local workflow: toolchain, dependency updates, WASM, CI checks, tests, and the Vite app.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINDGEN_VERSION="0.2.127"
# One skip list for `cargo upgrade --exclude` and the `cargo update -p` filter.
# `--latest` does not change it and must not pass `--pinned`.
# Exact names: source2-demo, source2-demo-macros, and source2-demo-protobufs
# are pinned to =0.5.8 in the workspace Cargo.toml (the last two are
# dev-dependencies of crates/cs2analyzer only to hold the lock). js-sys and
# web-sys exact-pin a wasm-bindgen release, so a newer one would move that pin.
# Prefix: every crate named wasm-bindgen or wasm-bindgen-* (macro, macro-support,
# backend, shared, futures, and the rest). Those must stay matched to the
# wasm-bindgen-cli pin in scripts/build-wasm.sh (BINDGEN_VERSION, currently
# 0.2.127). Moving the family to 0.2.129 is a separate decision.
UPGRADE_CARGO_SKIP_EXACT=(
  source2-demo
  source2-demo-macros
  source2-demo-protobufs
  js-sys
  web-sys
)
UPGRADE_CARGO_SKIP_PREFIX=(wasm-bindgen)
# npm-check-updates 23 requires Node ^22.22.2, ^24.15.0, or >=26, so Node 24.11
# prints EBADENGINE. Major 22 accepts ^20.19.0, ^22.12.0, or >=24. npx installs
# the newest 22.x. No global install.
NCU_MAJOR=22
WEB="$ROOT/apps/web"
DEV_PORT="${DEV_PORT:-5173}"
PROD_PORT="${PROD_PORT:-4173}"

export PATH="${HOME}/.cargo/bin:${HOME}/.local/bin:${PATH}"
if [[ -f "${HOME}/.cargo/env" ]]; then
  # shellcheck disable=SC1091
  . "${HOME}/.cargo/env"
fi

usage() {
  local excluded
  excluded="$(printf '%s, ' "${UPGRADE_CARGO_SKIP_EXACT[@]}")"
  excluded="${excluded%, }, ${UPGRADE_CARGO_SKIP_PREFIX[*]}*"
  cat <<EOF
Usage: scripts/run.sh [flags]

  --prepare        Install Rust toolchain, wasm-bindgen-cli, and npm deps
  --update         Update crates and npm packages within their current semver
                   ranges, keep wasm-bindgen pinned to the CLI version, rebuild
                   WASM, and run cargo test plus the web suite. Does not commit.
  --upgrade        Bump crates and npm packages to the newest versions that
                   still satisfy peer dependencies (npm-check-updates --peer).
                   Skips ${excluded}. Rebuilds WASM, runs tests, then the
                   production build. Does not commit. On failure, restores
                   the files it changed. Needs cargo-edit
                   (cargo install cargo-edit).
  --latest         With --upgrade only. Skip the peer filter and take the
                   newest versions anyway.
  --build-wasm     Compile WASM and emit JS bindings into apps/web/src/parser/
  --check          rustfmt, clippy, prettier, eslint, typecheck
  --test           cargo test and the web vitest suite
  --dev            Start the Vite dev server (http://localhost:${DEV_PORT}/; layouts at /layouts).
                   Requires complete apps/web/src/parser/ artifacts (auto-builds if the
                   wasm toolchain is already installed).
  --prod           Build the production bundle and preview it (http://localhost:${PROD_PORT}/).
                   Same parser check as --dev, then npm run build.
  --local-network  With --dev or --prod, bind 0.0.0.0 so other devices on the LAN can open it
                   (open the printed LAN IP on the other device — not http://0.0.0.0/)

Flags can be combined. They run in the order above; --dev / --prod are last and block.
Do not pass both --dev and --prod, or both --update and --upgrade.
--latest requires --upgrade. --local-network requires --dev or --prod.
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

log() {
  echo "==> $*"
}

load_nvm() {
  local dir
  for dir in "${NVM_DIR:-}" "${HOME}/.config/nvm" "${HOME}/.nvm"; do
    if [[ -n "$dir" && -s "${dir}/nvm.sh" ]]; then
      export NVM_DIR="$dir"
      # shellcheck disable=SC1091
      . "${dir}/nvm.sh"
      return 0
    fi
  done
  return 1
}

have_node() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1
}

ensure_node() {
  load_nvm || true
  have_node || die "node/npm not found; run scripts/run.sh --prepare"
}

install_node() {
  load_nvm || true
  if have_node; then
    return 0
  fi
  if ! load_nvm; then
    log "Installing nvm"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    load_nvm || die "nvm.sh missing after install (tried \$NVM_DIR, ~/.config/nvm, ~/.nvm)"
  fi
  nvm use default >/dev/null 2>&1 || nvm use node >/dev/null 2>&1 || true
  if have_node; then
    return 0
  fi
  log "Installing Node 22"
  nvm install 22
  nvm use 22
  have_node || die "node/npm missing after nvm install 22"
}

ensure_rust() {
  if ! command -v rustup >/dev/null 2>&1; then
    if command -v rustc >/dev/null 2>&1; then
      die "rustc is installed without rustup; install rustup (https://rustup.rs) to add wasm32, rustfmt, and clippy"
    fi
    log "Installing rustup (stable)"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
    # shellcheck disable=SC1091
    . "${HOME}/.cargo/env"
  fi
  command -v rustc >/dev/null 2>&1 || die "rustc missing after rustup install"
  command -v cargo >/dev/null 2>&1 || die "cargo missing after rustup install"
  if ! command -v cc >/dev/null 2>&1 && ! command -v gcc >/dev/null 2>&1 && ! command -v clang >/dev/null 2>&1; then
    die "need a C compiler (cc, gcc, or clang) to build native crates"
  fi
}

npm_in() {
  local dir="$1"
  shift
  (cd "$dir" && npm "$@")
}

cmd_prepare() {
  ensure_rust
  log "Rust components and wasm32 target"
  rustup component add rustfmt clippy
  rustup target add wasm32-unknown-unknown

  if ! command -v wasm-bindgen >/dev/null 2>&1 || [[ "$(wasm-bindgen --version 2>/dev/null | awk '{print $2}')" != "$BINDGEN_VERSION" ]]; then
    log "Installing wasm-bindgen-cli $BINDGEN_VERSION"
    cargo install wasm-bindgen-cli --version "$BINDGEN_VERSION" --locked
  fi

  log "Fetching Rust crates"
  cargo fetch --manifest-path "$ROOT/Cargo.toml"

  install_node
  log "node $(node -v), npm $(npm -v)"
  log "npm install (web)"
  npm_in "$WEB" install
  log "Prepare done"
}

# Bindgen output the Vite worker imports. Presence-only: CI owns byte drift.
PARSER_DIR="$WEB/src/parser"
PARSER_ARTIFACTS=(
  cs2analyzer_wasm.js
  cs2analyzer_wasm_bg.wasm
  cs2analyzer_wasm.d.ts
  cs2analyzer_wasm_bg.wasm.d.ts
)

parser_artifacts_complete() {
  local name
  [[ -d "$PARSER_DIR" ]] || return 1
  for name in "${PARSER_ARTIFACTS[@]}"; do
    [[ -s "${PARSER_DIR}/${name}" ]] || return 1
  done
  return 0
}

# rustup + pinned wasm-bindgen: enough to run cmd_build_wasm without --prepare.
have_wasm_toolchain() {
  command -v rustup >/dev/null 2>&1 || return 1
  command -v cargo >/dev/null 2>&1 || return 1
  command -v rustc >/dev/null 2>&1 || return 1
  command -v wasm-bindgen >/dev/null 2>&1 || return 1
  [[ "$(wasm-bindgen --version 2>/dev/null | awk '{print $2}')" == "$BINDGEN_VERSION" ]]
}

ensure_parser_artifacts() {
  if parser_artifacts_complete; then
    return 0
  fi
  if have_wasm_toolchain; then
    log "parser artifacts missing or incomplete; building WASM"
    cmd_build_wasm
    parser_artifacts_complete || die "WASM build finished but apps/web/src/parser/ is still incomplete"
    return 0
  fi
  die "apps/web/src/parser/ is missing or incomplete; run scripts/run.sh --build-wasm"
}

cmd_build_wasm() {
  ensure_rust
  rustup target add wasm32-unknown-unknown
  "$ROOT/scripts/build-wasm.sh"
}

cmd_check() {
  ensure_rust
  ensure_node
  log "cargo fmt"
  cargo fmt --all --manifest-path "$ROOT/Cargo.toml" -- --check
  log "cargo clippy"
  cargo clippy --workspace --all-targets --manifest-path "$ROOT/Cargo.toml" -- -D warnings
  log "web format / lint / typecheck"
  npm_in "$WEB" run format:check
  npm_in "$WEB" run lint
  npm_in "$WEB" run typecheck
  log "Checks passed"
}

cmd_test() {
  ensure_rust
  ensure_node
  log "cargo test"
  cargo test --workspace --manifest-path "$ROOT/Cargo.toml"
  log "web tests"
  npm_in "$WEB" test
  log "Tests passed"
}

# True when --upgrade must not bump this crate. Exact names, plus the
# wasm-bindgen* prefix. Shared by cargo upgrade --exclude and cargo update.
upgrade_skips_crate() {
  local name="$1"
  local exact prefix
  for exact in "${UPGRADE_CARGO_SKIP_EXACT[@]}"; do
    if [[ "$name" == "$exact" ]]; then
      return 0
    fi
  done
  for prefix in "${UPGRADE_CARGO_SKIP_PREFIX[@]}"; do
    case "$name" in
      "$prefix" | "$prefix"-*) return 0 ;;
    esac
  done
  return 1
}

# name<TAB>version for each [[package]] in a Cargo.lock (v3 or v4).
cargo_lock_packages() {
  local lock="$1"
  awk '
    $0 == "[[package]]" { in_pkg = 1; name = ""; next }
    in_pkg && $1 == "name" && $2 == "=" {
      name = $3
      gsub(/"/, "", name)
      next
    }
    in_pkg && $1 == "version" && $2 == "=" && name != "" {
      ver = $3
      gsub(/"/, "", ver)
      print name "\t" ver
      in_pkg = 0
    }
  ' "$lock"
}

# name@version for each locked package. cargo update needs the version when
# more than one copy of a crate is locked (foldhash 0.1 and 0.2, for example).
cargo_lock_package_specs() {
  local lock="$1"
  local name version
  while IFS=$'\t' read -r name version; do
    [[ -n "$name" && -n "$version" ]] || continue
    printf '%s@%s\n' "$name" "$version"
  done < <(cargo_lock_packages "$lock")
}

# --exclude names: the exact skip list, the wasm-bindgen prefix itself, and
# every locked crate the prefix matches. cargo-edit matches names exactly.
upgrade_cargo_exclude_names() {
  local lock="$1"
  local name version candidate
  local -a names=()
  local -A seen=()
  for candidate in "${UPGRADE_CARGO_SKIP_EXACT[@]}" "${UPGRADE_CARGO_SKIP_PREFIX[@]}"; do
    if [[ -z "${seen[$candidate]+x}" ]]; then
      seen["$candidate"]=1
      names+=("$candidate")
    fi
  done
  if [[ -n "${lock:-}" && -f "$lock" ]]; then
    while IFS=$'\t' read -r name version; do
      upgrade_skips_crate "$name" || continue
      if [[ -z "${seen[$name]+x}" ]]; then
        seen["$name"]=1
        names+=("$name")
      fi
    done < <(cargo_lock_packages "$lock")
  fi
  if [[ ${#names[@]} -gt 0 ]]; then
    printf '%s\n' "${names[@]}"
  fi
}

# Locked name@version lines cargo update may select. Skipped crates are omitted.
# Each copy of a duplicated crate stays name@version.
cargo_update_select_specs() {
  local lock="$1"
  local spec name
  while IFS= read -r spec; do
    [[ -n "$spec" ]] || continue
    name="${spec%%@*}"
    if upgrade_skips_crate "$name"; then
      continue
    fi
    printf '%s\n' "$spec"
  done < <(cargo_lock_package_specs "$lock")
}

# `cargo update` has no --exclude. Pass every other locked package as
# name@version so this invocation cannot select the skip list. Do not pass
# --breaking, --precise, --pinned, or --incompatible.
cargo_update_except_upgrade_skips() {
  local spec
  local -a args=()
  while IFS= read -r spec; do
    [[ -n "$spec" ]] || continue
    args+=(-p "$spec")
  done < <(cargo_update_select_specs "$ROOT/Cargo.lock")
  if [[ ${#args[@]} -eq 0 ]]; then
    die "cargo update package list was empty"
  fi
  cargo update --manifest-path "$ROOT/Cargo.toml" "${args[@]}"
}

# True when every locked copy of pkg is exactly version (and at least one exists).
cargo_lock_is_exactly() {
  local lock="$1"
  local pkg="$2"
  local version="$3"
  local found=0
  local name ver
  while IFS=$'\t' read -r name ver; do
    if [[ "$name" == "$pkg" ]]; then
      found=1
      if [[ "$ver" != "$version" ]]; then
        return 1
      fi
    fi
  done < <(cargo_lock_packages "$lock")
  [[ "$found" -eq 1 ]]
}

# 0.2.100+ is the lockstep wasm-bindgen release train. 0.2.12 (old
# wasm-bindgen-backend) is a different crate line and is left alone.
on_bindgen_train() {
  local version="$1"
  local patch
  [[ "$version" =~ ^0\.2\.([0-9]+)$ ]] || return 1
  patch="${BASH_REMATCH[1]}"
  [[ "$patch" -ge 100 ]]
}

# `cargo update -p … --precise` exits 0 on cargo 1.83 when the package is
# already at that version, and may exit non-zero on other releases. Either
# way the lockfile staying put is success.
cargo_update_precise() {
  local pkg="$1"
  local version="$2"
  local output status
  if cargo_lock_is_exactly "$ROOT/Cargo.lock" "$pkg" "$version"; then
    log "$pkg already at $version"
    return 0
  fi
  log "cargo update -p $pkg --precise $version"
  set +e
  output="$(cargo update -p "$pkg" --precise "$version" --manifest-path "$ROOT/Cargo.toml" 2>&1)"
  status=$?
  set -e
  if [[ -n "$output" ]]; then
    printf '%s\n' "$output"
  fi
  if [[ "$status" -eq 0 ]]; then
    return 0
  fi
  if cargo_lock_is_exactly "$ROOT/Cargo.lock" "$pkg" "$version"; then
    log "$pkg already at $version"
    return 0
  fi
  if grep -Eqi 'already (locked|at)|did not change|nothing to do|up to date' <<<"$output"; then
    log "$pkg already at $version"
    return 0
  fi
  return "$status"
}

# Bumping wasm-bindgen is a separate, deliberate change: the crate has to
# match the installed wasm-bindgen-cli ($BINDGEN_VERSION). `cargo update`
# follows the 0.2 range, and js-sys/web-sys releases since 0.3.73 require
# `wasm-bindgen = "=<that release>"`, which drags wasm-bindgen-macro,
# -macro-support, -shared, -backend, and the rest of the family with it.
# Put js-sys/web-sys back to the versions from before this update, then pin
# wasm-bindgen with --precise so the family resolves to $BINDGEN_VERSION.
pin_wasm_bindgen() {
  local before="$1"
  local name version

  while IFS=$'\t' read -r name version; do
    case "$name" in
      js-sys | web-sys)
        cargo_update_precise "$name" "$version" \
          || die "could not keep $name at $version so wasm-bindgen can stay $BINDGEN_VERSION"
        ;;
    esac
  done <"$before"

  cargo_update_precise wasm-bindgen "$BINDGEN_VERSION" \
    || die "could not pin wasm-bindgen to $BINDGEN_VERSION"

  while IFS=$'\t' read -r name version; do
    case "$name" in
      wasm-bindgen-*)
        if on_bindgen_train "$version" && [[ "$version" != "$BINDGEN_VERSION" ]]; then
          cargo_update_precise "$name" "$BINDGEN_VERSION" \
            || die "could not pin $name to $BINDGEN_VERSION"
        fi
        ;;
    esac
  done < <(cargo_lock_packages "$ROOT/Cargo.lock")

  cargo_lock_is_exactly "$ROOT/Cargo.lock" wasm-bindgen "$BINDGEN_VERSION" \
    || die "wasm-bindgen is not pinned to $BINDGEN_VERSION"
  while IFS=$'\t' read -r name version; do
    case "$name" in
      wasm-bindgen-*)
        if on_bindgen_train "$version" && [[ "$version" != "$BINDGEN_VERSION" ]]; then
          die "$name $version is not wasm-bindgen $BINDGEN_VERSION"
        fi
        ;;
    esac
  done < <(cargo_lock_packages "$ROOT/Cargo.lock")
}

# npm 10.9's arborist dies with "Cannot read properties of null (reading
# 'edgesOut')" while resolving this tree (vitest's optional peers). npm 11
# runs the same in-range update and still writes only package-lock.json.
# --upgrade reuses this for `npm install`.
npm_web_resolving() {
  local major
  major="$(npm -v | cut -d. -f1)"
  if [[ "$major" -ge 11 ]]; then
    npm_in "$WEB" "$@"
    return
  fi
  log "npm $(npm -v) cannot update this tree; using npm 11"
  npm_in "$WEB" exec --yes npm@11 -- "$@"
}

npm_update_web() {
  npm_web_resolving update
}

# path<TAB>version for each installed package in a v2/v3 package-lock.json.
npm_lock_packages() {
  local lock="$1"
  LOCK_PATH="$lock" node <<'EOF'
const fs = require("fs");
const lock = JSON.parse(fs.readFileSync(process.env.LOCK_PATH, "utf8"));
const rows = [];
for (const [key, meta] of Object.entries(lock.packages || {})) {
  if (!key || !meta || typeof meta.version !== "string") continue;
  rows.push(`${key}\t${meta.version}`);
}
rows.sort();
if (rows.length) process.stdout.write(rows.join("\n") + "\n");
EOF
}

print_version_delta() {
  local label="$1"
  local before="$2"
  local after="$3"
  local removed added name old new display
  removed="$(mktemp)"
  added="$(mktemp)"
  comm -23 <(sort "$before") <(sort "$after") >"$removed"
  comm -13 <(sort "$before") <(sort "$after") >"$added"
  if [[ ! -s "$removed" && ! -s "$added" ]]; then
    log "No $label updates"
    rm -f "$removed" "$added"
    return 0
  fi
  log "Updated $label"
  while IFS= read -r name; do
    old="$(awk -F '\t' -v n="$name" '$1 == n { print $2 }' "$removed" | paste -sd, -)"
    new="$(awk -F '\t' -v n="$name" '$1 == n { print $2 }' "$added" | paste -sd, -)"
    display="${name#node_modules/}"
    if [[ -n "$old" && -n "$new" ]]; then
      printf '  %s %s -> %s\n' "$display" "$old" "$new"
    elif [[ -n "$new" ]]; then
      printf '  %s %s (added)\n' "$display" "$new"
    else
      printf '  %s %s (removed)\n' "$display" "$old"
    fi
  done < <({ cut -f1 "$removed"; cut -f1 "$added"; } | sort -u)
  rm -f "$removed" "$added"
}

# Paths --update and --upgrade refuse to mix with pre-existing edits.
# Workspace Cargo.toml files are included because --upgrade rewrites them;
# --update shares the check so a manifest edit is not mixed into a lock bump.
dependency_tree_paths() {
  {
    printf '%s\n' \
      Cargo.lock \
      apps/web/package.json \
      apps/web/package-lock.json \
      apps/web/src/parser
    git -C "$ROOT" ls-files -- ':(glob)**/Cargo.toml'
  } | sort -u
}

require_clean_dependency_tree() {
  local flag="$1"
  local dirty path
  local -a paths=()
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    paths+=("$path")
  done < <(dependency_tree_paths)
  dirty="$(
    git -C "$ROOT" status --porcelain --untracked-files=all -- "${paths[@]}"
  )"
  [[ -n "$dirty" ]] || return 0
  echo "error: ${flag} refuses to run while these files have changes:" >&2
  printf '%s\n' "$dirty" >&2
  die "Commit or stash these changes before running ${flag}."
}

file_sha256() {
  sha256sum "$1" | awk '{ print $1 }'
}

cmd_update() {
  require_clean_dependency_tree --update
  ensure_rust
  ensure_node

  local before_cargo before_npm after_cargo after_npm package_json_sha
  before_cargo="$(mktemp)"
  before_npm="$(mktemp)"
  after_cargo="$(mktemp)"
  after_npm="$(mktemp)"

  cargo_lock_packages "$ROOT/Cargo.lock" | sort >"$before_cargo"
  npm_lock_packages "$WEB/package-lock.json" | sort >"$before_npm"

  log "cargo update (within existing semver ranges)"
  cargo update --manifest-path "$ROOT/Cargo.toml"
  pin_wasm_bindgen "$before_cargo"

  log "npm update (web, within package.json ranges)"
  package_json_sha="$(file_sha256 "$WEB/package.json")"
  npm_update_web
  if [[ "$(file_sha256 "$WEB/package.json")" != "$package_json_sha" ]]; then
    die "npm update changed apps/web/package.json; dependency ranges stay as written"
  fi

  log "Rebuild WASM and run tests"
  cmd_build_wasm
  cmd_test

  cargo_lock_packages "$ROOT/Cargo.lock" | sort >"$after_cargo"
  npm_lock_packages "$WEB/package-lock.json" | sort >"$after_npm"

  log "Update summary (working tree only; nothing committed)"
  log "git diff --stat -- Cargo.lock apps/web/package-lock.json"
  git -C "$ROOT" diff --stat -- Cargo.lock apps/web/package-lock.json
  print_version_delta "crates" "$before_cargo" "$after_cargo"
  print_version_delta "npm packages" "$before_npm" "$after_npm"

  rm -f "$before_cargo" "$before_npm" "$after_cargo" "$after_npm"
}

require_cargo_edit() {
  if command -v cargo-upgrade >/dev/null 2>&1; then
    return 0
  fi
  die "cargo upgrade (cargo-edit) is missing. Install it with: cargo install cargo-edit"
}

# Default --upgrade keeps peer dependencies satisfiable (typescript-eslint
# cannot take typescript 7). --latest drops the filter.
ncu_upgrade_args() {
  printf '%s\n' -u
  if [[ "${LATEST:-0}" -eq 0 ]]; then
    printf '%s\n' --peer
  fi
}

# 1.x: only the major component is breaking. Before 1.0 a minor bump is breaking
# too (0.2.1 -> 0.3.0), matching Cargo's semver rule.
is_major_bump() {
  local old="$1"
  local new="$2"
  local old_major old_minor new_major new_minor
  [[ "$old" =~ ^([0-9]+)\.([0-9]+) ]] || return 1
  old_major="${BASH_REMATCH[1]}"
  old_minor="${BASH_REMATCH[2]}"
  [[ "$new" =~ ^([0-9]+)\.([0-9]+) ]] || return 1
  new_major="${BASH_REMATCH[1]}"
  new_minor="${BASH_REMATCH[2]}"
  if [[ "$new_major" -gt "$old_major" ]]; then
    return 0
  fi
  if [[ "$old_major" -eq 0 && "$new_major" -eq 0 && "$new_minor" -gt "$old_minor" ]]; then
    return 0
  fi
  return 1
}

highest_version() {
  printf '%s\n' "$1" | tr ',' '\n' | sort -V | tail -n 1
}

version_list_is_major_bump() {
  local old_high new_high
  old_high="$(highest_version "$1")"
  new_high="$(highest_version "$2")"
  is_major_bump "$old_high" "$new_high"
}

lock_package_label() {
  local name="$1"
  name="${name#node_modules/}"
  printf '%s\n' "$name"
}

# Resolved name/version rows from a before/after lock snapshot.
# `old` and `new` may be comma-separated when a package has several copies.
version_delta_rows() {
  local ecosystem="$1"
  local before="$2"
  local after="$3"
  local removed added name old new label major
  removed="$(mktemp)"
  added="$(mktemp)"
  comm -23 <(sort "$before") <(sort "$after") >"$removed"
  comm -13 <(sort "$before") <(sort "$after") >"$added"
  if [[ -s "$removed" || -s "$added" ]]; then
    while IFS= read -r name; do
      [[ -n "$name" ]] || continue
      old="$(awk -F '\t' -v n="$name" '$1 == n { print $2 }' "$removed" | paste -sd, -)"
      new="$(awk -F '\t' -v n="$name" '$1 == n { print $2 }' "$added" | paste -sd, -)"
      [[ -z "$old" && -z "$new" ]] && continue
      [[ "$old" == "$new" ]] && continue
      label="$(lock_package_label "$name")"
      if [[ -n "$old" && -n "$new" ]] && version_list_is_major_bump "$old" "$new"; then
        major=yes
      else
        major=no
      fi
      printf '%s\t%s\t%s\t%s\t%s\n' "$ecosystem" "$label" "${old:--}" "${new:--}" "$major"
    done < <({ cut -f1 "$removed"; cut -f1 "$added"; } | sort -u)
  fi
  rm -f "$removed" "$added"
}

# Majors first, then ecosystem, then package name.
print_upgrade_table() {
  local rows="$1"
  local sorted eco pkg old new major
  local w_eco=9 w_pkg=7 w_old=3 w_new=3
  local total=0 majors=0
  sorted="$(mktemp)"
  sort -t $'\t' -k5,5r -k1,1 -k2,2 "$rows" >"$sorted"
  while IFS=$'\t' read -r eco pkg old new major; do
    [[ -n "$eco" ]] || continue
    total=$((total + 1))
    if [[ "$major" == yes ]]; then
      majors=$((majors + 1))
    fi
    if [[ ${#eco} -gt $w_eco ]]; then w_eco=${#eco}; fi
    if [[ ${#pkg} -gt $w_pkg ]]; then w_pkg=${#pkg}; fi
    if [[ ${#old} -gt $w_old ]]; then w_old=${#old}; fi
    if [[ ${#new} -gt $w_new ]]; then w_new=${#new}; fi
  done <"$sorted"
  if [[ "$total" -eq 0 ]]; then
    log "No dependency version changes"
    rm -f "$sorted"
    return 0
  fi
  log "Upgraded packages: ${total} (${majors} major)"
  printf "%-${w_eco}s  %-${w_pkg}s  %-${w_old}s  %-${w_new}s  %s\n" \
    ecosystem package old new major
  while IFS=$'\t' read -r eco pkg old new major; do
    [[ -n "$eco" ]] || continue
    printf "%-${w_eco}s  %-${w_pkg}s  %-${w_old}s  %-${w_new}s  %s\n" \
      "$eco" "$pkg" "$old" "$new" "$major"
  done <"$sorted"
  rm -f "$sorted"
}

# Failure reporting for --upgrade. Returning 0 keeps the original exit status.
# Temps are global so the trap still sees them if a called function exits the shell.
UPGRADE_STEP=""
UPGRADE_MUTATED=0
UPGRADE_TMP_FILES=()

upgrade_cleanup_tmp() {
  if [[ ${#UPGRADE_TMP_FILES[@]} -gt 0 ]]; then
    rm -f "${UPGRADE_TMP_FILES[@]}"
  fi
  UPGRADE_TMP_FILES=()
}

# The dirty-tree guard already required these paths to match HEAD, so
# checkout plus clean puts back manifests, locks, and generated parser files.
restore_upgrade_tree() {
  local -a paths=()
  local path
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    paths+=("$path")
  done < <(dependency_tree_paths)
  if [[ ${#paths[@]} -eq 0 ]]; then
    echo "error: no dependency-tree paths to restore" >&2
    return 1
  fi
  git -C "$ROOT" checkout -- "${paths[@]}"
  git -C "$ROOT" clean -fd -- "${paths[@]}"
}

upgrade_report_failure() {
  local status=$?
  if [[ "$status" -ne 0 && -n "${UPGRADE_STEP:-}" ]]; then
    echo "error: --upgrade failed during: ${UPGRADE_STEP}" >&2
    if [[ "${UPGRADE_MUTATED:-0}" -eq 1 ]]; then
      if restore_upgrade_tree; then
        echo "error: the dependency tree was restored to its pre-run state" >&2
      else
        echo "error: could not restore the dependency tree" >&2
      fi
    fi
  fi
  upgrade_cleanup_tmp
  UPGRADE_STEP=""
  UPGRADE_MUTATED=0
  return 0
}

cmd_upgrade() {
  local before_cargo before_npm after_cargo after_npm rows crate ncu_arg
  local -a exclude_args=()
  local -a ncu_args=()

  UPGRADE_STEP="dirty-tree check"
  UPGRADE_MUTATED=0
  UPGRADE_TMP_FILES=()
  trap upgrade_report_failure EXIT

  require_clean_dependency_tree --upgrade

  UPGRADE_STEP="cargo-edit preflight"
  require_cargo_edit

  UPGRADE_STEP="toolchain"
  ensure_rust
  ensure_node

  before_cargo="$(mktemp)"
  before_npm="$(mktemp)"
  after_cargo="$(mktemp)"
  after_npm="$(mktemp)"
  rows="$(mktemp)"
  UPGRADE_TMP_FILES=("$before_cargo" "$before_npm" "$after_cargo" "$after_npm" "$rows")

  # Lock snapshots, not cargo/npm stdout: the table is the file diff.
  cargo_lock_packages "$ROOT/Cargo.lock" | sort >"$before_cargo"
  npm_lock_packages "$WEB/package-lock.json" | sort >"$before_npm"

  UPGRADE_STEP="cargo upgrade"
  UPGRADE_MUTATED=1
  while IFS= read -r crate; do
    [[ -n "$crate" ]] || continue
    exclude_args+=(--exclude "$crate")
  done < <(upgrade_cargo_exclude_names "$ROOT/Cargo.lock")
  # `--incompatible allow` is workspace-wide. `--exclude` is what keeps it off
  # the skip list. Do not pass `--pinned` (default ignore): that would rewrite
  # exact requirements. `--latest` does not add it.
  log "cargo upgrade --manifest-path ${ROOT}/Cargo.toml --incompatible allow ${exclude_args[*]}"
  cargo upgrade --manifest-path "$ROOT/Cargo.toml" --incompatible allow "${exclude_args[@]}"

  # Do not pass --breaking. Specs are name@version, minus the shared skip list.
  UPGRADE_STEP="cargo update"
  log "cargo update --manifest-path ${ROOT}/Cargo.toml -p <locked name@version except ${UPGRADE_CARGO_SKIP_EXACT[*]} and ${UPGRADE_CARGO_SKIP_PREFIX[*]}*>"
  cargo_update_except_upgrade_skips

  # The lock refresh does not select wasm-bindgen*. If a resolve still moved
  # the family, put it back on the wasm-bindgen-cli pin.
  UPGRADE_STEP="wasm-bindgen pin"
  log "Pin wasm-bindgen to ${BINDGEN_VERSION}"
  pin_wasm_bindgen "$before_cargo"

  UPGRADE_STEP="npm-check-updates"
  while IFS= read -r ncu_arg; do
    ncu_args+=("$ncu_arg")
  done < <(ncu_upgrade_args)
  log "npm-check-updates@${NCU_MAJOR} ${ncu_args[*]} (web)"
  (cd "$WEB" && npx --yes "npm-check-updates@${NCU_MAJOR}" "${ncu_args[@]}")

  UPGRADE_STEP="npm install"
  log "npm install (web)"
  npm_web_resolving install

  UPGRADE_STEP="wasm build"
  cmd_build_wasm

  UPGRADE_STEP="tests"
  cmd_test

  # Prerender (`vite build`) catches React/router majors that Vitest does not.
  UPGRADE_STEP="web production build"
  log "web production build"
  npm_in "$WEB" run build

  cargo_lock_packages "$ROOT/Cargo.lock" | sort >"$after_cargo"
  npm_lock_packages "$WEB/package-lock.json" | sort >"$after_npm"
  version_delta_rows cargo "$before_cargo" "$after_cargo" >"$rows"
  version_delta_rows npm "$before_npm" "$after_npm" >>"$rows"

  UPGRADE_STEP=""
  log "Upgrade summary (working tree only; nothing committed)"
  log "git diff --stat"
  git -C "$ROOT" diff --stat
  print_upgrade_table "$rows"
  log "Review the diff and commit the upgrades you want to keep."

  upgrade_cleanup_tmp
  trap - EXIT
}

# Listen on every interface. 0.0.0.0 is the bind address, not a URL for other PCs.
vite_run() {
  local npm_script="$1"
  local port="$2"
  local host_args=()
  if [[ "$LOCAL_NETWORK" -eq 1 ]]; then
    host_args=(--host 0.0.0.0)
  fi
  (cd "$WEB" && npm run "$npm_script" -- "${host_args[@]}" --port "$port")
}

# Default-route IPv4, skipping docker/libvirt bridges that Vite also prints.
lan_ipv4() {
  local ip
  ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{
    for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }
  }')"
  if [[ -n "$ip" ]]; then
    echo "$ip"
    return
  fi
  hostname -I 2>/dev/null | tr ' ' '\n' | awk '
    /^192\.168\./ { print; exit }
    /^10\./ { print; exit }
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./ { print; exit }
  '
}

log_lan() {
  local port="$1"
  local ip
  ip="$(lan_ipv4)"
  log "bind 0.0.0.0:${port}"
  if [[ -n "$ip" ]]; then
    log "on the other PC open http://${ip}:${port}/  (not http://0.0.0.0:${port}/)"
  else
    log "on the other PC open the Network URL Vite prints (not http://0.0.0.0:${port}/)"
  fi
}

cmd_dev() {
  ensure_parser_artifacts
  ensure_node
  log "viewer  http://localhost:${DEV_PORT}/"
  log "layouts http://localhost:${DEV_PORT}/layouts (DEV Settings → Layouts editor)"
  if [[ "$LOCAL_NETWORK" -eq 1 ]]; then
    log_lan "$DEV_PORT"
  fi
  vite_run dev "$DEV_PORT"
}

cmd_prod() {
  ensure_parser_artifacts
  ensure_node
  log "web production build"
  npm_in "$WEB" run build
  log "preview http://localhost:${PROD_PORT}/ (production bundle; no layouts editor)"
  if [[ "$LOCAL_NETWORK" -eq 1 ]]; then
    log_lan "$PROD_PORT"
  fi
  vite_run preview "$PROD_PORT"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  PREPARE=0
  UPDATE=0
  UPGRADE=0
  LATEST=0
  BUILD_WASM=0
  CHECK=0
  TEST=0
  DEV=0
  PROD=0
  LOCAL_NETWORK=0

  if [[ $# -eq 0 ]]; then
    usage
    exit 1
  fi

  for arg in "$@"; do
    case "$arg" in
      --prepare) PREPARE=1 ;;
      --update) UPDATE=1 ;;
      --upgrade) UPGRADE=1 ;;
      --latest) LATEST=1 ;;
      --build-wasm) BUILD_WASM=1 ;;
      --check) CHECK=1 ;;
      --test) TEST=1 ;;
      --dev) DEV=1 ;;
      --prod) PROD=1 ;;
      --local-network) LOCAL_NETWORK=1 ;;
      -h | --help) usage; exit 0 ;;
      *)
        echo "unknown flag: $arg" >&2
        usage
        exit 1
        ;;
    esac
  done

  if [[ "$DEV" -eq 1 && "$PROD" -eq 1 ]]; then
    die "pass either --dev or --prod, not both"
  fi

  if [[ "$UPDATE" -eq 1 && "$UPGRADE" -eq 1 ]]; then
    die "--update and --upgrade are mutually exclusive"
  fi

  if [[ "$LATEST" -eq 1 && "$UPGRADE" -eq 0 ]]; then
    die "--latest requires --upgrade"
  fi

  if [[ "$LOCAL_NETWORK" -eq 1 && "$DEV" -eq 0 && "$PROD" -eq 0 ]]; then
    die "--local-network requires --dev or --prod"
  fi

  # `[[ flag -eq 1 ]] && cmd` returns 1 when the flag is off. That status
  # becomes the script's exit code when it is the last command, so a
  # successful --update (or any flag except --prod) looked failed.
  if [[ "$PREPARE" -eq 1 ]]; then
    cmd_prepare
  fi
  if [[ "$UPDATE" -eq 1 ]]; then
    cmd_update
  fi
  if [[ "$UPGRADE" -eq 1 ]]; then
    cmd_upgrade
  fi
  if [[ "$BUILD_WASM" -eq 1 ]]; then
    cmd_build_wasm
  fi
  if [[ "$CHECK" -eq 1 ]]; then
    cmd_check
  fi
  if [[ "$TEST" -eq 1 ]]; then
    cmd_test
  fi
  if [[ "$DEV" -eq 1 ]]; then
    cmd_dev
  fi
  if [[ "$PROD" -eq 1 ]]; then
    cmd_prod
  fi
fi
