import type { Metadata } from "next";
import { Suspense } from "react";
import { AddProductButton } from "@/components/research/add-product-button";
import { canAddProduct, canAddRunningProduct } from "@/lib/domain/resources";
import { getBrands } from "@/lib/server/queries/product";
import Link from "next/link";
import { InboxIcon, ListChecksIcon, UsersIcon } from "lucide-react";
import { ListGroup, ListRow, StatStrip } from "@/components/common/list-view";
import { WelcomeGuide } from "@/components/dashboard/welcome-guide";
import { BrandPill, DuePill, PriorityPill } from "@/components/common/pills";
import { productScope } from "@/lib/server/services/brand-scope";
import { Thumbnail } from "@/components/common/thumbnail";
import { canPlaceTestOrder, testOrderState } from "@/lib/domain/orders";
import { formatDate } from "@/lib/format";
import { getOpenTestOrders } from "@/lib/server/queries/orders";
import { MANUAL_STATUS_LABELS, manualTaskRef } from "@/lib/domain/manual-tasks";
import { getMyManualTasks } from "@/lib/server/queries/manual-tasks";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { QueueGroup } from "@/components/queue/queue-list";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/server/auth/current-user";
import { db } from "@/lib/server/db";
import { getQueue, getTeamStats } from "@/lib/server/queries/queue";
import { listProducts } from "@/lib/server/queries/products";
import { filterRows, PIP_FILTERS, ProductsInProgress, type PipFilter } from "@/components/dashboard/products-in-progress";
import { AutoRefresh } from "@/components/common/auto-refresh";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

const HELP: Record<string, string> = {
  RESEARCHER: "your drafts and anything sent back to you.",
  IMAGE_DESIGNER: "your image tasks: add the links, then send each one for review.",
  VIDEO_EDITOR: "your video tasks: add the links, then send each one for review.",
  MEDIA_BUYER: "work waiting for your review, plus briefs and launches.",
  REVIEWER: "products waiting for approval and creative work to review.",
  ADMIN: "Every product in progress and who it's waiting on, then your own tasks and anything that needs a decision.",
  ADMIN_MINE: "reviews, unassigned work and your own tasks.",
  CUSTOMER_SUPPORT: "tasks from the Tasks board, with due times.",
  OFFICE_SECRETARY: "tasks from the Tasks board, with due times.",
  SUPPLY_CHAIN: "test orders to place, units on their way and your tasks.",
};

