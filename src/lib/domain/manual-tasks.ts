import type { ManualTaskStatus } from "@/generated/prisma/enums";

/** Board columns, left to right. */
export const MANUAL_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const satisfies readonly ManualTaskStatus[];

export const MANUAL_STATUS_LABELS: Record<ManualTaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

export function manualTaskRef(number: number): string {
  return `T-${number}`;
}

/** The creator, the assignee and Admins can change, move or delete a task; anyone can comment. */
export function canEditManualTask(
  user: { id: string; role: string },
  task: { createdById: string; assigneeId: string | null },
): boolean {
  return user.role === "ADMIN" || task.createdById === user.id || task.assigneeId === user.id;
}

/**
 * Position for a card dropped between two neighbours (positions grow downwards).
 * No neighbours → 1000; top → before − 1000; bottom → after + 1000; between → midpoint.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1000;
  if (before === null) return after! - 1000;
  if (after === null) return before + 1000;
  return (before + after) / 2;
}

/** completedAt is set when a task reaches Done and cleared when it leaves Done. */
export function completedAtFor(from: ManualTaskStatus, to: ManualTaskStatus, previous: Date | null, now: Date): Date | null {
  if (to === "DONE") return from === "DONE" ? previous : now;
  return null;
}
