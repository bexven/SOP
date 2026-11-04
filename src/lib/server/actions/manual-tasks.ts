"use server";

import { revalidatePath } from "next/cache";
import type { ManualTaskStatus } from "@/generated/prisma/enums";
import { canEditManualTask, completedAtFor, MANUAL_STATUS_LABELS, manualTaskRef, positionBetween } from "@/lib/domain/manual-tasks";
import { extractMentions } from "@/lib/domain/mentions";
import {
  createManualTaskSchema,
  manualCommentSchema,
  manualTaskIdSchema,
  moveManualTaskSchema,
  updateManualTaskSchema,
} from "@/lib/validation/manual-tasks";
import { ActionError, defineAction } from "../action";
import type { CurrentUser } from "../auth/current-user";
import { db, type Tx } from "../db";
import { notify, type NotificationInput } from "../services/events";
import { manualTaskScope } from "../queries/manual-tasks";

function revalidate() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

const link = (id: string) => `/tasks?task=${id}`;

/** Loads a task the user may see (restricted brands stay hidden), optionally requiring edit rights. */
async function loadTask(tx: Tx, user: CurrentUser, id: string, needEdit: boolean) {
  const task = await tx.manualTask.findFirst({ where: { AND: [{ id }, manualTaskScope(user)] } });
  if (!task) throw new ActionError("This task no longer exists.");
  if (needEdit && !canEditManualTask(user, task)) throw new ActionError("Only the person who created it, the assignee or an Admin can change this task.");
  return task;
}

async function checkPeople(tx: Tx, assigneeId: string | null) {
  if (!assigneeId) return;
  const u = await tx.user.findUnique({ where: { id: assigneeId }, select: { active: true, removedAt: true } });
  if (!u?.active || u.removedAt) throw new ActionError("Pick someone active on the team.");
}

async function bottomPosition(tx: Tx, status: ManualTaskStatus) {
  const last = await tx.manualTask.findFirst({ where: { status }, orderBy: { position: "desc" }, select: { position: true } });
  return positionBetween(last?.position ?? null, null);
}

export const createManualTaskAction = defineAction({
  schema: createManualTaskSchema,
  run: async ({ status, dueAt, ...fields }, { user }) => {
    const task = await db.$transaction(async (tx) => {
      await checkPeople(tx, fields.assigneeId);
      const now = new Date();
      const task = await tx.manualTask.create({
        data: {
          ...fields,
          status,
          dueAt: dueAt ? new Date(dueAt) : null,
          position: await bottomPosition(tx, status),
          createdById: user.id,
          completedAt: status === "DONE" ? now : null,
        },
      });
      await notify(tx, user.id, [
        {
          userId: task.assigneeId,
          type: "TASK_ASSIGNED",
          productId: task.productId,
          link: link(task.id),
          message: `${user.name} gave you ${manualTaskRef(task.number)} “${task.title}”`,
        },
      ]);
      return task;
    });
    revalidate();
    return { ok: true, message: `${manualTaskRef(task.number)} added`, data: { id: task.id } };
  },
});

export const updateManualTaskAction = defineAction({
  schema: updateManualTaskSchema,
  run: async ({ manualTaskId, dueAt, ...fields }, { user }) => {
    await db.$transaction(async (tx) => {
      const before = await loadTask(tx, user, manualTaskId, true);
      await checkPeople(tx, fields.assigneeId);
      const task = await tx.manualTask.update({ where: { id: manualTaskId }, data: { ...fields, dueAt: dueAt ? new Date(dueAt) : null } });
      if (task.assigneeId && task.assigneeId !== before.assigneeId) {
        await notify(tx, user.id, [
          {
            userId: task.assigneeId,
            type: "TASK_ASSIGNED",
            productId: task.productId,
            link: link(task.id),
            message: `${user.name} gave you ${manualTaskRef(task.number)} “${task.title}”`,
          },
        ]);
      }
    });
    revalidate();
    return { ok: true, message: "Task saved" };
  },
});

