#!/usr/bin/env bash
# Serve dist/ with httpd:2.4 the way OVH shared hosting does, then run
# htaccess_check.py. The docroot is the directory you pass (CI downloads the
# web-dist artifact; locally it is apps/web/dist after npm run build).
#
#   cd apps/web && npm run build
#   ./scripts/check-htaccess.sh
#   ./scripts/check-htaccess.sh /path/to/downloaded/dist
#
# Requires docker, curl, git, and uv (https://docs.astral.sh/uv/).
# HTACCESS_KEEP=1 leaves the container up. HTACCESS_PORT defaults to 18088.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DIST="${1:-$SCRIPT_DIR/../dist}"
PORT="${HTACCESS_PORT:-18088}"
IMAGE="${HTACCESS_HTTPD_IMAGE:-httpd:2.4}"
NAME="cs2-htaccess-$$"

if [[ ! -d "$DIST" ]]; then
  echo "dist directory not found: $DIST" >&2
  exit 1
fi
DIST="$(cd "$DIST" && pwd)"

if [[ ! -f "$DIST/index.html" ]]; then
  echo "refusing to check: $DIST/index.html is missing" >&2
  exit 1
fi
if [[ ! -f "$DIST/.htaccess" ]]; then
  echo "refusing to check: $DIST/.htaccess is missing" >&2
  echo "upload-artifact skips hidden files unless include-hidden-files is true" >&2
  exit 1
fi

rev="$(git -C "$ROOT" rev-parse --short HEAD)"
stamped="$(sed -n 's/.*X-Htaccess-Rev "\([^"]*\)".*/\1/p' "$DIST/.htaccess")"
if [[ "$stamped" != "$rev" ]]; then
  echo "dist/.htaccess rev ${stamped:-<missing>} != git $rev" >&2
  exit 1
fi

cleanup() {
  if [[ "${HTACCESS_KEEP:-}" == "1" ]]; then
    echo "leaving ${NAME} at http://127.0.0.1:${PORT}/" >&2
    return
  fi
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" \
  -p "127.0.0.1:${PORT}:80" \
  -v "${DIST}:/usr/local/apache2/htdocs:ro" \
  --entrypoint bash \
  "$IMAGE" \
  -lc 'set -e
sed -i "s/^#LoadModule rewrite_module/LoadModule rewrite_module/" /usr/local/apache2/conf/httpd.conf
sed -i -E "s/AllowOverride [Nn]one/AllowOverride All/g" /usr/local/apache2/conf/httpd.conf
printf "\n# OVH ships no .wasm type unless .htaccess adds one.\nRemoveType .wasm\n" >> /usr/local/apache2/conf/httpd.conf
exec httpd-foreground'

ready=0
for _ in $(seq 1 50); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/robots.txt"; then
    ready=1
    break
  fi
  sleep 0.2
done
if [[ "$ready" -ne 1 ]]; then
  echo "apache did not become ready on port ${PORT}" >&2
  docker logs "$NAME" >&2 || true
  exit 1
fi

uv run "$SCRIPT_DIR/htaccess_check.py" "http://127.0.0.1:${PORT}" --expect-rev "$rev"
