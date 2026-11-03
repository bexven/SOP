#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Product SOP — one-time server setup with Docker (Ubuntu 24.04, Hostinger VPS).
#
#   curl -fsSL https://raw.githubusercontent.com/bexven/sop/main/deploy/setup.sh -o setup.sh
#   sudo bash setup.sh
#
# Runs the app and its database in Docker containers, with automatic HTTPS
# (Caddy), nightly backups, the 10:00 morning summary, and automatic updates
# whenever a new version is pushed to the live repo. Safe to run again.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Please run as root:  sudo bash setup.sh"; exit 1; }

SOP_HOME=/opt/sop
DOMAIN="${DOMAIN:-}"
REPO_SSH="${REPO_SSH:-git@github.com:bexven/sop-domain-live.git}"

say() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }

if [[ -z "$DOMAIN" ]]; then
  read -rp "Domain for the app [sop.bexven.tech]: " DOMAIN
  DOMAIN="${DOMAIN:-sop.bexven.tech}"
fi

say "Installing Docker and tools"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates git cron ufw openssl >/dev/null
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh >/dev/null
systemctl enable --now docker >/dev/null
docker compose version >/dev/null || { echo "Docker Compose is missing."; exit 1; }
ok "$(docker --version)"

# Small servers: swap keeps the build from running out of memory.
if [[ $(swapon --show --noheadings | wc -l) -eq 0 ]] && [[ $(awk '/MemTotal/ {print $2}' /proc/meminfo) -lt 4000000 ]]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "2 GB swap added"
fi

install -d -m 700 "$SOP_HOME" "$SOP_HOME/.ssh"
install -d -m 700 "$SOP_HOME/backups"

say "Giving this server read access to the live repo"
KEY="$SOP_HOME/.ssh/deploy_key"
[[ -f "$KEY" ]] || ssh-keygen -q -t ed25519 -N "" -C "sop-server" -f "$KEY"
ssh-keyscan -t ed25519 github.com > "$SOP_HOME/.ssh/known_hosts" 2>/dev/null
export GIT_SSH_COMMAND="ssh -i $KEY -o UserKnownHostsFile=$SOP_HOME/.ssh/known_hosts -o IdentitiesOnly=yes"
until git ls-remote "$REPO_SSH" >/dev/null 2>&1; do
  cat <<EOF

  Add this key to GitHub so the server can read the live repo:
    GitHub → bexven/sop-domain-live → Settings → Deploy keys → Add deploy key
    Title: sop-server     (leave "Allow write access" OFF)

$(cat "$KEY.pub")

EOF
  read -rp "  Press Enter when it's added… " _
done
ok "repo access works"
if [[ ! -d "$SOP_HOME/repo/.git" ]]; then
  git clone --quiet "$REPO_SSH" "$SOP_HOME/repo"
fi
git -C "$SOP_HOME/repo" config core.sshCommand "$GIT_SSH_COMMAND"
ln -sf "$SOP_HOME/repo/deploy/sop.sh" /usr/local/bin/sop
chmod +x "$SOP_HOME/repo/deploy/sop.sh"
ok "code in $SOP_HOME/repo, 'sop' command installed"

say "Settings"
if [[ ! -f "$SOP_HOME/.env" ]]; then
  umask 077
  cat > "$SOP_HOME/.env" <<EOF
# Product SOP — server settings. Private: holds passwords. Back this file up somewhere safe.
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
CRON_SECRET=$(openssl rand -hex 24)
APP_URL=https://${DOMAIN}
VAPID_SUBJECT=https://${DOMAIN}
NODE_ENV=production
EOF
  ok "created $SOP_HOME/.env (new passwords)"
else
  ok "kept $SOP_HOME/.env"
fi
cat > "$SOP_HOME/Caddyfile" <<EOF
${DOMAIN} {
	encode zstd gzip
	request_body {
		max_size 25MB
	}
	reverse_proxy app:3000
}
EOF
docker volume inspect sop-db-data >/dev/null 2>&1 || docker volume create sop-db-data >/dev/null
ok "data volume 'sop-db-data' (kept across every update)"

say "Schedules and firewall"
cat > /etc/cron.d/sop <<'EOF'
# Product SOP (server time is UTC; Dhaka = UTC+6)
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Pick up new versions pushed to the live repo.
*/5 * * * * root sop update --auto >> /opt/sop/update.log 2>&1
# Morning summary: checked every 10 minutes, sent once a day from 10:00 Dhaka.
*/10 * * * * root sop morning >/dev/null 2>&1
# Database backup every night at 02:30 Dhaka (20:30 UTC).
30 20 * * * root sop backup nightly >> /opt/sop/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/sop
ufw allow OpenSSH >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && ufw --force enable >/dev/null
ok "auto-update every 5 min · morning summary · nightly backup · firewall (SSH, HTTP, HTTPS only)"

say "Building and starting (about 5–10 minutes the first time)"
sop update --force

cat <<EOF

────────────────────────────────────────────────────────────────────────
 Done.  https://${DOMAIN}
 (The domain's A record must point at this server; the HTTPS certificate
  is issued automatically on the first visit.)

 Bring your current data from Neon:  sudo sop import "<Neon direct connection string>"
 Everything else:                     sop help
────────────────────────────────────────────────────────────────────────
EOF
