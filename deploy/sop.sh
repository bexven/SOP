#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Product SOP — server command (Docker).  Run "sop help".
# Lives in the repo (deploy/sop.sh); /usr/local/bin/sop points here.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Updates replace this very file (it lives in the repo), so run from a private copy.
if [[ -z "${SOP_REEXEC:-}" ]]; then
  tmp="$(mktemp /tmp/sop.XXXXXX)"; cp "$0" "$tmp"
  SOP_REEXEC="$tmp" exec bash "$tmp" "$@"
fi
trap 'rm -f "$SOP_REEXEC"' EXIT

SOP_HOME="${SOP_HOME:-/opt/sop}"
REPO="$SOP_HOME/repo"
ENV_FILE="$SOP_HOME/.env"
REL_FILE="$SOP_HOME/.release"
BRANCH="${SOP_BRANCH:-main}"
KEEP_IMAGES=3

[[ -f "$REL_FILE" ]] || printf 'APP_TAG=none\nPREV_TAG=none\n' > "$REL_FILE"
# shellcheck disable=SC1090
source "$REL_FILE"

compose() {
  docker compose --project-directory "$SOP_HOME" -f "$REPO/deploy/docker-compose.yml" \
    --env-file "$ENV_FILE" --env-file "$REL_FILE" "$@"
}
say() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }
need_root() { [[ $EUID -eq 0 ]] || fail "Run with sudo:  sudo sop $1"; }
confirm() {
  [[ "${SOP_YES:-}" == "1" ]] && return 0
  read -rp "$1 Type yes: " a
  [[ "$a" == "yes" ]] || { echo "Cancelled."; exit 1; }
}
set_release() { printf 'APP_TAG=%s\nPREV_TAG=%s\n' "$1" "$2" > "$REL_FILE"; APP_TAG="$1"; PREV_TAG="$2"; }

healthy_as() {
  local want="$1"
  for _ in $(seq 1 45); do
    if curl -fsS -m 3 http://127.0.0.1:3000/api/health 2>/dev/null | grep -q "\"release\":\"$want\""; then return 0; fi
    sleep 2
  done
  return 1
}

backup() {
  local label="${1:-manual}"
  local file="$SOP_HOME/backups/sop-$(date -u +%Y%m%d-%H%M%S)-$label.dump"
  compose up -d db >/dev/null 2>&1
  compose exec -T db pg_dump -U sop -d sop --format=custom --compress=6 --no-owner --no-acl > "$file.part"
  mv "$file.part" "$file" && chmod 600 "$file"
  ok "backup: $file ($(du -h "$file" | cut -f1))"
  find "$SOP_HOME/backups" -name 'sop-*-nightly.dump' -mtime +14 -delete
  find "$SOP_HOME/backups" -name 'sop-*-before-*.dump' -mtime +30 -delete
  find "$SOP_HOME/backups" -name 'sop-*-manual.dump' -mtime +60 -delete
  if [[ -n "${BACKUP_COPY_CMD:-}" ]]; then eval "${BACKUP_COPY_CMD//\{\}/$file}" && ok "copied off the server"; fi
}

load_into_db() {  # $1 = dump file
  compose stop app >/dev/null 2>&1 || true
  compose exec -T db pg_restore -U sop -d sop --clean --if-exists --no-owner --no-acl < "$1" || true
  compose run --rm migrate >/dev/null
  compose up -d app >/dev/null
}

update() {
  local auto=0 ref="" force=0
  while [[ $# -gt 0 ]]; do
    case "$1" in --auto) auto=1 ;; --ref) ref="$2"; shift ;; --force) force=1 ;; esac
    shift
  done
  exec 9>"$SOP_HOME/.update.lock"
  flock -n 9 || { [[ $auto -eq 1 ]] && exit 0; fail "Another update is already running."; }

  git -C "$REPO" fetch --quiet origin "$BRANCH"
  local sha
  sha="$(git -C "$REPO" rev-parse --short=10 "${ref:-origin/$BRANCH}^{commit}")"
  if [[ "$sha" == "$APP_TAG" && $force -eq 0 ]]; then
    [[ $auto -eq 1 ]] || ok "Already running $sha. Nothing to do."
    exit 0
  fi
  local subject; subject="$(git -C "$REPO" log -1 --format=%s "$sha")"
  say "Updating to $sha — $subject"

  if [[ "$APP_TAG" != "none" ]]; then backup "before-$sha"; fi

  say "Building the new version (the current one keeps running)"
  git -C "$REPO" checkout --quiet --force "$sha"
  docker build --quiet --target runner --build-arg RELEASE="$sha" -t "sop-app:$sha" "$REPO" >/dev/null \
    || fail "The build failed. Nothing was changed."
  docker build --quiet --target migrate -t "sop-migrate:$sha" "$REPO" >/dev/null \
    || fail "The build failed. Nothing was changed."
  ok "built"

  say "Applying database changes"
  local old="$APP_TAG"
  APP_TAG="$sha" compose run --rm migrate >/dev/null \
    || fail "A database change failed. The app was not switched; your data is unchanged (backup in $SOP_HOME/backups)."
  ok "database up to date"

  say "Switching to the new version"
  set_release "$sha" "$old"
  compose up -d --remove-orphans app >/dev/null
  if healthy_as "$sha"; then
    ok "healthy — now running $sha"
  else
    if [[ "$old" != "none" ]]; then
      set_release "$old" "none"
      compose up -d app >/dev/null
      healthy_as "$old" && echo "  Switched back to the previous version ($old)."
    fi
    docker image rm -f "sop-app:$sha" "sop-migrate:$sha" >/dev/null 2>&1 || true
    fail "The new version didn't start (sop logs). Previous version restored."
  fi
  compose --profile web up -d caddy >/dev/null

  # Keep the last few versions for rollback, remove older ones.
  for repo in sop-app sop-migrate; do
    docker image ls "$repo" --format '{{.CreatedAt}}|{{.Tag}}' | sort -r | tail -n +$((KEEP_IMAGES + 1)) | cut -d'|' -f2 \
      | while read -r tag; do [[ "$tag" == "$APP_TAG" || "$tag" == "$PREV_TAG" ]] || docker image rm "$repo:$tag" >/dev/null 2>&1 || true; done
  done
  printf '\n\033[1;32mUpdated to %s\033[0m  (%s)\n' "$sha" "$subject"
}

