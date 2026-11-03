#!/usr/bin/env bash
# Product SOP — go back to the previous version of the app.  sudo sop rollback
# Only the program changes; data stays. (If the newer version changed the
# database in a way the old one can't read, restore the backup taken before
# that update: sudo sop restore /opt/sop/backups/sop-…-before-<version>.dump)
set -euo pipefail
SOP_HOME="${SOP_HOME:-/opt/sop}"
CURRENT="$(readlink -f "$SOP_HOME/current")"
PREV="$(ls -1dt "$SOP_HOME"/releases/*/ | sed 's#/$##' | grep -vx "$CURRENT" | head -1 || true)"
[[ -n "$PREV" ]] || { echo "There is no previous version to go back to."; exit 1; }
echo "Now:      $(cat "$CURRENT/RELEASE")"
echo "Go back:  $(cat "$PREV/RELEASE")"
if [[ "${SOP_YES:-}" != "1" ]]; then
  read -rp "Continue? Type yes: " yes
  [[ "$yes" == "yes" ]] || { echo "Cancelled."; exit 1; }
fi
ln -sfn "$PREV" "$SOP_HOME/current.new" && mv -Tf "$SOP_HOME/current.new" "$SOP_HOME/current"
${SOP_RESTART:-systemctl restart sop}
echo "  ✓ running $(cat "$PREV/RELEASE") again"
