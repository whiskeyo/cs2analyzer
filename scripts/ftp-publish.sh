#!/usr/bin/env bash
# Upload dist to a sibling FTP folder, then rename it over the live document root.
# Live stays the previous release until both `mv`s finish (no empty Index of /).
set -euo pipefail

LOCAL_DIR="${1:-dist}"
LIVE="${FTP_LIVE_DIR:-/cs2analyzer}"
STAGING="${FTP_STAGING_DIR:-/cs2analyzer_staging}"
PREV="${FTP_PREV_DIR:-/cs2analyzer_prev}"

if [[ -z "${FTP_HOST:-}" || -z "${FTP_USERNAME:-}" || -z "${FTP_PASSWORD:-}" ]]; then
  echo "FTP_HOST, FTP_USERNAME, and FTP_PASSWORD must be set" >&2
  exit 1
fi

if [[ ! -f "$LOCAL_DIR/index.html" ]]; then
  echo "refusing to publish: $LOCAL_DIR/index.html is missing" >&2
  exit 1
fi

# `-u user` with LFTP_PASSWORD still prompts; with no TTY lftp logs in anonymous
# and OVH returns 530. ~/.netrc is how lftp picks up a password non-interactively.
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
export HOME="$work"

python3 - <<'PY'
import os
from pathlib import Path

def quote(value: str) -> str:
    if any(ch in value for ch in ' \t\'"\\'):
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return value

host = os.environ["FTP_HOST"]
for prefix in ("ftpes://", "ftps://", "ftp://"):
    if host.lower().startswith(prefix):
        host = host[len(prefix) :]
        break
host = host.split("/")[0]

Path.home().joinpath(".netrc").write_text(
    f"machine {quote(host)}\nlogin {quote(os.environ['FTP_USERNAME'])}\npassword {quote(os.environ['FTP_PASSWORD'])}\n",
    encoding="utf-8",
)
PY
chmod 600 "$HOME/.netrc"

lftp "$FTP_HOST" <<EOF
set cmd:fail-exit yes
set ssl:verify-certificate no
set ftp:ssl-allow yes
set ftp:list-options -a
set net:max-retries 3
set net:timeout 30
mirror -R --delete --verbose --parallel=8 --exclude-glob .git "$LOCAL_DIR" "$STAGING"
set cmd:fail-exit no
rm -r -f "$PREV"
mv "$LIVE" "$PREV"
set cmd:fail-exit yes
mv "$STAGING" "$LIVE"
set cmd:fail-exit no
rm -r -f "$PREV"
bye
EOF
