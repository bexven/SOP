import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangleIcon, ClockIcon, EyeIcon, InboxIcon, ListTodoIcon, RotateCcwIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { QueueGroup } from "@/components/queue/queue-list";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/server/auth/current-user";
import { getQueue } from "@/lib/server/queries/queue";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const HELP: Record<string, string> = {
  RESEARCHER: "Research new products and submit them. Your drafts and any products sent back to you are below.",
  IMAGE_DESIGNER: "Your image tasks. Upload your images on each task and submit for review.",
  VIDEO_EDITOR: "Your video tasks. Add your Drive links on each task and submit for review.",
  MEDIA_BUYER: "Work waiting for your review, plus your own tasks like writing briefs and launching campaigns.",
  ADMIN: "Your own tasks, anything nobody is assigned to, and work waiting for review.",
};

function hour() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false }).format(new Date()));
}

export default async function DashboardPage() {
  const user = await requireUser();
  const q = await getQueue(user);
  const pending = q.today.length + q.upcoming.length + q.overdue.length + q.revision.length;
  const total = pending + q.review.length + q.unassigned.length;
  const h = hour();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  const tiles = [
    { label: "Pending tasks", value: pending, icon: ListTodoIcon, tone: "text-slate-700", show: true },
    { label: "Overdue", value: q.overdue.length, icon: AlertTriangleIcon, tone: "text-rose-600", show: true },
    { label: "Due today", value: q.today.length, icon: ClockIcon, tone: "text-amber-600", show: true },
    { label: "Needs changes", value: q.revision.length, icon: RotateCcwIcon, tone: "text-rose-600", show: true },
    { label: "Waiting for my review", value: q.review.length, icon: EyeIcon, tone: "text-indigo-600", show: user.role === "MEDIA_BUYER" || user.role === "ADMIN" },
  ].filter((t) => t.show);

  return (
    <>
      <div className="mb-6">
        <p className="text-meta text-slate-500">{ROLE_LABELS[user.role]}</p>
        <h1 className="text-page text-slate-900">
          {greeting}, {user.name}
        </h1>
        <p className="mt-1 max-w-2xl text-body text-slate-600">{HELP[user.role]}</p>
      </div>

      <section aria-label="Summary" className={cn("mb-6 grid grid-cols-2 gap-3", tiles.length === 5 ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
        {tiles.map((t) => (
          <div key={t.label} className="surface rounded-panel p-4">
            <span className="flex items-center gap-2 text-meta text-slate-600">
              <t.icon className={cn("size-4", t.tone)} /> {t.label}
            </span>
            <span className={cn("num mt-2 block text-[28px] leading-none font-semibold tracking-tight", t.value > 0 && t.label === "Overdue" ? "text-rose-700" : "text-slate-900")}>
              {t.value}
            </span>
          </div>
        ))}
      </section>

      {total === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="You're all caught up"
          description={
            can(user.role, "product.create")
              ? "Nothing is waiting on you. Add the next product to research when you're ready."
              : "Nothing is waiting on you right now. New tasks and reviews appear here, and you'll get a notification."
          }
          action={
            can(user.role, "product.create") ? (
              <Button asChild>
                <Link href="/research?add=1">Add a product</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6">
          <QueueGroup group="overdue" items={q.overdue} />
          <QueueGroup group="review" items={q.review} showAssignee />
          <QueueGroup group="revision" items={q.revision} />
          <QueueGroup group="today" items={q.today} />
          <QueueGroup group="upcoming" items={q.upcoming} />
          <QueueGroup group="unassigned" items={q.unassigned} />
        </div>
      )}
    </>
  );
}
