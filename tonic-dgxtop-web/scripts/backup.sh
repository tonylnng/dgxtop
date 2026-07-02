#!/usr/bin/env bash
# Dump the TimescaleDB volume to ./backups/dgxtop-YYYYMMDD-HHMMSS.sql.gz
set -euo pipefail
mkdir -p backups
ts=$(date -u +%Y%m%d-%H%M%S)
docker compose exec -T db pg_dump -U dgx -d dgxtop | gzip > "backups/dgxtop-${ts}.sql.gz"
echo "wrote backups/dgxtop-${ts}.sql.gz"
