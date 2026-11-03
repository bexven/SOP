# Pipeline — Product Pipeline SOP & Task Manager

An internal tool that moves every product from research to a running Meta campaign through fixed stages,
with an owner, an SOP checklist, a deadline and a clear handoff at every step.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Radix/shadcn-style components,
Prisma 7 and PostgreSQL. Hosted on Vercel + Neon for testing; portable to any Node host.

---

## Local development

Requirements: Node.js 22+, a PostgreSQL database (a free Neon project works, or local Postgres 16).

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # then fill in the values
npm run db:migrate          # apply migrations to your database
npm run db:seed             # create the team, settings and default checklists
npm run dev                 # http://localhost:3000
```

Sign in as **Sakib** (Admin) with `SEED_ADMIN_PIN`. Everyone else uses `SEED_DEFAULT_PIN` once and is
then asked to choose their own PIN.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run check` | Typecheck + lint + unit tests |
| `npm test` | Domain unit tests (Vitest) |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Idempotent seed — safe to re-run, never overwrites edits |
| `npm run build` | Production build (`output: "standalone"`) |

---

## What's in the app

Navigation is a menu bar across the top. Each person only sees the menus for their role.

| Menu | Who | What it does |
|---|---|---|
| **Dashboard** (home) | Everyone | Summary counts, then only your pending work: Overdue · Waiting for my review · Needs changes · Due today · Upcoming. |
| **Research** | Everyone except image/video makers | Tabs: **Pending approval** · **Approved** · **In research** · **Not approved**. **Add product** lives here (shortcut `C`). |
| **Creative** | Image designer, Video editor, Media buyer, Admin | Open creative work in two lanes: **Images** and **Videos** (designers see only their lane). |
| **Pipeline** | Everyone | Kanban by stage. |
| **Products** | Everyone | Searchable, sortable table with filters (stage, priority, person, overdue, killed). |
| **Orders** | Everyone | Products moved to ordering: orders, units, expected profit, scaling plan. |
| **Admin ▾** | Admin | Overview · Team (Master) · Roles & permissions (Master) · Settings (rates, SLAs, checklists, brands & colours). |
| **Account menu** (your photo) | Everyone | My profile & photo · Change PIN · Switch user · Sign out. |

**Product page** (`/products/<id>`): coloured in the product's brand colour, one tab per phase —
**Product review** (research, margin, review decision, creative brief once approved) · **Image creative** and
**Video creative** (brief on top, Kanban board: drag a card to *In review* and add the links; a Senior approves) ·
**Meta ads** (campaign status, launch, Image/Video asset buttons) · **Orders** (order history with each order's
own prices, scaling plan). Every phase has its own discussion. Researchers see only Product review.

**Creative workflow:** Website product images (tick ready → product page URL) → Meta ad images portrait (links)
→ square (links); Main video → Square video. Each step unlocks when a **Senior** (anyone with the
“Senior: approve creative” permission) approves the one before. **Approve + ask for…** a different angle or size
creates a follow-up task for the same person.

**Permissions:** the Master Admin ticks what each person may do on Admin ▾ → Roles & permissions.

**Keyboard:** `⌘K` / `Ctrl K` search · `C` add product · `G` then `D` Dashboard · `G` then `P` Pipeline · `Esc` closes dialogs.

**Notifications** are in-app (bell, refreshed every 30 s and when the tab regains focus).

After deploying, an Admin should add SOP checklist items for each creative task type
(Admin ▾ → Settings → Checklists). Only the research checklist is seeded. All prices are entered in BDT.

## Vercel + Neon setup (testing environment)

### 1. Neon database
1. Create a project at [neon.tech](https://neon.tech) — region **AWS Asia Pacific (Singapore)** is
   closest to Bangladesh.
2. On the project dashboard, open **Connect** and copy two connection strings:
   - **Pooled** (host contains `-pooler`) → this is `DATABASE_URL`
   - **Direct** (toggle "Connection pooling" off) → this is `DIRECT_URL`

   *Alternative:* install Neon from **Vercel → Storage / Marketplace** and connect it to the project.
   It sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) for you. The app accepts
   `DATABASE_URL_UNPOOLED` in place of `DIRECT_URL`.

### 2. Import the repository into Vercel
1. Vercel → **Add New… → Project** → import `bexven/SOP`.
2. Framework preset: **Next.js** (auto-detected). Leave Build / Install / Output commands at their
   defaults — Vercel runs the `vercel-build` script automatically, which is
   `prisma migrate deploy && next build`. `postinstall` runs `prisma generate`.
