import Link from "next/link";
import { AlertTriangleIcon, CalendarIcon, ClockIcon, EyeIcon, RotateCcwIcon, UserRoundXIcon } from "lucide-react";
import { DuePill, PriorityPill, StagePill, TaskStatusPill } from "@/components/common/pills";
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
      <ul className="surface divide-y divide-slate-100 overflow-hidden rounded-panel">
        {items.map((t) => (
          <li key={t.id}>
            <Link href={`/products/${t.product.id}?task=${t.id}`} className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-slate-50/80 sm:px-4">
              <Thumbnail src={t.product.imageUrl} alt="" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-slate-900">{TASK_TYPE_LABELS[t.type]}</span>
                <span className="block truncate text-meta font-normal text-slate-500">
                  <span className="num">{t.product.ref}</span> · {t.product.name}
                </span>
                {t.revisionNote && t.status === "REVISION" ? (
                  <span className="mt-1 block truncate text-meta text-rose-700">“{t.revisionNote}”</span>
                ) : null}
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
                  <TaskStatusPill status={t.status} />
                  <DuePill dueAt={t.dueAt} />
                </span>
              </span>
              <span className="hidden items-center gap-1.5 md:flex">
                <StagePill stage={t.product.stage} />
                <PriorityPill priority={t.priority} />
                <DuePill dueAt={t.dueAt} />
                <TaskStatusPill status={t.status} />
              </span>
              {showAssignee && t.assignee ? <UserAvatar name={t.assignee.name} color={t.assignee.avatarColor} imageId={t.assignee.avatarAssetId} size="sm" /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
