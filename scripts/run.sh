#!/usr/bin/env bash
# Local workflow: toolchain, WASM, CI checks, tests, and the Vite app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
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
  --build-wasm     Compile WASM and emit JS bindings into apps/web/src/parser/
  --check          rustfmt, clippy, prettier, eslint, typecheck
  --test           cargo test and the web vitest suite
  --dev            Start the Vite dev server (http://localhost:${DEV_PORT}/; layouts at /layouts)
  --prod           Build the production bundle and preview it (http://localhost:${PROD_PORT}/)
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

cmd_build_wasm() {
  ensure_rust
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
  ensure_node
  log "viewer  http://localhost:${DEV_PORT}/"
  log "layouts http://localhost:${DEV_PORT}/layouts (DEV Settings → Layouts editor)"
  if [[ "$LOCAL_NETWORK" -eq 1 ]]; then
    log_lan "$DEV_PORT"
  fi
  vite_run dev "$DEV_PORT"
}

cmd_prod() {
  ensure_node
  log "web production build"
  npm_in "$WEB" run build
  log "preview http://localhost:${PROD_PORT}/ (production bundle; no layouts editor)"
  if [[ "$LOCAL_NETWORK" -eq 1 ]]; then
    log_lan "$PROD_PORT"
  fi
  vite_run preview "$PROD_PORT"
}

PREPARE=0
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
[[ "$BUILD_WASM" -eq 1 ]] && cmd_build_wasm
[[ "$CHECK" -eq 1 ]] && cmd_check
[[ "$TEST" -eq 1 ]] && cmd_test
[[ "$DEV" -eq 1 ]] && cmd_dev
[[ "$PROD" -eq 1 ]] && cmd_prod