3. Node.js version: **22.x** (Project → Settings → Build and Deployment).

### 3. Environment variables
Project → Settings → **Environment Variables**. Add each for **Production** and **Preview**:

| Name | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://neondb_owner:•••@ep-cool-sun-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Pooled. Set automatically by the Neon integration. |
| `DIRECT_URL` | `postgresql://neondb_owner:•••@ep-cool-sun-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Direct. Not needed if the integration set `DATABASE_URL_UNPOOLED`. |
| `SESSION_SECRET` | output of `openssl rand -base64 48` | ≥ 32 characters. Changing it signs everyone out. |

`SEED_ADMIN_PIN` / `SEED_DEFAULT_PIN` are **not** needed on Vercel — only on the machine where you run
the seed.

### 4. ⚠️ Keep preview deployments away from your main data
Every deployment runs `prisma migrate deploy`. If previews share the production database, an unmerged
branch's migration would be applied to your real data. Choose one:
- **Recommended:** in the Neon integration settings (Vercel → Storage → your Neon database → Settings),
  enable **"Create a database branch for each Preview deployment"**. Each preview then gets its own
  copy-on-write branch of the database, with its own URLs set automatically.
- Or create a second Neon branch (e.g. `preview`) by hand and set `DATABASE_URL` / `DIRECT_URL` for the
  **Preview** environment to that branch's URLs.

### 5. First deploy, then seed once
1. Deploy (push to `main` or click **Deploy**). The build creates all tables.
2. From your own computer, seed the production database once:
   ```bash
   DIRECT_URL="<direct connection string>" SEED_ADMIN_PIN="<6 digits>" SEED_DEFAULT_PIN="<4 digits>" npm run db:seed
   ```
   Neon preview branches created after this already contain the seeded data.
3. Open the deployment, sign in as Sakib, and review **Settings → Rates & margins** (the seed uses
   placeholder rates: RMB→BDT 17, USD→BDT 122, healthy 30 %, thin 15 %) and **Task SLAs**.

---

## Moving to your own server later

The app uses only standard Next.js, Prisma and PostgreSQL. `npm run build` produces
`.next/standalone/server.js`; copy `.next/static` into `.next/standalone/.next/static` and `public`
into `.next/standalone/public`, set the same environment variables, run `npm run db:deploy`, and start it
with `node .next/standalone/server.js`. (A full VPS guide will come separately.)

---

## Project structure & rules

See [`CLAUDE.md`](./CLAUDE.md) for architecture rules, the design system and the agreed business
decisions.

## Alerts: phone notifications, Telegram and the 10:00 summary

Everything is free and needs no extra hosting settings.

**Phone / computer notifications (each person, once per device)**
1. Open the app → your photo (top right) → **My profile** → *Alerts on your phone* → **Turn on** → allow.
2. **iPhone:** first open the app in Safari → Share → **Add to Home Screen**, open it from the home screen, then turn it on.
   **Android / computers:** Chrome, Edge or Firefox work straight away.
3. Tap **Send me a test** to check.

**Telegram bot (an Admin, once for the whole team)**
1. In Telegram, open **@BotFather** → send `/newbot` → choose a name (e.g. *Product SOP*) and a username ending in `bot`
   (e.g. `bexven_sop_bot`).
2. BotFather replies with a **token** like `1234567890:AA…`. Keep it private.
3. In the app (on its public address, not localhost): **Admin ▾ → Settings → Notifications** → paste the token → **Connect bot**.
4. Optional, in BotFather: `/setuserpic` (logo) and `/setdescription`.

**Each person connects their Telegram:** My profile → **Connect Telegram** → Telegram opens → press **Start**.
They can send `/today` to the bot any time, or `/stop` to disconnect.

**Morning summary:** every day at 10:00 Dhaka, people with something waiting get one message (tasks to do, overdue,
due today, sent back, reviews, approvals, new mentions). On Vercel this is scheduled in `vercel.json`; on the free plan
it can arrive any time between 10:00 and 10:59. On a VPS add a cron job:
`*/10 * * * * curl -fsS https://your-domain/api/cron/morning` (it only sends once a day, from 10:00).
Optionally set `CRON_SECRET` in the environment (Vercel sends it automatically; on a VPS add
`-H "Authorization: Bearer $CRON_SECRET"`).
