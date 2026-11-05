import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangleIcon, ClockIcon, EyeIcon, InboxIcon, KanbanSquareIcon, ListTodoIcon, RotateCcwIcon } from "lucide-react";
import { DuePill, PriorityPill } from "@/components/common/pills";
import { MANUAL_STATUS_LABELS, manualTaskRef } from "@/lib/domain/manual-tasks";
import { getMyManualTasks } from "@/lib/server/queries/manual-tasks";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { QueueGroup } from "@/components/queue/queue-list";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/server/auth/current-user";
import { getQueue, getTeamStats } from "@/lib/server/queries/queue";
import { listProducts } from "@/lib/server/queries/products";
import { filterRows, PIP_FILTERS, ProductsInProgress, type PipFilter } from "@/components/dashboard/products-in-progress";
import { AutoRefresh } from "@/components/common/auto-refresh";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const HELP: Record<string, string> = {
  RESEARCHER: "Research new products and submit them. Your drafts and any products sent back to you are below.",
  IMAGE_DESIGNER: "Your image tasks. Tick “ready” on each one, add the links and send it to a Senior for review.",
  VIDEO_EDITOR: "Your video tasks. Tick “ready” on each one, add the video links and send it to a Senior for review.",
  MEDIA_BUYER: "Work waiting for your review, plus your own tasks like writing briefs and launching campaigns.",
  REVIEWER: "Products waiting for your approval and creative work waiting for review.",
  ADMIN: "Every product in progress and who it's waiting on, then your own tasks and anything that needs a decision.",
};

function hour() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false }).format(new Date()));
}

type Tile = { label: string; value: number; icon: typeof ListTodoIcon; tone: string; href: string | null; alert?: boolean };

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
  const running = products.filter((p) => p.stage !== "COMPLETED" && p.stage !== "KILLED");
  const mine = q.today.length + q.upcoming.length + q.overdue.length + q.revision.length;
  const total = mine + q.review.length + q.unassigned.length + boardTasks.length;
  const h = hour();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const show = (PIP_FILTERS.find((f) => f.key === sp.show)?.key ?? "all") as PipFilter;
  const pipCounts = Object.fromEntries(PIP_FILTERS.map((f) => [f.key, filterRows(running, f.key).length])) as Record<PipFilter, number>;

  // Admin: whole-team numbers (each opens the matching filter). Everyone else: their own queue (each jumps to its list).
  const tiles: Tile[] = team
    ? [
        { label: "Pending tasks", value: team.pending, icon: ListTodoIcon, tone: "text-slate-600", href: "/dashboard#products-in-progress" },
        { label: "Overdue", value: team.overdue, icon: AlertTriangleIcon, tone: "text-rose-600", href: "/dashboard?show=overdue#products-in-progress", alert: true },
        { label: "Due today", value: team.today, icon: ClockIcon, tone: "text-amber-600", href: null },
        { label: "Needs changes", value: team.revision, icon: RotateCcwIcon, tone: "text-rose-600", href: "/dashboard?show=revision#products-in-progress" },
        { label: "Waiting for review", value: team.review, icon: EyeIcon, tone: "text-indigo-600", href: "/dashboard?show=review#products-in-progress" },
      ]
    : [
        { label: "My pending tasks", value: mine, icon: ListTodoIcon, tone: "text-slate-600", href: mine ? "#my-work" : null },
        { label: "Overdue", value: q.overdue.length, icon: AlertTriangleIcon, tone: "text-rose-600", href: q.overdue.length ? "#q-overdue" : null, alert: true },
        { label: "Due today", value: q.today.length, icon: ClockIcon, tone: "text-amber-600", href: q.today.length ? "#q-today" : null },
        { label: "Needs changes", value: q.revision.length, icon: RotateCcwIcon, tone: "text-rose-600", href: q.revision.length ? "#q-revision" : null },
        ...(senior
          ? [{ label: "Waiting for my review", value: q.review.length, icon: EyeIcon, tone: "text-indigo-600", href: q.review.length ? "#q-review" : null }]
          : []),
      ];

  return (
    <>
      <AutoRefresh seconds={30} />
      <div className="mb-6">
        <p className="text-meta text-slate-500">{ROLE_LABELS[user.jobRole]}{user.isMaster ? " · Master Admin" : user.adminAccess ? " · Admin access" : ""}</p>
        <h1 className="text-page text-slate-900">
          {greeting}, {user.name}
        </h1>
        <p className="mt-1 max-w-2xl text-body text-slate-600">{isAdmin ? HELP.ADMIN : HELP[user.jobRole]}</p>
      </div>

      <section aria-label={team ? "Whole team right now" : "My work right now"} className="mb-8">
        <p className="mb-2 text-meta font-normal text-slate-500">{team ? "Whole team, right now" : "Your work, right now"} · updates every 30 seconds</p>
        <div className={cn("grid grid-cols-2 gap-3 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2", tiles.length === 5 ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-4")}>
          {tiles.map((t) => {
            const body = (
              <>
                <span className="flex items-center gap-2 text-meta text-slate-600">
                  <t.icon className={cn("size-4", t.tone)} /> {t.label}
                </span>
                <span className={cn("num mt-2 block text-[28px] leading-none font-semibold tracking-tight", t.alert && t.value > 0 ? "text-rose-700" : "text-slate-900")}>
                  {t.value}
                </span>
              </>
            );
            return t.href ? (
              <Link key={t.label} href={t.href} scroll={false} className="surface raised-hover block rounded-panel p-4">
                {body}
              </Link>
            ) : (
              <div key={t.label} className="surface rounded-panel p-4">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      {isAdmin ? <ProductsInProgress rows={running} filter={show} counts={pipCounts} view={sp.view === "grid" ? "grid" : "list"} /> : null}
      {isAdmin && total ? <h2 className="mb-3 text-section text-slate-900">Needs you</h2> : null}
      {total === 0 && !(isAdmin && running.length) ? (
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
                <Link href="/research?add=1">Add a product</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div id="my-work" className="grid scroll-mt-24 gap-6">
          <QueueGroup group="overdue" items={q.overdue} />
          <QueueGroup group="review" items={q.review} showAssignee />
          <QueueGroup group="revision" items={q.revision} />
          <QueueGroup group="today" items={q.today} />
          <QueueGroup group="upcoming" items={q.upcoming} />
          <QueueGroup group="unassigned" items={q.unassigned} />
          {boardTasks.length ? (
            <section aria-labelledby="q-board" className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <h2 id="q-board" className="flex items-center gap-2 text-section text-slate-900">
                  <KanbanSquareIcon className="size-4 text-slate-500" aria-hidden /> From the Tasks board <span className="num text-meta text-slate-500">{boardTasks.length}</span>
                </h2>
                <Link href="/tasks" className="text-meta text-primary underline-offset-2 hover:underline">
                  Open board
                </Link>
              </div>
              <ul className="surface divide-y divide-slate-100 rounded-panel">
                {boardTasks.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tasks?task=${t.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-slate-50">
                      <span className="num text-meta text-slate-500">{manualTaskRef(t.number)}</span>
                      <span className="min-w-0 flex-1 text-body font-medium [overflow-wrap:anywhere] text-slate-900">
                        {t.title}
                        {t.product ? <span className="ml-2 text-meta font-normal text-slate-500">{t.product.name}</span> : null}
                      </span>
                      <span className="text-meta text-slate-600">{MANUAL_STATUS_LABELS[t.status]}</span>
                      {t.priority === "URGENT" || t.priority === "HIGH" ? <PriorityPill priority={t.priority} /> : null}
                      <DuePill dueAt={t.dueAt} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
