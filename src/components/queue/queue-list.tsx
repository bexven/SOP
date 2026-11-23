import { BrandPill, DuePill, PriorityPill, TaskStatusPill } from "@/components/common/pills";
import { ListColumns, ListGroup, ListRow, type GroupTone } from "@/components/common/list-view";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { TASK_TYPE_LABELS } from "@/lib/domain/labels";
import type { QueueItem } from "@/lib/server/queries/queue";

const GROUPS = {
  overdue: { title: "Overdue", tone: "rose" },
  review: { title: "Waiting for my review", tone: "violet" },
  revision: { title: "Needs changes", tone: "orange" },
  today: { title: "Due today", tone: "amber" },
  upcoming: { title: "Upcoming", tone: "sky" },
  unassigned: { title: "Unassigned — needs a person", tone: "slate" },
} as const satisfies Record<string, { title: string; tone: GroupTone }>;

export type QueueGroupKey = keyof typeof GROUPS;

/** Task · Product · Status · Due · Person (one template for the header and every row). */
export const WORK_COLS = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_8.5rem_7.5rem_2rem]";

export function WorkColumns() {
  return (
    <ListColumns className={WORK_COLS}>
      <span>Task</span>
      <span>Product</span>
      <span>Status</span>
      <span>Due</span>
      <span className="sr-only">Person</span>
    </ListColumns>
  );
}

/** One ClickUp-style group of workflow tasks on the Home page. Each row opens the task on its product page. */
export function QueueGroup({ group, items, showAssignee }: { group: QueueGroupKey; items: QueueItem[]; showAssignee?: boolean }) {
  if (items.length === 0) return null;
  const g = GROUPS[group];
  return (
    <ListGroup id={`q-${group}`} label={g.title} tone={g.tone} count={items.length} columns={<WorkColumns />}>
      {items.map((t) => (
        <ListRow key={t.id} href={`/products/${t.product.id}?task=${t.id}`} className={WORK_COLS} tone={group === "overdue" ? "danger" : undefined}>
          <span className="flex min-w-0 items-center gap-2.5">
            <Thumbnail src={t.product.imageUrl} alt="" className="size-7 rounded-[6px]" />
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-900 group-hover/row:text-primary">
                {group === "review" ? "Review: " : ""}
                {TASK_TYPE_LABELS[t.type]}
              </span>
              {t.revisionNote && t.status === "REVISION" ? <span className="block truncate text-meta font-normal text-rose-700">“{t.revisionNote}”</span> : null}
              <span className="flex min-w-0 items-center gap-2 text-meta font-normal text-slate-500 md:hidden">
                <span className="truncate">{t.product.name}</span>
              </span>
            </span>
          </span>
          <span className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="truncate text-slate-700">{t.product.name}</span>
            <BrandPill brand={t.product.brand} className="shrink-0" />
          </span>
          <span className="flex flex-wrap items-center gap-2 md:contents">
            <span>
              <TaskStatusPill status={t.status} />
            </span>
            <span className="flex items-center gap-2">
              <DuePill dueAt={t.dueAt} />
              {t.priority === "URGENT" || t.priority === "HIGH" ? <PriorityPill priority={t.priority} className="md:hidden" /> : null}
            </span>
            <span className="max-md:ml-auto">
              {(showAssignee || group === "unassigned") && t.assignee ? (
                <UserAvatar name={t.assignee.name} color={t.assignee.avatarColor} imageId={t.assignee.avatarAssetId} size="xs" />
              ) : group === "unassigned" ? (
                <span className="block size-5 rounded-full border border-dashed border-slate-300" title="Nobody yet" />
              ) : null}
            </span>
          </span>
        </ListRow>
      ))}
    </ListGroup>
  );
}
