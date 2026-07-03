#!/usr/bin/env bash
# Generates the htpasswd file from BASIC_AUTH_USER / BASIC_AUTH_PASSWORD
# on every container start, so rotating the password is `docker compose up -d`.
set -euo pipefail

: "${BASIC_AUTH_USER:?BASIC_AUTH_USER is required}"
: "${BASIC_AUTH_PASSWORD:?BASIC_AUTH_PASSWORD is required}"

htpasswd -Bbc /etc/nginx/.htpasswd "$BASIC_AUTH_USER" "$BASIC_AUTH_PASSWORD" >/dev/null
chmod 640 /etc/nginx/.htpasswd

echo "[dgxtop] htpasswd generated for user '${BASIC_AUTH_USER}'"
