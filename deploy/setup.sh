#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Product SOP — one-time server setup (Ubuntu 24.04, e.g. a Hostinger VPS).
#
#   curl -fsSL https://raw.githubusercontent.com/bexven/sop/main/deploy/setup.sh -o setup.sh
#   sudo bash setup.sh
#
# Installs Node.js 22, PostgreSQL 17, Caddy (automatic HTTPS), creates the
# database, a service that starts on boot, daily backups and the 10:00 morning
# summary, then builds and starts the app. Safe to run again: existing data,
# passwords and settings are kept.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "Please run as root:  sudo bash setup.sh"; exit 1; }

SOP_HOME=/opt/sop
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-}"

say() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }

if [[ -z "$DOMAIN" ]]; then
  read -rp "Domain for the app (e.g. sop.bexven.com): " DOMAIN
fi
DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%%/*}"
[[ -n "$DOMAIN" ]] || { echo "A domain is required."; exit 1; }
if [[ -z "$REPO_URL" ]]; then
  read -rp "GitHub repository [https://github.com/bexven/sop.git]: " REPO_URL
  REPO_URL="${REPO_URL:-https://github.com/bexven/sop.git}"
fi

say "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git ufw cron rsync openssl lsb-release debian-keyring debian-archive-keyring apt-transport-https >/dev/null
ok "base packages"

# Swap helps the build on small servers (it needs ~2 GB of memory).
if [[ $(swapon --show --noheadings | wc -l) -eq 0 ]] && [[ $(awk '/MemTotal/ {print $2}' /proc/meminfo) -lt 4000000 ]]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "2 GB swap added"
fi

if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
ok "Node.js $(node -v)"

if ! command -v psql >/dev/null || ! dpkg -l postgresql-17 >/dev/null 2>&1; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq && apt-get install -y -qq postgresql-17 >/dev/null
fi
systemctl enable --now postgresql >/dev/null
ok "PostgreSQL 17"

if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi
ok "Caddy (HTTPS)"

say "Creating the app user and folders"
id sop >/dev/null 2>&1 || useradd --system --home-dir "$SOP_HOME" --shell /bin/bash sop
install -d -o sop -g sop "$SOP_HOME" "$SOP_HOME/releases" "$SOP_HOME/shared" "$SOP_HOME/backups" "$SOP_HOME/bin" "$SOP_HOME/logs"
ok "$SOP_HOME"

say "Database"
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='sop'" | grep -q 1; then
  DB_PASS="$(openssl rand -hex 24)"
  runuser -u postgres -- psql -q -c "CREATE ROLE sop LOGIN PASSWORD '${DB_PASS}'"
  runuser -u postgres -- createdb -O sop sop
  ok "database 'sop' created"
else
  DB_PASS=""
  ok "database already exists (kept)"
fi

ENV_FILE="$SOP_HOME/shared/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  [[ -n "$DB_PASS" ]] || { echo "The database exists but $ENV_FILE is missing. Restore it from your notes, then run again."; exit 1; }
  umask 077
  cat > "$ENV_FILE" <<EOF
# Product SOP — server settings. Keep this file private (it holds passwords).
DATABASE_URL=postgresql://sop:${DB_PASS}@127.0.0.1:5432/sop
DIRECT_URL=postgresql://sop:${DB_PASS}@127.0.0.1:5432/sop
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
CRON_SECRET=$(openssl rand -hex 24)
APP_URL=https://${DOMAIN}
VAPID_SUBJECT=https://${DOMAIN}
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
EOF
  chown sop:sop "$ENV_FILE"; chmod 600 "$ENV_FILE"
  ok "settings written to $ENV_FILE"
else
  ok "settings kept ($ENV_FILE)"
fi
echo "BRANCH=${BRANCH}" > "$SOP_HOME/shared/deploy.conf"
echo "DOMAIN=${DOMAIN}" >> "$SOP_HOME/shared/deploy.conf"

say "Getting the code"
if [[ ! -d "$SOP_HOME/repo.git" ]]; then
  if ! runuser -u sop -- git clone --quiet --mirror "$REPO_URL" "$SOP_HOME/repo.git"; then
    cat <<EOF

  Couldn't read the repository. If it is private, give this server read access:
    1. runuser -u sop -- ssh-keygen -t ed25519 -N "" -f $SOP_HOME/.ssh/id_ed25519
    2. Copy $SOP_HOME/.ssh/id_ed25519.pub into GitHub → repo → Settings → Deploy keys (read-only)
    3. Run setup again with REPO_URL=git@github.com:bexven/sop.git
EOF
    exit 1
  fi
fi
runuser -u sop -- git --git-dir="$SOP_HOME/repo.git" fetch --quiet --prune origin "+refs/heads/*:refs/heads/*"
TMP="$(mktemp -d)"
git --git-dir="$SOP_HOME/repo.git" archive "$BRANCH" deploy | tar -x -C "$TMP"
install -m 755 "$TMP"/deploy/*.sh "$SOP_HOME/bin/"
rm -rf "$TMP"
ln -sf "$SOP_HOME/bin/sop.sh" /usr/local/bin/sop
ok "code mirror + 'sop' command installed"

say "Service, web server, schedules, firewall"
cat > /etc/systemd/system/sop.service <<EOF
[Unit]
Description=Product SOP
After=network.target postgresql.service
Wants=postgresql.service

[Service]
User=sop
Group=sop
WorkingDirectory=${SOP_HOME}/current/.next/standalone
EnvironmentFile=${SOP_HOME}/shared/.env
ExecStart=/usr/bin/node ${SOP_HOME}/current/.next/standalone/server.js
Restart=always
RestartSec=3
StandardOutput=append:${SOP_HOME}/logs/app.log
StandardError=append:${SOP_HOME}/logs/app.log
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable sop >/dev/null
ok "service 'sop' (starts on boot)"

cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
	request_body {
		max_size 25MB
	}
}
EOF
ok "Caddy → https://${DOMAIN} (certificate is automatic)"

CRON_SECRET_VALUE="$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2-)"
cat > /etc/cron.d/sop <<EOF
# Product SOP schedules (server time is UTC; Dhaka = UTC+6)
SHELL=/bin/bash
# Morning summary: checked every 10 minutes, sent once a day from 10:00 Dhaka.
*/10 * * * * sop curl -fsS -m 50 -H "Authorization: Bearer ${CRON_SECRET_VALUE}" http://127.0.0.1:3000/api/cron/morning >/dev/null 2>&1
# Database backup every night at 02:30 Dhaka (20:30 UTC), kept 14 days.
30 20 * * * root ${SOP_HOME}/bin/backup.sh nightly >> ${SOP_HOME}/logs/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/sop
cat > /etc/logrotate.d/sop <<EOF
${SOP_HOME}/logs/*.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF
ok "morning summary + nightly backup scheduled"

ufw allow OpenSSH >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && ufw --force enable >/dev/null
ok "firewall: only SSH, HTTP and HTTPS are open"

say "Building and starting the app (takes a few minutes the first time)"
"$SOP_HOME/bin/update.sh" --no-backup
systemctl reload caddy || systemctl restart caddy

cat <<EOF

────────────────────────────────────────────────────────────────────────
 Done. Open https://${DOMAIN}
 (Point the domain's A record at this server first — the HTTPS certificate
  is issued automatically on the first visit.)

 Moving your current data from Neon:   sudo sop import "<Neon direct connection string>"
 Updating later:                        sudo sop update
 Everything else:                       sop help
────────────────────────────────────────────────────────────────────────
EOF
