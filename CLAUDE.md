@AGENTS.md

# Product Pipeline SOP & Task Manager — project rules

Internal SOP + task tool for a Bangladesh e-commerce team: "Linear for our product launch pipeline".
Not an accounting or analytics product. English UI, Asia/Dhaka time, BDT with lakh grouping.

## Working agreement
- Build **one phase at a time** on its own branch (`phase-N-name`). At the end of a phase run
  `npm run check` (typecheck + lint + tests), push, summarise, list deferred items, then **stop for review**.
- **Ask when a business rule is ambiguous. Never invent business rules.** Decisions already made are
  recorded below under "Agreed decisions".
- **No fake data in production code paths.** Demo/initial data lives only in `prisma/seed.ts`.
- Small, meaningful commits. No model names in commits, PRs or code.

## Status
All six phases are built (foundation, research & SOP engine, creative & review, launch & live,
collaboration & views, overview & polish). The owner asked to build straight through and test at the end.
Browser acceptance scripts were run per phase against a local Postgres; Lighthouse accessibility = 100 on
every page.

## Stack (pinned)
Next.js 16 App Router + TypeScript strict · Tailwind CSS v4 · shadcn-style components on `radix-ui`
(hand-written in `src/components/ui`, the shadcn registry is not reachable from cloud sessions) ·
lucide-react · motion · sonner · cmdk · TanStack Table **v8** (v9 is a different API) · @dnd-kit (checklist reordering only) ·
Prisma 7 + PostgreSQL via `@prisma/adapter-pg` · zod v4 · Vitest · Geist fonts via the `geist` package.

## Portability (non-negotiable)
- Standard Next.js + Prisma + Postgres only. **No Vercel-only services** (KV, Blob, Edge Config, Vercel Postgres SDK).
- `output: "standalone"` stays on; the app must run with `node .next/standalone/server.js` on a VPS.
- No file uploads: every asset is a link (Drive, store URL, image URL).
- Do not add Docker/VPS files until asked.

## Rendering model
- `cacheComponents` is **off** on purpose: every page is authenticated and request-specific.
- Pages that read the DB but no cookies (e.g. `/login`) must call `await connection()` so they are not
  prerendered at build time.
- Next 16 renamed middleware to **`src/proxy.ts`**. It only checks the cookie signature (edge-safe, no DB).

## Architecture rules
- **All business rules live in `src/lib/domain/`** as pure, unit-tested functions (no Prisma client,
  no Next imports; importing enums from `@/generated/prisma/enums` is fine). Tests sit next to the file
  (`*.test.ts`).
- Domain functions for workflow steps return **plans** (task updates, new tasks, stage change, events,
  notifications); the server applies a plan inside **one** Prisma transaction.
- **Every server action uses `defineAction`** (`src/lib/server/action.ts`): authenticate → authorise by
  capability → validate with zod → transaction → ActivityEvent → notifications → revalidate.
- **Never trust the client** for identity, role or permissions. UI hiding is cosmetic. Pages call
  `requireUser()` / `requireCapability()`; actions declare a `capability`.
- The role × capability matrix is `src/lib/domain/permissions.ts`. Admin has every capability.
- State changes use guarded updates (`updateMany where status = <expected>`) so races fail cleanly.
- Money is `Decimal` in the DB (never Float); pass it to the client as strings; do maths with `decimal.js`.
- Zod schemas live in `src/lib/validation/` and are shared by forms and actions.
- Sessions: JWT (jose, HS256) in an httpOnly cookie, 30 days, carrying `sessionVersion`. Bumping
  `User.sessionVersion` revokes all of that user's sessions (deactivate, PIN reset, PIN change).

## Layout
```
prisma/            schema.prisma, migrations/, seed.ts
src/proxy.ts       cookie-signature gate
src/app/(auth)/    login, change-pin
src/app/(app)/     authenticated shell + pages
src/lib/domain/    pure business rules + tests
src/lib/server/    db, env, auth/, action.ts, actions/, queries/
src/lib/validation zod schemas
src/components/    ui/ (primitives), common/, shell/, auth/, team/, settings/, …
src/generated/     Prisma client (generated, git-ignored)
```

