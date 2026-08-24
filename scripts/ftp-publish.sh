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

# lftp reads this when -u has a user but no password (commas in the secret are safe).
export LFTP_PASSWORD="$FTP_PASSWORD"

lftp -u "$FTP_USERNAME" "$FTP_HOST" <<EOF
set cmd:fail-exit yes
set ssl:verify-certificate no
set ftp:ssl-allow yes
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
