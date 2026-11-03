#!/usr/bin/env bash
# Product SOP — copy all data from another PostgreSQL database (e.g. Neon) into this server.
#   sudo sop import "postgresql://USER:PASSWORD@ep-xxxx.aws.neon.tech/neondb?sslmode=require"
# Use Neon's DIRECT connection string (the host WITHOUT "-pooler").
# Replaces this server's data. A backup of it is taken first.
set -euo pipefail
SOP_HOME="${SOP_HOME:-/opt/sop}"
SRC="${1:-}"
[[ "$SRC" == postgres* ]] || { echo 'Usage: sudo sop import "postgresql://…"'; exit 1; }
set -a; source "$SOP_HOME/shared/.env"; set +a
DEST="${DIRECT_URL:-$DATABASE_URL}"
read -rp "This replaces ALL data on this server with the data from the other database. Type yes: " yes
[[ "$yes" == "yes" ]] || { echo "Cancelled."; exit 1; }
"$SOP_HOME/bin/backup.sh" before-import
TMP="$SOP_HOME/backups/import-$(date -u +%Y%m%d-%H%M%S).dump"
echo "  … downloading from the other database"
pg_dump --format=custom --no-owner --no-acl --dbname="$SRC" --file="$TMP"
systemctl stop sop
echo "  … loading into this server"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$DEST" "$TMP" || true
cd "$SOP_HOME/current" && runuser -u sop -- npx prisma migrate deploy >/dev/null
systemctl start sop
chmod 600 "$TMP"
echo "  ✓ data imported. Sign in and check everything is there."
echo "    Next: Settings → Notifications → connect the Telegram bot again (it must point at this server)."
