import Link from "next/link";
import { BrandPill, DuePill, PriorityPill, TaskStatusPill } from "@/components/common/pills";
import { cn } from "@/lib/utils";
import { AssignQuickAction, ReadyQuickAction, ReviewQuickActions } from "./quick-actions";
import { ListColumns, ListGroup, type GroupTone } from "@/components/common/list-view";
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
export const WORK_COLS = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_8.5rem_7.5rem_minmax(2rem,auto)]";

export function WorkColumns() {
  return (
    <ListColumns className={WORK_COLS}>
      <span>Task</span>
      <span>Product</span>
      <span>Status</span>
      <span>Due</span>
      <span className="sr-only">Actions</span>
    </ListColumns>
  );
}

type AssignPerson = Parameters<typeof AssignQuickAction>[0]["people"][number];

/**
 * One ClickUp-style group of workflow tasks on the Home page. The whole row opens the task (link overlay);
 * quick actions sit above it: Approve / Changes (reviews), Send for review (own work), Assign (unassigned).
 */
export function QueueGroup({
  group,
  items,
  showAssignee,
  people = [],
  viewerIsAdmin = false,
  canAssign = false,
}: {
  group: QueueGroupKey;
  items: QueueItem[];
  showAssignee?: boolean;
  people?: AssignPerson[];
  viewerIsAdmin?: boolean;
  canAssign?: boolean;
}) {
  if (items.length === 0) return null;
  const g = GROUPS[group];
  return (
    <ListGroup id={`q-${group}`} label={g.title} tone={g.tone} count={items.length} columns={<WorkColumns />}>
      {items.map((t) => {
        const label = TASK_TYPE_LABELS[t.type];
        const mineOpen = group !== "review" && group !== "unassigned" && (t.status === "TODO" || t.status === "REVISION");
        return (
          <li
            key={t.id}
            className={cn(
              "group/row relative grid min-h-11 items-center gap-x-3 gap-y-1.5 px-3 py-2 text-body transition-colors duration-100 hover:bg-hover",
              WORK_COLS,
              group === "overdue" && "shadow-[inset_3px_0_0_var(--color-rose-500)]",
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Thumbnail src={t.product.imageUrl} alt="" className="size-7 rounded-[6px]" />
              <span className="min-w-0">
                <Link
                  href={`/products/${t.product.id}?task=${t.id}`}
                  className="block truncate font-medium text-slate-900 outline-none after:absolute after:inset-0 group-hover/row:text-primary focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                >
                  {group === "review" ? "Review: " : ""}
                  {label}
                </Link>
                {t.revisionNote && t.status === "REVISION" ? <span className="block truncate text-meta font-normal text-rose-700">“{t.revisionNote}”</span> : null}
                <span className="block truncate text-meta font-normal text-slate-500 md:hidden">{t.product.name}</span>
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
              <span className="relative z-10 flex items-center justify-end gap-2 max-md:ml-auto">
                {group === "review" ? <ReviewQuickActions taskId={t.id} label={`${label}, ${t.product.name}`} /> : null}
                {mineOpen ? <ReadyQuickAction productId={t.product.id} taskId={t.id} label={`${label}, ${t.product.name}`} /> : null}
                {group === "unassigned" && canAssign ? (
                  <AssignQuickAction taskId={t.id} taskRole={t.role} brand={t.product.brand} people={people} viewerIsAdmin={viewerIsAdmin} />
                ) : null}
                {showAssignee && t.assignee ? <UserAvatar name={t.assignee.name} color={t.assignee.avatarColor} imageId={t.assignee.avatarAssetId} size="xs" /> : null}
              </span>
            </span>
          </li>
        );
      })}
    </ListGroup>
  );
}
