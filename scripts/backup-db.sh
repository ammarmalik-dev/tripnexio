#!/usr/bin/env bash
# Timestamped, gzip-compressed PostgreSQL backup with retention pruning.
# Real and runnable — not a placeholder — see docs/deployment/DEPLOYMENT_RUNBOOK.md
# §4 for the cron entry and restore-test procedure that use this.
#
# Usage: DATABASE_URL=postgresql://... ./scripts/backup-db.sh [backup-dir] [retention-days]
set -euo pipefail

BACKUP_DIR="${1:-/var/backups/tripnexio}"
RETENTION_DAYS="${2:-14}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Export it (or pass it inline) before running this script." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
outfile="$BACKUP_DIR/tripnexio-$timestamp.sql.gz"

echo "Backing up to $outfile ..."
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "$outfile"

size=$(du -h "$outfile" | cut -f1)
echo "Backup complete: $outfile ($size)"

echo "Pruning backups older than $RETENTION_DAYS day(s) in $BACKUP_DIR ..."
find "$BACKUP_DIR" -name 'tripnexio-*.sql.gz' -type f -mtime "+$RETENTION_DAYS" -print -delete
