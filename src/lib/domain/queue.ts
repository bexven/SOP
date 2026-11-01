import type { Priority, TaskStatus } from "@/generated/prisma/enums";
import { dueBucket } from "./due";
import { PRIORITY_RANK } from "./labels";

/** My Queue grouping (pure): Overdue · Due today · Upcoming · In revision. */

export type QueueItem = { id: string; status: TaskStatus; dueAt: Date | null; priority: Priority };
export type QueueGroups<T> = { overdue: T[]; today: T[]; upcoming: T[]; revision: T[] };

const byDueThenPriority = (a: QueueItem, b: QueueItem) => {
  const ad = a.dueAt?.getTime() ?? Infinity;
  const bd = b.dueAt?.getTime() ?? Infinity;
  if (ad !== bd) return ad - bd;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
};

/** Only actionable tasks (TODO, REVISION) belong in a person's queue. */
export function groupQueue<T extends QueueItem>(items: T[], now: Date): QueueGroups<T> {
  const groups: QueueGroups<T> = { overdue: [], today: [], upcoming: [], revision: [] };
  for (const item of items) {
    if (item.status === "REVISION") groups.revision.push(item);
    else if (item.status === "TODO") {
      const bucket = dueBucket(item.dueAt, now);
      if (bucket === "overdue") groups.overdue.push(item);
      else if (bucket === "today") groups.today.push(item);
      else groups.upcoming.push(item);
    }
  }
  for (const list of Object.values(groups)) list.sort(byDueThenPriority);
  return groups;
}
