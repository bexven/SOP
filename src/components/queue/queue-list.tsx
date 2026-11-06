import Link from "next/link";
import { AlertTriangleIcon, ArrowRightIcon, CalendarIcon, ClockIcon, EyeIcon, ListChecksIcon, RotateCcwIcon, UserRoundXIcon } from "lucide-react";
import { BrandPill, DuePill, PriorityPill, StagePill, TaskStatusPill } from "@/components/common/pills";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { TASK_TYPE_LABELS } from "@/lib/domain/labels";
import type { QueueItem } from "@/lib/server/queries/queue";
import { cn } from "@/lib/utils";

const GROUPS = {
  overdue: { title: "Overdue", icon: AlertTriangleIcon, tone: "text-rose-600" },
  today: { title: "Due today", icon: ClockIcon, tone: "text-amber-600" },
  revision: { title: "In revision", icon: RotateCcwIcon, tone: "text-rose-600" },
  review: { title: "Waiting for my review", icon: EyeIcon, tone: "text-indigo-600" },
  upcoming: { title: "Upcoming", icon: CalendarIcon, tone: "text-slate-500" },
  unassigned: { title: "Unassigned — needs a person", icon: UserRoundXIcon, tone: "text-amber-600" },
} as const;

export type QueueGroupKey = keyof typeof GROUPS;

export function QueueGroup({ group, items, showAssignee }: { group: QueueGroupKey; items: QueueItem[]; showAssignee?: boolean }) {
  if (items.length === 0) return null;
  const g = GROUPS[group];
  return (
    <section aria-labelledby={`q-${group}`}>
      <h2 id={`q-${group}`} className="mb-2 flex scroll-mt-24 items-center gap-2 text-section text-slate-900">
        <g.icon className={cn("size-4", g.tone)} /> {g.title} <span className="num text-meta text-slate-500">{items.length}</span>
      </h2>
      <ul className="grid gap-2">
        {items.map((t) => (
          <li key={t.id}>
            <Link
              href={`/products/${t.product.id}?task=${t.id}`}
              className={cn(
                "surface group flex items-center gap-3 rounded-panel p-3 ring-1 ring-transparent transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:shadow-md sm:gap-4 sm:p-3.5 motion-reduce:hover:translate-y-0",
                group === "overdue" && "ring-rose-200",
                group === "revision" && "ring-rose-100",
              )}
            >
              <Thumbnail src={t.product.imageUrl} alt="" className="size-14 rounded-control sm:size-16" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <BrandPill brand={t.product.brand} />
                  <span className="truncate text-body font-semibold text-slate-900 group-hover:underline group-hover:underline-offset-2">{t.product.name}</span>
                </span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-meta text-slate-700">
                  <ListChecksIcon className="size-3.5 shrink-0 text-slate-500" aria-hidden />
                  <span className="truncate">
                    {group === "review" ? "To review: " : group === "unassigned" ? "Needs a person: " : "Your task: "}
                    <span className="font-semibold text-slate-900">{TASK_TYPE_LABELS[t.type]}</span>
                    {showAssignee && t.assignee ? <span className="font-normal text-slate-500"> · by {t.assignee.name}</span> : null}
                  </span>
                </span>
                {t.revisionNote && t.status === "REVISION" ? (
                  <span className="mt-1 block truncate text-meta text-rose-700">Change asked: “{t.revisionNote}”</span>
                ) : null}
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <TaskStatusPill status={t.status} />
                  <DuePill dueAt={t.dueAt} />
                  <span className="hidden sm:contents">
                    <StagePill stage={t.product.stage} />
                    {t.priority === "URGENT" || t.priority === "HIGH" ? <PriorityPill priority={t.priority} /> : null}
                  </span>
                </span>
              </span>
              {showAssignee && t.assignee ? (
                <UserAvatar name={t.assignee.name} color={t.assignee.avatarColor} imageId={t.assignee.avatarAssetId} size="sm" className="hidden sm:inline-flex" />
              ) : null}
              <span aria-hidden className="hidden items-center gap-1 rounded-control px-2 py-1 text-meta text-slate-600 transition-colors group-hover:bg-slate-900/[0.05] group-hover:text-slate-900 sm:inline-flex">
                Open <ArrowRightIcon className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