export const moveManualTaskAction = defineAction({
  schema: moveManualTaskSchema,
  run: async ({ manualTaskId, status, beforeId, afterId }, { user }) => {
    await db.$transaction(async (tx) => {
      const task = await loadTask(tx, user, manualTaskId, true);
      const [before, after] = await Promise.all([
        beforeId ? tx.manualTask.findUnique({ where: { id: beforeId }, select: { position: true, status: true } }) : null,
        afterId ? tx.manualTask.findUnique({ where: { id: afterId }, select: { position: true, status: true } }) : null,
      ]);
      const position =
        before?.status === status || after?.status === status
          ? positionBetween(before?.status === status ? before.position : null, after?.status === status ? after.position : null)
          : await bottomPosition(tx, status);
      const now = new Date();
      // Guarded: fails cleanly if someone else moved it at the same moment.
      const moved = await tx.manualTask.updateMany({
        where: { id: manualTaskId, status: task.status },
        data: { status, position, completedAt: completedAtFor(task.status, status, task.completedAt, now) },
      });
      if (moved.count !== 1) throw new ActionError("Someone else just moved this task. Refresh and try again.");
      if (task.status === status) return;
      const ref = `${manualTaskRef(task.number)} “${task.title}”`;
      const notes: NotificationInput[] = [];
      if (status === "IN_REVIEW") notes.push({ userId: task.createdById, type: "REVIEW_REQUESTED", productId: task.productId, link: link(task.id), message: `${ref} is ready for your review` });
      if (status === "DONE") {
        for (const uid of [task.createdById, task.assigneeId]) notes.push({ userId: uid, type: "TASK_APPROVED", productId: task.productId, link: link(task.id), message: `${ref} is done` });
      }
      if (status !== "IN_REVIEW" && status !== "DONE" && task.assigneeId) {
        notes.push({ userId: task.assigneeId, type: "TASK_REASSIGNED", productId: task.productId, link: link(task.id), message: `${ref} moved to ${MANUAL_STATUS_LABELS[status]}` });
      }
      await notify(tx, user.id, notes);
    });
    revalidate();
    return { ok: true, message: `Moved to ${MANUAL_STATUS_LABELS[status]}` };
  },
});

export const deleteManualTaskAction = defineAction({
  schema: manualTaskIdSchema,
  run: async ({ manualTaskId }, { user }) => {
    const task = await db.$transaction(async (tx) => {
      const task = await loadTask(tx, user, manualTaskId, false);
      if (user.role !== "ADMIN" && task.createdById !== user.id) throw new ActionError("Only the person who created it or an Admin can delete this task.");
      await tx.manualTask.delete({ where: { id: manualTaskId } });
      return task;
    });
    revalidate();
    return { ok: true, message: `${manualTaskRef(task.number)} deleted` };
  },
});

export const addManualCommentAction = defineAction({
  schema: manualCommentSchema,
  run: async ({ manualTaskId, body }, { user }) => {
    await db.$transaction(async (tx) => {
      const task = await loadTask(tx, user, manualTaskId, false);
      await tx.manualTaskComment.create({ data: { taskId: task.id, authorId: user.id, body } });
      const people = await tx.user.findMany({ where: { active: true, removedAt: null }, select: { id: true, name: true } });
      const mentioned = extractMentions(body, people);
      const ref = `${manualTaskRef(task.number)} “${task.title}”`;
      const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
      await notify(tx, user.id, [
        ...mentioned.map((uid) => ({ userId: uid, type: "MENTIONED" as const, productId: task.productId, link: link(task.id), message: `${user.name} mentioned you on ${ref}: ${preview}` })),
        ...[task.createdById, task.assigneeId]
          .filter((uid) => uid && !mentioned.includes(uid))
          .map((uid) => ({ userId: uid, type: "FEEDBACK" as const, productId: task.productId, link: link(task.id), message: `${user.name} commented on ${ref}: ${preview}` })),
      ]);
    });
    revalidate();
    return { ok: true, message: "Comment posted" };
  },
});