function hour() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false }).format(new Date()));
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const senior = can(user, "task.review");
  const sp = await searchParams;
  const [q, products, team, boardTasks] = await Promise.all([
    getQueue(user),
    isAdmin ? listProducts(user) : Promise.resolve([]),
    isAdmin ? getTeamStats(user) : Promise.resolve(null),
    getMyManualTasks(user),
  ]);
  const testOrders = canPlaceTestOrder(user) ? await getOpenTestOrders(user) : [];
  // Product review: products waiting for an approve / not-approved decision (people who review products).
  const toApprove = can(user, "product.approve")
    ? await db.product.findMany({
        where: { AND: [productScope(user)], stage: "REVIEW" },
        orderBy: { stageEnteredAt: "asc" },
        select: { id: true, name: true, imageUrl: true, stageEnteredAt: true, brand: { select: { name: true, color: true } }, createdBy: { select: { name: true } } },
      })
    : [];
  // People who can be picked for unassigned work (only loaded when there is some).
  const assignPeople = q.unassigned.length
    ? (
        await db.user.findMany({
          where: { removedAt: null, active: true },
          select: { id: true, name: true, avatarColor: true, avatarAssetId: true, role: true, isMaster: true, brandAccess: true },
          orderBy: { name: "asc" },
        })
      ).map((p) => ({ ...p, brandAccess: [...p.brandAccess] }))
    : [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  const brands = canAddProduct(user) ? await getBrands(user) : [];
  const running = products.filter((p) => p.stage !== "COMPLETED" && p.stage !== "KILLED");
  const mine = q.today.length + q.upcoming.length + q.overdue.length + q.revision.length;
  const total = mine + toApprove.length + q.review.length + q.unassigned.length + boardTasks.length + testOrders.length + q.sent.length + q.done.length;
  const h = hour();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const show = (PIP_FILTERS.find((f) => f.key === sp.show)?.key ?? "all") as PipFilter;
  const pipCounts = Object.fromEntries(PIP_FILTERS.map((f) => [f.key, filterRows(running, f.key).length])) as Record<PipFilter, number>;

  const tab: "mine" | "team" = isAdmin && (sp.tab === "team" || typeof sp.show === "string" || typeof sp.view === "string") ? "team" : "mine";
  const stats = team && tab === "team"
    ? [
        { label: "open tasks", value: team.pending },
        { label: "overdue", value: team.overdue, tone: "danger" as const, href: "/dashboard?tab=team&show=overdue" },
        { label: "due today", value: team.today, tone: "warn" as const },
        { label: "need changes", value: team.revision, tone: "warn" as const, href: "/dashboard?tab=team&show=revision" },
        { label: "waiting for review", value: team.review, tone: "accent" as const, href: "/dashboard?tab=team&show=review" },
      ]
    : [
        { label: "my open tasks", value: mine },
        { label: "overdue", value: q.overdue.length, tone: "danger" as const, href: q.overdue.length ? "#q-overdue" : undefined },
        { label: "due today", value: q.today.length, tone: "warn" as const, href: q.today.length ? "#q-today" : undefined },
        { label: "need changes", value: q.revision.length, tone: "warn" as const, href: q.revision.length ? "#q-revision" : undefined },
        ...(toApprove.length ? [{ label: "products to approve", value: toApprove.length, tone: "accent" as const, href: "#q-approve" }] : []),
        ...(senior ? [{ label: "to review", value: q.review.length, tone: "accent" as const, href: q.review.length ? "#q-review" : undefined }] : []),
        ...(testOrders.length ? [{ label: "test orders", value: testOrders.length, href: "#q-tests" }] : []),
        ...(boardTasks.length ? [{ label: "board tasks", value: boardTasks.length, href: "#q-board" }] : []),
      ];

  return (
    <>
      <AutoRefresh seconds={30} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-page text-slate-900">Home</h1>
          <p className="mt-0.5 text-meta font-normal text-slate-500">
            {greeting}, {user.name} · {ROLE_LABELS[user.jobRole]}
            {user.isMaster ? " · Master Admin" : user.adminAccess ? " · Admin access" : ""}
            <span className="hidden md:inline"> — {tab === "team" ? "every product in progress and who it's waiting on." : (isAdmin ? HELP.ADMIN_MINE : HELP[user.jobRole])}</span>
          </p>
        </div>
        {canAddProduct(user) ? (
          <Suspense>
            <AddProductButton brands={brands.filter((b) => b.active)} canResearch={can(user, "product.create")} canRunning={canAddRunningProduct(user)} label="Add Product" />
          </Suspense>
        ) : null}
      </div>

      {isAdmin ? (
        <nav aria-label="Home views" className="mb-4 flex gap-5 border-b border-[var(--line)]">
          {(
            [
              ["mine", "My Work", "/dashboard", ListChecksIcon],
              ["team", "Team", "/dashboard?tab=team", UsersIcon],
            ] as const
          ).map(([k, label, href, Icon]) => (
            <Link
              key={k}
              href={href}
              scroll={false}
              aria-current={tab === k ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-0.5 pb-2 text-body font-medium transition-colors",
                tab === k ? "border-primary text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
              {k === "team" ? <span className="num text-meta font-normal text-slate-500">{running.length}</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}

      <WelcomeGuide userId={user.id} role={isAdmin ? "ADMIN" : user.jobRole} name={user.name} />
      <StatStrip items={stats.filter((s, i) => i === 0 || s.value > 0)} />

      {tab === "team" ? (
        <ProductsInProgress rows={running} filter={show} counts={pipCounts} view={sp.view === "grid" ? "grid" : "list"} />
      ) : total === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="You're all caught up"
          description={
            can(user, "product.create")
              ? "Nothing is waiting on you. Add the next product to research when you're ready."
              : "Nothing is waiting on you right now. New tasks and reviews appear here, and you'll get a notification."
          }
          action={
            can(user, "product.create") ? (
              <Button asChild>
                <Link href="/research?add=1">Add Product</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div id="my-work">
          <QueueGroup group="overdue" items={q.overdue} />
          {toApprove.length ? (
            <ListGroup id="q-approve" label="Products to approve" tone="indigo" count={toApprove.length}>
              {toApprove.map((p) => (
                <ListRow key={p.id} href={`/products/${p.id}`} className={TEST_COLS}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Thumbnail src={p.imageUrl} alt="" className="size-7 rounded-[6px]" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900 group-hover/row:text-primary">{p.name}</span>
                      <span className="block truncate text-meta font-normal text-slate-500">Researched by {p.createdBy?.name ?? "—"}</span>
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-3 text-meta text-slate-600">
                    <BrandPill brand={p.brand} />
                    <span>Waiting since {formatDate(p.stageEnteredAt)}</span>
                  </span>
                </ListRow>
              ))}
            </ListGroup>
          ) : null}
          {/* Admins see reviews as something to watch (how long it has waited); Seniors act on them in the row. */}
          <QueueGroup group="review" items={q.review} showAssignee watchOnly={isAdmin} title={isAdmin ? "Waiting for review" : undefined} />
          <QueueGroup group="revision" items={q.revision} />
          <QueueGroup group="today" items={q.today} />
          <QueueGroup group="upcoming" items={q.upcoming} />
          <QueueGroup group="unassigned" items={q.unassigned} people={assignPeople} viewerIsAdmin={isAdmin} canAssign={isAdmin || can(user, "task.reassignAny")} />
          <QueueGroup group="sent" items={q.sent} />
          {testOrders.length ? (
            <ListGroup id="q-tests" label="Test orders" tone="amber" count={testOrders.length}>
              {testOrders.map((t) => {
                const state = testOrderState(t, today);
                return (
                  <ListRow key={t.id} href={`/products/${t.product.id}?phase=orders`} className={TEST_COLS} tone={state === "overdue" ? "danger" : undefined}>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Thumbnail src={t.product.imageUrl} alt="" className="size-7 rounded-[6px]" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900 group-hover/row:text-primary">Test order: {t.name}</span>
                        <span className="block truncate text-meta font-normal text-slate-500">{t.product.name}</span>
                      </span>
                    </span>
                    <span className={cn("text-meta", state === "requested" ? "text-slate-700" : state === "overdue" ? "text-rose-700" : "text-amber-800")}>
                      {state === "requested"
                        ? "Needs placing — mark it as ordered"
                        : `${state === "overdue" ? "Was expected" : "Expected"} ${t.expectedOn ? formatDate(new Date(`${t.expectedOn}T00:00:00Z`)) : ""}`}
                    </span>
                  </ListRow>
                );
              })}
            </ListGroup>
          ) : null}
          {boardTasks.length ? (
            <ListGroup
              id="q-board"
              label="Tasks board"
              tone="indigo"
              count={boardTasks.length}
              action={
                <Link href="/tasks" className="text-meta text-primary underline-offset-2 hover:underline">
                  Open board
                </Link>
              }
            >
              {boardTasks.map((t) => (
                <ListRow key={t.id} href={`/tasks?task=${t.id}`} className={BOARD_COLS}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900 group-hover/row:text-primary">{t.title}</span>
                    <span className="block truncate text-meta font-normal text-slate-500">
                      {manualTaskRef(t.number)}
                      {t.product ? ` · ${t.product.name}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-3 md:contents">
                    <span className="text-meta text-slate-600">{MANUAL_STATUS_LABELS[t.status]}</span>
                    <PriorityPill priority={t.priority} />
                    <DuePill dueAt={t.dueAt} />
                  </span>
                </ListRow>
              ))}
            </ListGroup>
          ) : null}
          <QueueGroup group="done" items={q.done} defaultOpen={false} />
        </div>
      )}
    </>
  );
}

const TEST_COLS = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]";
const BOARD_COLS = "md:grid-cols-[minmax(0,1.6fr)_7rem_6rem_7.5rem]";
