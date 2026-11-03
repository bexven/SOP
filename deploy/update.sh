#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Product SOP — update to the latest version (run with:  sudo sop update).
#
#   1. Backs up the database.
#   2. Builds the new version in its own folder while the current one keeps running.
#   3. Applies database changes (migrations only ever add/convert; data is kept).
#   4. Switches to the new version (a few seconds) and checks it is healthy.
#   5. If the check fails, switches straight back to the previous version.
#
# Options:  --no-backup   skip step 1 (first install)
#           --ref <sha>   deploy a specific commit/branch instead of the latest
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SOP_HOME="${SOP_HOME:-/opt/sop}"
BIN="$SOP_HOME/bin"
KEEP_RELEASES=5
PORT="${SOP_PORT:-3000}"
RESTART="${SOP_RESTART:-systemctl restart sop}"
AS_SOP="${SOP_AS_USER-runuser -u sop --}"
[[ -f "$SOP_HOME/shared/deploy.conf" ]] && source "$SOP_HOME/shared/deploy.conf"
BRANCH="${BRANCH:-main}"

BACKUP=1
REF=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-backup) BACKUP=0 ;;
    --ref) REF="$2"; shift ;;
    *) echo "Unknown option: $1"; exit 2 ;;
  esac
  shift
done

say() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

# One update at a time.
exec 9>"$SOP_HOME/.update.lock"
flock -n 9 || fail "Another update is already running."

health() {
  for _ in $(seq 1 45); do
    if curl -fsS -m 3 "http://127.0.0.1:${PORT}/api/health" 2>/dev/null | grep -q '"ok":true'; then return 0; fi
    sleep 2
  done
  return 1
}

say "Fetching the latest code"
$AS_SOP git --git-dir="$SOP_HOME/repo.git" fetch --quiet --prune origin "+refs/heads/*:refs/heads/*"
TARGET="${REF:-$BRANCH}"
SHA="$(git --git-dir="$SOP_HOME/repo.git" rev-parse --short=10 "$TARGET^{commit}")"
SUBJECT="$(git --git-dir="$SOP_HOME/repo.git" log -1 --format=%s "$SHA")"
CURRENT_SHA="$(cat "$SOP_HOME/current/RELEASE" 2>/dev/null || true)"
ok "$SHA — $SUBJECT"
if [[ "$CURRENT_SHA" == "$SHA" ]]; then
  ok "Already running this version. Nothing to do."
  exit 0
fi

if [[ $BACKUP -eq 1 ]]; then
  say "Backing up the database"
  "$BIN/backup.sh" "before-$SHA"
fi

say "Building the new version (the current one keeps running)"
REL="$SOP_HOME/releases/$(date -u +%Y%m%d-%H%M%S)-$SHA"
install -d -o sop -g sop "$REL"
git --git-dir="$SOP_HOME/repo.git" archive "$SHA" | $AS_SOP tar -x -C "$REL"
echo "$SHA" | $AS_SOP tee "$REL/RELEASE" >/dev/null
$AS_SOP ln -s "$SOP_HOME/shared/.env" "$REL/.env"
cd "$REL"
$AS_SOP npm ci --no-audit --no-fund --loglevel=error >"$SOP_HOME/logs/build-$SHA.log" 2>&1 || fail "Installing packages failed — see $SOP_HOME/logs/build-$SHA.log. Nothing was changed."
$AS_SOP npm run build >>"$SOP_HOME/logs/build-$SHA.log" 2>&1 || fail "The build failed — see $SOP_HOME/logs/build-$SHA.log. Nothing was changed."
# The standalone server needs the static files and public folder next to it.
$AS_SOP cp -r "$REL/public" "$REL/.next/standalone/public"
$AS_SOP cp -r "$REL/.next/static" "$REL/.next/standalone/.next/static"
$AS_SOP cp "$REL/RELEASE" "$REL/.next/standalone/RELEASE"
ok "built"

say "Applying database changes"
$AS_SOP npx prisma migrate deploy >>"$SOP_HOME/logs/build-$SHA.log" 2>&1 || fail "A database change failed — see $SOP_HOME/logs/build-$SHA.log. The app was not switched; your data is unchanged (backup in $SOP_HOME/backups)."
ok "database up to date"

say "Switching to the new version"
PREV="$(readlink -f "$SOP_HOME/current" 2>/dev/null || true)"
ln -sfn "$REL" "$SOP_HOME/current.new" && mv -Tf "$SOP_HOME/current.new" "$SOP_HOME/current"
$RESTART 9>&-
if health; then
  ok "healthy — now running $SHA"
else
  if [[ -n "$PREV" && -d "$PREV" ]]; then
    ln -sfn "$PREV" "$SOP_HOME/current.new" && mv -Tf "$SOP_HOME/current.new" "$SOP_HOME/current"
    $RESTART 9>&-
    health && echo "  Switched back to the previous version ($(cat "$PREV/RELEASE"))."
  fi
  fail "The new version didn't start (see $SOP_HOME/logs/app.log). Previous version restored."
fi

# Keep the scripts in step with the code.
install -m 755 "$REL"/deploy/*.sh "$BIN/" 2>/dev/null || true

# Tidy old releases.
ls -1dt "$SOP_HOME"/releases/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
find "$SOP_HOME/logs" -name 'build-*.log' -mtime +30 -delete 2>/dev/null || true

printf '\n\033[1;32mUpdated to %s\033[0m  (%s)\n' "$SHA" "$SUBJECT"
