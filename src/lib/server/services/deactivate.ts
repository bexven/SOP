import "server-only";
import { OPEN_STATUSES } from "@/lib/domain/assignment";
import { TASK_TYPE_LABELS } from "@/lib/domain/labels";
import type { Tx } from "../db";
import { autoAssign } from "./assign";
import { activeAdminIds, logEvents, notify, type EventInput, type NotificationInput } from "./events";

/**
 * Q8: when someone is deactivated, their open tasks are re-run through
 * auto-assignment. Tasks nobody can take stay unassigned and Admins are told.
 * Products they owned as media buyer get a new owner the same way.
 * Call AFTER the user has been marked inactive (so they are not picked).
 */
export async function redistributeWork(tx: Tx, userId: string, actorId: string) {
  const now = new Date();
  const tasks = await tx.task.findMany({
    where: { assigneeId: userId, status: { in: [...OPEN_STATUSES] } },
    include: { product: { select: { id: true, name: true, brandId: true } } },
    orderBy: { createdAt: "asc" },
  });
  // One brand at a time, so restricted brands only go to people with access.
  const picks: (string | null)[] = new Array(tasks.length).fill(null);
  for (const brandId of [...new Set(tasks.map((t) => t.product.brandId))]) {
    const idx = tasks.flatMap((t, i) => (t.product.brandId === brandId ? [i] : []));
    const got = await autoAssign(tx, idx.map((i) => tasks[i]!.role), now, { brandId });
    idx.forEach((i, k) => (picks[i] = got[k] ?? null));
  }
  const admins = await activeAdminIds(tx);
  const events: EventInput[] = [];
  const notes: NotificationInput[] = [];
  let unassigned = 0;

  for (const [i, task] of tasks.entries()) {
    const next = picks[i] ?? null;
    await tx.task.update({ where: { id: task.id }, data: { assigneeId: next, assignedAt: next ? now : null } });
    events.push({
      type: "TASK_REASSIGNED",
      actorId,
      productId: task.productId,
      taskId: task.id,
      data: { from: userId, to: next, reason: "deactivated" },
    });
    const label = TASK_TYPE_LABELS[task.type];
    if (next) {
      notes.push({
        userId: next,
        type: "TASK_REASSIGNED",
        productId: task.productId,
        taskId: task.id,
        message: `${label} for ${task.product.name} was reassigned to you`,
      });
    } else {
      unassigned += 1;
      for (const a of admins) {
        notes.push({
          userId: a,
          type: "TASK_UNASSIGNED",
          productId: task.productId,
          taskId: task.id,
          message: `${label} for ${task.product.name} has nobody to do it — please assign it`,
        });
      }
    }
  }

  const owned = await tx.product.findMany({
    where: { mediaBuyerId: userId, stage: { notIn: ["COMPLETED", "KILLED"] } },
    select: { id: true, name: true, brandId: true },
  });
  if (owned.length) {
    const owners: (string | null)[] = [];
    for (const p of owned) owners.push((await autoAssign(tx, ["MEDIA_BUYER"], now, { brandId: p.brandId }))[0] ?? null);
    for (const [i, p] of owned.entries()) {
      await tx.product.update({ where: { id: p.id }, data: { mediaBuyerId: owners[i] ?? null } });
      notes.push({
        userId: owners[i],
        type: "TASK_REASSIGNED",
        productId: p.id,
        message: `You're now the media buyer for ${p.name}`,
      });
    }
  }

  await logEvents(tx, events);
  await notify(tx, actorId, notes);
  return { moved: tasks.length - unassigned, unassigned, products: owned.length };
}