cmd="${1:-help}"; shift || true
case "$cmd" in
  update)   need_root update; update "$@" ;;
  rollback)
    need_root rollback
    [[ "$PREV_TAG" != "none" ]] || fail "There is no previous version to go back to."
    confirm "Go back from $APP_TAG to $PREV_TAG?"
    set_release "$PREV_TAG" "$APP_TAG"
    compose up -d app >/dev/null
    healthy_as "$APP_TAG" && ok "running $APP_TAG again" ;;
  backup)   need_root backup; backup "${1:-manual}" ;;
  backups)  ls -1th "$SOP_HOME/backups" | head -30 ;;
  restore)
    need_root restore
    file="${1:-}"; [[ -f "$file" ]] || fail "Usage: sudo sop restore /opt/sop/backups/<file>.dump"
    confirm "Replace ALL current data with $(basename "$file")?"
    backup before-restore
    load_into_db "$file"
    ok "restored from $(basename "$file")" ;;
  import)
    need_root import
    src="${1:-}"; [[ "$src" == postgres* ]] || fail 'Usage: sudo sop import "postgresql://…"  (Neon: the DIRECT connection, no -pooler)'
    confirm "This replaces ALL data on this server with the data from the other database."
    backup before-import
    tmp="$SOP_HOME/backups/import-$(date -u +%Y%m%d-%H%M%S).dump"
    docker run --rm postgres:17-alpine pg_dump --format=custom --no-owner --no-acl --dbname="$src" > "$tmp"
    chmod 600 "$tmp"
    load_into_db "$tmp"
    ok "data imported. Sign in and check everything is there."
    echo "    Next: Settings → Notifications → connect the Telegram bot (it must point at this server)." ;;
  morning)  # called by cron
    secret="$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2-)"
    curl -fsS -m 50 -H "Authorization: Bearer $secret" http://127.0.0.1:3000/api/cron/morning >/dev/null ;;
  status)
    echo "Version:   $APP_TAG   (previous: $PREV_TAG)"
    echo "Newest:    $(git -C "$REPO" rev-parse --short=10 "origin/$BRANCH" 2>/dev/null)"
    curl -fsS -m 3 http://127.0.0.1:3000/api/health 2>/dev/null && echo || echo "Health:    not responding"
    compose ps --format 'table {{.Service}}\t{{.Status}}' 2>/dev/null || true
    echo "Disk:      $(df -h "$SOP_HOME" | awk 'NR==2 {print $4 " free"}')"
    echo "Backups:   $(ls -1 "$SOP_HOME/backups" 2>/dev/null | wc -l) (latest: $(ls -1t "$SOP_HOME/backups" 2>/dev/null | head -1))" ;;
  logs)     compose logs -f --tail "${1:-100}" app ;;
  restart)  need_root restart; compose restart app >/dev/null && ok "restarted" ;;
  *)
    cat <<'HELP'
Product SOP — server commands
  sudo sop update            Update to the newest version in sop-domain-live (also runs by itself every 5 minutes)
  sudo sop rollback          Go back to the previous version
  sudo sop backup            Back up the database now
  sop backups                List backups
  sudo sop restore <file>    Restore the database from a backup
  sudo sop import "<url>"    Copy all data from another database (e.g. Neon) into this server
  sop status                 Version, health, containers, disk, backups
  sop logs                   Follow the app log
  sudo sop restart           Restart the app
HELP
    ;;
esac
