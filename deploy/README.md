# Going live with Docker — sop.bexven.tech

## How the two repos work
| | Repo | Runs on | Data |
|---|---|---|---|
| **Testing** | `bexven/sop` | Vercel (preview links) | test data |
| **Live** | `bexven/sop-domain-live` | your VPS, in Docker | the real data |

New features are built and checked in `sop`. When you say **"Push it to live domain"**, the approved
version is pushed to `sop-domain-live`. Within ~5 minutes the server picks it up by itself and updates:
**backup → build next to the running version → database changes (additive only) → switch → health check →
automatic switch-back if anything fails.** The database lives in its own container and volume, so updates
never touch your data.

## On the server: three containers
- **db** — PostgreSQL 17. Data in the Docker volume `sop-db-data` (external: `docker compose down` can't delete it).
- **app** — Product SOP.
- **caddy** — HTTPS for `sop.bexven.tech` (free certificate, renewed automatically).

## One-time setup (about 20 minutes)
1. **VPS:** Hostinger KVM 1 or 2 with **Ubuntu 24.04** (the "with Docker" template is fine).
2. **DNS:** where `bexven.tech` is managed, add an **A record**: name `sop` → the VPS IP.
3. **Install:** Hostinger → VPS → **Browser terminal**:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/bexven/sop/main/deploy/setup.sh -o setup.sh
   ```
   ```bash
   sudo bash setup.sh
   ```
   Press Enter for `sop.bexven.tech`. The script shows a **deploy key** — add it in GitHub →
   `bexven/sop-domain-live` → Settings → **Deploy keys** → Add (title `sop-server`, *no* write access) — then press Enter.
   It builds and starts everything.
4. **Bring the data from Neon:** Vercel → project → Settings → Environment Variables → copy
   `DATABASE_URL_UNPOOLED` (no `-pooler`). On the server:
   ```bash
   sudo sop import "postgresql://…"
   ```
5. Open **https://sop.bexven.tech** and sign in.
6. **Notifications** (after the move — they belong to the address): Settings → Notifications → connect the
   Telegram bot; everyone turns phone notifications on again in My profile.
7. The Vercel copy becomes the **test** site: give it its own test database and don't connect the Telegram bot there.

## Commands on the server
| Command | What it does |
|---|---|
| `sudo sop update` | Update now (it also runs by itself every 5 minutes) |
| `sudo sop rollback` | Go back to the previous version |
| `sudo sop backup` | Back up the database now (also every night at 02:30 Dhaka) |
| `sop backups` | List backups (`/opt/sop/backups`) |
| `sudo sop restore <file>` | Put the database back to a backup (takes a safety backup first) |
| `sop status` | Version, health, containers, disk, backups |
| `sop logs` | Follow the app log |

## Files on the server
| Path | What |
|---|---|
| `/opt/sop/.env` | Passwords and settings — keep a copy somewhere safe |
| `/opt/sop/repo` | Code from `sop-domain-live` |
| `/opt/sop/backups` | Database backups (nightly kept 14 days, before each update 30 days) |
| Docker volume `sop-db-data` | The live database |

Also turn on **Hostinger's VPS backups** as a second safety net.
