# Deploying Product SOP on a VPS (Hostinger)

Everything runs on one Ubuntu server: the app, its PostgreSQL database, HTTPS (Caddy),
nightly backups and the 10:00 morning summary. One command installs it, one command updates it.

## What you need
- A **Hostinger VPS** with **Ubuntu 24.04** (KVM 1 is enough; KVM 2 is more comfortable). Pick the location closest to Bangladesh.
- A **domain or subdomain** for the app, e.g. `sop.bexven.com`.
- About 30 minutes.

## 1. Point the domain at the server
In your domain's DNS (Hostinger → Domains → DNS, or wherever the domain is managed), add:

| Type | Name | Value |
|---|---|---|
| A | `sop` (for sop.bexven.com) | your VPS IP address (Hostinger → VPS → Overview) |

DNS can take a few minutes to an hour to work.

## 2. Install (once)
Open the VPS terminal (Hostinger → VPS → **Browser terminal**, or `ssh root@YOUR-IP`) and run:

```bash
curl -fsSL https://raw.githubusercontent.com/bexven/sop/main/deploy/setup.sh -o setup.sh
sudo bash setup.sh
```

It asks for the domain (`sop.bexven.com`) and the GitHub repository (press Enter for the default).
It then installs everything and starts the app — about 5–10 minutes. When it says **Done**, open
`https://sop.bexven.com`. The HTTPS certificate is created automatically on the first visit.

> If the repository is ever made private, the script prints how to add a read-only *deploy key*.

## 3. Bring your current data over from Neon (once)
1. Vercel → your project → **Settings → Environment Variables** → copy the value of
   **`DATABASE_URL_UNPOOLED`** (or Neon → Connect → turn **Connection pooling off** → copy).
   It looks like `postgresql://…@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   (no `-pooler` in it).
2. On the VPS:
   ```bash
   sudo sop import "postgresql://…paste it here…"
   ```
   Type `yes`. Everything comes across: people, PINs, products, tasks, comments, orders, photos, settings.
3. Sign in at `https://sop.bexven.com` and check your products are there.

## 4. Switch off the old Vercel copy
So two copies don't run side by side: Vercel → project → **Settings → General → Pause Project**
(you can resume it any time). Keep Neon for a few weeks as an extra backup, then delete it if you like.

## 5. Notifications (after the move)
Phone notifications and the Telegram bot belong to the address people use, so set them up on the new domain:
- **Telegram:** Admin ▾ → Settings → Notifications → paste the bot token → **Connect bot**.
  (Use the same bot. People who already connected stay connected.)
- **Phone notifications:** everyone opens My profile → **Turn on** again (once per phone/computer).
  On iPhone, first "Add to Home Screen" from the new address.
- The **10:00 morning summary** is already scheduled on the server.

## Updating later
When a new version is ready on GitHub (`main`):

```bash
sudo sop update
```

That's all. It:
1. **backs up the database** first,
2. builds the new version **next to** the running one (the team keeps working),
3. applies any database changes — these only ever **add** to your data,
4. switches over (a few seconds) and checks the app is healthy,
5. if anything fails, it **switches back automatically** and tells you. Your data is never touched by a failed update.

Your data lives in the database, separate from the program, so updates never lose products, tasks,
photos or settings — and the look you have now stays until a new version changes it on purpose.

## Everyday commands
| Command | What it does |
|---|---|
| `sudo sop update` | Update to the latest version |
| `sudo sop rollback` | Go back to the previous version |
| `sudo sop backup` | Back up the database now |
| `sop backups` | List backups |
| `sudo sop restore <file>` | Put the database back to a backup (takes a safety backup first) |
| `sop status` | Version, health, free disk, latest backup |
| `sop logs` | Watch the app's log |
| `sudo sop restart` | Restart the app |

## Backups
- **Every night at 02:30 (Dhaka)** automatically, kept 14 days; plus one before every update (kept 30 days).
- Stored in `/opt/sop/backups`. Hostinger's own **VPS snapshots/backups** are a good second layer — turn them on.
- Off-server copies (optional): install `rclone`, connect Google Drive, then add to `/opt/sop/shared/.env`:
  `BACKUP_COPY_CMD='rclone copy {} gdrive:sop-backups'`

## Where things are
| Path | What |
|---|---|
| `/opt/sop/shared/.env` | Settings and passwords (private — don't share) |
| `/opt/sop/current` | The version that's running |
| `/opt/sop/releases` | The last 5 versions (for rollback) |
| `/opt/sop/backups` | Database backups |
| `/opt/sop/logs` | App, build and backup logs |

## If something goes wrong
- **The site doesn't open:** `sop status`. If the app is stopped: `sudo sop restart`, then `sop logs`.
- **After an update something looks wrong:** `sudo sop rollback`.
- **Data was changed by mistake:** `sop backups`, then `sudo sop restore /opt/sop/backups/<file>`.
