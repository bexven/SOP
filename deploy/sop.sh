#!/usr/bin/env bash
# Product SOP — server commands.  Run "sop help".
set -euo pipefail
SOP_HOME="${SOP_HOME:-/opt/sop}"
BIN="$SOP_HOME/bin"
need_root() { [[ $EUID -eq 0 ]] || { echo "Run with sudo:  sudo sop $*"; exit 1; }; }
cmd="${1:-help}"; shift || true
case "$cmd" in
  update)   need_root "$cmd"; exec "$BIN/update.sh" "$@" ;;
  rollback) need_root "$cmd"; exec "$BIN/rollback.sh" "$@" ;;
  backup)   need_root "$cmd"; exec "$BIN/backup.sh" manual ;;
  backups)  ls -1th "$SOP_HOME/backups" | head -30 ;;
  restore)  need_root "$cmd"; exec "$BIN/restore.sh" "$@" ;;
  import)   need_root "$cmd"; exec "$BIN/import.sh" "$@" ;;
  status)
    echo "Version:  $(cat "$SOP_HOME/current/RELEASE" 2>/dev/null || echo none)"
    systemctl is-active --quiet sop && echo "App:      running" || echo "App:      STOPPED"
    curl -fsS -m 3 http://127.0.0.1:3000/api/health 2>/dev/null && echo || echo "Health:   not responding"
    echo "Disk:     $(df -h "$SOP_HOME" | awk 'NR==2 {print $4 " free"}')"
    echo "Backups:  $(ls -1 "$SOP_HOME/backups" 2>/dev/null | wc -l) (latest: $(ls -1t "$SOP_HOME/backups" 2>/dev/null | head -1))"
    ;;
  logs)     exec tail -n "${1:-100}" -f "$SOP_HOME/logs/app.log" ;;
  restart)  need_root "$cmd"; systemctl restart sop && echo "  ✓ restarted" ;;
  *)
    cat <<'HELP'
Product SOP — server commands
  sudo sop update            Update to the latest version (backup → build → switch → check; undoes itself if it fails)
  sudo sop update --ref X    Deploy a specific version (commit or branch)
  sudo sop rollback          Go back to the previous version
  sudo sop backup            Back up the database now
  sop backups                List backups
  sudo sop restore <file>    Restore the database from a backup
  sudo sop import "<url>"    Copy all data from another database (e.g. Neon) into this server
  sop status                 Version, health, disk space, backups
  sop logs                   Follow the app log
  sudo sop restart           Restart the app
HELP
    ;;
esac
