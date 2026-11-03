#!/usr/bin/env bash
# Product SOP — database backup.  sudo sop backup   (also runs every night)
# Writes a compressed PostgreSQL dump to /opt/sop/backups and keeps 14 days
# of nightly ones (backups taken before updates are kept for 30 days).
set -euo pipefail
SOP_HOME="${SOP_HOME:-/opt/sop}"
LABEL="${1:-manual}"
set -a; source "$SOP_HOME/shared/.env"; set +a
URL="${DIRECT_URL:-$DATABASE_URL}"
FILE="$SOP_HOME/backups/sop-$(date -u +%Y%m%d-%H%M%S)-${LABEL}.dump"
pg_dump --format=custom --compress=6 --no-owner --no-acl --dbname="$URL" --file="$FILE.part"
mv "$FILE.part" "$FILE"
chmod 600 "$FILE"
echo "  ✓ backup: $FILE ($(du -h "$FILE" | cut -f1))"
find "$SOP_HOME/backups" -name 'sop-*-nightly.dump' -mtime +14 -delete
find "$SOP_HOME/backups" -name 'sop-*-before-*.dump' -mtime +30 -delete
find "$SOP_HOME/backups" -name 'sop-*-manual.dump' -mtime +60 -delete
# Optional off-server copy: set BACKUP_COPY_CMD in /opt/sop/shared/.env, e.g.
#   BACKUP_COPY_CMD='rclone copy {} gdrive:sop-backups'
if [[ -n "${BACKUP_COPY_CMD:-}" ]]; then
  eval "${BACKUP_COPY_CMD//\{\}/$FILE}" && echo "  ✓ copied off the server"
fi
