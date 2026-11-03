#!/usr/bin/env bash
# Product SOP — restore the database from a backup.  sudo sop restore <file>
# The app is stopped, the database is replaced by the backup, then the app starts.
# A fresh backup of the current state is taken first, so a restore can be undone.
set -euo pipefail
SOP_HOME="${SOP_HOME:-/opt/sop}"
FILE="${1:-}"
[[ -n "$FILE" && -f "$FILE" ]] || { echo "Usage: sudo sop restore /opt/sop/backups/<file>.dump"; ls -1t "$SOP_HOME/backups" | head -10; exit 1; }
set -a; source "$SOP_HOME/shared/.env"; set +a
URL="${DIRECT_URL:-$DATABASE_URL}"
read -rp "Replace ALL current data with $(basename "$FILE")? Type yes: " yes
[[ "$yes" == "yes" ]] || { echo "Cancelled."; exit 1; }
"$SOP_HOME/bin/backup.sh" before-restore
systemctl stop sop
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$URL" "$FILE" || true
systemctl start sop
echo "  ✓ restored from $(basename "$FILE")"
