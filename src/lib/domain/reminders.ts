/** Due reminders (pure): one "due soon" ping about 3 hours before, and one when it becomes overdue. */

export const DUE_SOON_HOURS = 3;

export type ReminderKind = "soon" | "overdue";

/**
 * Which reminder (if any) to send now. A reminder already sent for an earlier due time doesn't count, so
 * moving the due date re-arms both reminders.
 */
export function reminderKind(
  t: { dueAt: Date | null; dueSoonNotifiedAt: Date | null; overdueNotifiedAt: Date | null },
  now: Date,
): ReminderKind | null {
  if (!t.dueAt) return null;
  const due = t.dueAt.getTime();
  const soonFrom = due - DUE_SOON_HOURS * 3_600_000;
  if (now.getTime() >= due) {
    return t.overdueNotifiedAt && t.overdueNotifiedAt.getTime() >= due ? null : "overdue";
  }
  if (now.getTime() >= soonFrom) {
    return t.dueSoonNotifiedAt && t.dueSoonNotifiedAt.getTime() >= soonFrom ? null : "soon";
  }
  return null;
}