## Design system
- Light only. Glass (`glass`, `glass-strong` utilities) for the app frame and floating layers only:
  sidebar, top bar, dialogs, sheets, popovers, toasts, command palette. Never stack more than 2–3 blurred
  layers; never blur table rows or list items.
- Dense data sits on solid white (`surface` utility); hover lift uses `raised`.
- Write only the standard `backdrop-filter` property in CSS — the build adds the `-webkit-` prefix.
  (Writing both makes the minifier keep only the prefixed one, which Chromium ignores.)
- Type scale utilities: `text-page` (24/600), `text-section` (15/600), `text-body` (14), `text-meta` (12/500).
  Numbers, prices, dates and IDs use the `num` utility (Geist Mono, tabular-nums).
- Radius: `rounded-panel` (14px) for cards/panels, `rounded-control` (10px) for inputs/buttons, full for pills.
- Stage colours: Research sky · Creative violet · Ready to Launch amber · Live emerald · Completed slate ·
  Killed rose. Priority: Urgent rose · High orange · Medium amber · Low slate. Pills are soft tints with
  darker same-hue text (`Pill` component), never solid saturated blocks.
- Motion 150–250 ms ease-out; respect `prefers-reduced-motion`. Skeletons, not spinners, for page content.
- Every empty state says what will appear and what to do next. WCAG AA contrast, visible focus.

## Gotchas learned the hard way
- Horizontal scroll containers must be `relative`: `sr-only` text inside them is `position:absolute`
  and otherwise escapes the scroller and widens the whole page on mobile.
- Grid/flex children that hold wide content need `min-w-0` / `grid-cols-[minmax(0,1fr)]`.
- Never dim content with `opacity` (fails AA contrast); use a muted background instead.
- `--color-slate-500` is overridden (darker) in `globals.css` so tertiary text passes AA on glass.
- Events written in one transaction share a timestamp: order timelines by `createdAt` then `id`.
- `npm run typecheck` runs `next typegen` first (route types for `PageProps<"/route">`).
- A `"use server"` file may only export async functions.

## Agreed decisions (from the brief review)
- Q1 Each product has an owning Media Buyer (`Product.mediaBuyerId`), auto-assigned at research submit;
  they write the brief, get review notifications and launch. Any Media Buyer or Admin may still review.
- Q2 Send-back Creative → Research cancels open creative tasks and reopens Research as REVISION;
  resubmitting creates a new batch (next number) with Phase 1 gating.
- Q3 If a Phase 1 task is reopened, its non-approved Phase 2 dependents go back to LOCKED; approved stay approved.
- Q4 Media Buyer may send back Creative → Research and Ready to Launch → Creative; Admin any stage to an
  earlier one. When sending to Creative the actor picks which tasks to reopen.
- Q5 No send-back from LIVE (use a new creative batch or Kill).
- Q6 Mark Completed auto-cancels open tasks (with confirmation).
- Q7 KILLED is terminal.
- Q8 Deactivating someone re-runs auto-assignment on their open tasks; if nobody is available they stay
  unassigned and Admin is notified.
- Q9 The creative brief is not a gate; tasks show "Brief pending" until it is written.
- Q10 Batch #N may include any of the 6 creative types (never the store listing); it snapshots the brief.
- Q11 Seeded non-admins and admin PIN resets set `mustChangePin`.
- Q12 Everyone can view all products/pipeline; mutations are role-gated.
- Q13 Stepper shows "Creative · Phase 2 & Store" once both Phase 1 tasks are approved.
- Q14 Campaign STOPPED ≠ COMPLETED; completion is an explicit action.
- Auto-assignment counts LOCKED + TODO + REVISION + SUBMITTED as open; tie → least recently assigned.
- Research task belongs to its creator (Admin-created → auto-assigned to a Researcher).
- Rate snapshot refreshes on every save while in RESEARCH and freezes at submit.
- Due dates = unlock time + SLA hours (wall clock, Asia/Dhaka for display/"due today").
- Margin badge is informational only, never blocks submit.
- Admin override edits data fields only, never stage/status.
- Notifications are in-app, polled (~30 s) — no websockets.

## Commands
`npm run dev` · `npm run check` · `npm test` · `npm run db:migrate` (create migration, local) ·
`npm run db:deploy` · `npm run db:seed` · `npm run build`
