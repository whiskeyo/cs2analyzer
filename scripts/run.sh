#!/usr/bin/env bash
# Local workflow: toolchain, dependency updates, WASM, CI checks, tests, and the Vite app.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINDGEN_VERSION="0.2.127"
WEB="$ROOT/apps/web"
DEV_PORT="${DEV_PORT:-5173}"
PROD_PORT="${PROD_PORT:-4173}"

export PATH="${HOME}/.cargo/bin:${HOME}/.local/bin:${PATH}"
if [[ -f "${HOME}/.cargo/env" ]]; then
  # shellcheck disable=SC1091
  . "${HOME}/.cargo/env"
fi

usage() {
  cat <<EOF
Usage: scripts/run.sh [flags]

  --prepare        Install Rust toolchain, wasm-bindgen-cli, and npm deps
  --update         Update crates and npm packages within their current semver
                   ranges, keep wasm-bindgen pinned to the CLI version, rebuild
                   WASM, and run cargo test plus the web suite. Does not commit.
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
Do not pass both --dev and --prod. --local-network requires --dev or --prod.
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

cmd_update() {
  ensure_rust
  ensure_node

  local before_cargo before_npm after_cargo after_npm
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
  npm_in "$WEB" update
  if ! git -C "$ROOT" diff --quiet -- apps/web/package.json; then
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

  if [[ "$LOCAL_NETWORK" -eq 1 && "$DEV" -eq 0 && "$PROD" -eq 0 ]]; then
    die "--local-network requires --dev or --prod"
  fi

  [[ "$PREPARE" -eq 1 ]] && cmd_prepare
  [[ "$UPDATE" -eq 1 ]] && cmd_update
  [[ "$BUILD_WASM" -eq 1 ]] && cmd_build_wasm
  [[ "$CHECK" -eq 1 ]] && cmd_check
  [[ "$TEST" -eq 1 ]] && cmd_test
  [[ "$DEV" -eq 1 ]] && cmd_dev
  [[ "$PROD" -eq 1 ]] && cmd_prod
fi
