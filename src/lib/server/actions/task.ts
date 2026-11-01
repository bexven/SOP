"use server";

import { revalidatePath } from "next/cache";
import { isChecklistComplete, missingRequiredCount } from "@/lib/domain/checklist";
import { isOpenStatus } from "@/lib/domain/assignment";
import { FOLLOW_UP_LABELS, isReviewedType, submissionError, TASK_TYPE_LABELS, TASK_TYPE_SHORT } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import {
  canWorkOnTask,
  isTerminalStage,
  planApprove,
  planRequestRevision,
  planSubmitTask,
  planWithdraw,
  reassignError,
} from "@/lib/domain/workflow";
import { laneOf } from "@/lib/domain/labels";
import {
  approveTaskSchema,
  folderSchema,
  markReadySchema,
  briefSchema,
  itemCommentSchema,
  reactSchema,
  reassignSchema,
  revisionSchema,
  submitTaskSchema,
} from "@/lib/validation/task";
import { ActionError, defineAction } from "../action";
import { db, type Tx } from "../db";
import { applyPlan } from "../services/apply-plan";
import { logEvents, notify } from "../services/events";
import { loadSnapshot } from "../services/snapshot";

function revalidate() {
  revalidatePath("/", "layout");
}

async function taskWithProduct(tx: Tx, taskId: string) {
  const task = await tx.task.findUnique({ where: { id: taskId }, select: { id: true, productId: true } });
  if (!task) throw new ActionError("This task no longer exists.");
  return loadSnapshot(tx, task.productId);
}

/** Who gets "review requested": the product's media buyer (else every media buyer) plus every Reviewer. */
async function reviewers(tx: Tx, mediaBuyerId: string | null): Promise<string[]> {
  const reviewerIds = (await tx.user.findMany({ where: { role: "REVIEWER", active: true }, select: { id: true } })).map((u) => u.id);
  if (mediaBuyerId) {
    const mb = await tx.user.findUnique({ where: { id: mediaBuyerId }, select: { active: true } });
    if (mb?.active) return [mediaBuyerId, ...reviewerIds];
  }
  const mbs = (await tx.user.findMany({ where: { role: "MEDIA_BUYER", active: true }, select: { id: true } })).map((u) => u.id);
  return [...mbs, ...reviewerIds];
}

export const submitTaskAction = defineAction({
  schema: submitTaskSchema,
  run: async ({ taskId, images, links, note }, { user }) => {
    const now = new Date();
    const label = await db.$transaction(async (tx) => {
      const { product, snap } = await taskWithProduct(tx, taskId);
      const task = snap.tasks.find((t) => t.id === taskId)!;
      if (!canWorkOnTask(user, task)) throw new ActionError("Only the assignee or an Admin can submit this task.");
      const imageIds = [...new Set(images)];
      const missing = submissionError(task.type, { images: imageIds.length, links: links.length });
      if (missing) throw new ActionError(missing);
      if (imageIds.length) {
        const owned = await tx.asset.findMany({
          where: { id: { in: imageIds }, ...(user.role === "ADMIN" ? {} : { uploadedById: user.id }) },
          select: { id: true },
        });
        if (owned.length !== imageIds.length) throw new ActionError("One of the images is missing. Upload it again.");
      }
      const checklist = await tx.checklistItem.findMany({ where: { taskId } });
      if (!isChecklistComplete(checklist)) {
        const n = missingRequiredCount(checklist);
        throw new ActionError(`Tick the remaining ${n} required checklist item${n === 1 ? "" : "s"} first.`);
      }
      const planned = planSubmitTask(snap, taskId);
      if (!planned.ok) throw new ActionError(planned.error);
      const last = await tx.taskSubmission.aggregate({ where: { taskId }, _max: { version: true } });
      await tx.taskSubmission.create({
        data: {
          taskId,
          version: (last._max.version ?? 0) + 1,
          note,
          submittedById: user.id,
          createdAt: now,
          items: {
            create: [
              ...imageIds.map((assetId, i) => ({ order: i, kind: "IMAGE" as const, assetId })),
              ...links.map((l, i) => ({ order: imageIds.length + i, kind: "LINK" as const, url: l.url, label: l.label })),
            ],
          },
        },
      });
      await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      const label = TASK_TYPE_LABELS[task.type];
      await notify(
        tx,
        user.id,
        (await reviewers(tx, product.mediaBuyerId)).map((id) => ({
          userId: id,
          type: "REVIEW_REQUESTED" as const,
          productId: product.id,
          taskId,
          message: `${user.name} submitted ${label} for ${product.name}`,
        })),
      );
      return label;
    });
    revalidate();
    return { ok: true, message: `${label} submitted for review` };
  },
});

export const approveTaskAction = defineAction({
  capability: "task.review",
  schema: approveTaskSchema,
  run: async ({ taskId, note, followUp }, { user }) => {
    const now = new Date();
    const out = await db.$transaction(async (tx) => {
      const { product, snap } = await taskWithProduct(tx, taskId);
      const task = snap.tasks.find((t) => t.id === taskId)!;
      if (!isReviewedType(task.type)) throw new ActionError("This task isn't reviewed.");
      const planned = planApprove(snap, taskId, { followUp });
      if (!planned.ok) throw new ActionError(planned.error);
      const latest = await tx.taskSubmission.findFirst({ where: { taskId }, orderBy: { version: "desc" } });
      if (latest) {
        await tx.taskSubmission.update({
          where: { id: latest.id },
          data: { decision: "APPROVED", decisionNote: note, decidedById: user.id, decidedAt: now },
        });
      }
      const applied = await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      if (followUp) {
        await logEvents(tx, [
          { type: "FOLLOW_UP_REQUESTED", actorId: user.id, productId: product.id, taskId, data: { kind: followUp.kind, note: followUp.note } },
        ]);
      }
      return { type: task.type, applied, stage: planned.plan.stage };
    });
    revalidate();

    const parts = [`${TASK_TYPE_SHORT[out.type]} approved`];
    if (followUp) parts.push(`${FOLLOW_UP_LABELS[followUp.kind]} requested`);
    if (out.applied.unlocked.length) {
      const who = [...new Set(out.applied.unlocked.map((u) => u.assigneeName).filter(Boolean))];
      parts.push(`Phase 2 unlocked${who.length ? ` for ${who.join(" & ")}` : ""}`);
    }
    if (out.stage?.to === "READY_TO_LAUNCH") parts.push("All creative approved — ready to launch");
    return {
      ok: true,
      message: parts.join(" · "),
      data: { unlocked: out.applied.unlocked.map((u) => u.id), readyToLaunch: out.stage?.to === "READY_TO_LAUNCH" },
    };
  },
});

export const requestRevisionAction = defineAction({
  capability: "task.review",
  schema: revisionSchema,
  run: async ({ taskId, note }, { user }) => {
    const now = new Date();
    const label = await db.$transaction(async (tx) => {
      const { product, snap } = await taskWithProduct(tx, taskId);
      const planned = planRequestRevision(snap, taskId, note);
      if (!planned.ok) throw new ActionError(planned.error);
      const latest = await tx.taskSubmission.findFirst({ where: { taskId }, orderBy: { version: "desc" } });
      if (latest) {
        await tx.taskSubmission.update({
          where: { id: latest.id },
          data: { decision: "REVISION", decisionNote: note, decidedById: user.id, decidedAt: now },
        });
      }
      await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      return TASK_TYPE_SHORT[snap.tasks.find((t) => t.id === taskId)!.type];
    });
    revalidate();
    return { ok: true, message: `Revision requested on ${label}` };
  },
});

export const reassignTaskAction = defineAction({
  schema: reassignSchema,
  run: async ({ taskId, assigneeId }, { user }) => {
    const now = new Date();
    const msg = await db.$transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: { id: taskId },
        include: { product: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } } },
      });
      if (!task) throw new ActionError("This task no longer exists.");
      const target = await tx.user.findUnique({ where: { id: assigneeId } });
      if (!target) throw new ActionError("That person no longer exists.");
      const err = reassignError(user, task, target);
      if (err) throw new ActionError(err);
      const updated = await tx.task.updateMany({
        where: { id: taskId, assigneeId: task.assigneeId, status: task.status },
        data: { assigneeId, assignedAt: now },
      });
      if (updated.count !== 1) throw new ActionError("This task changed just now. Refresh and try again.");
      await tx.user.update({ where: { id: assigneeId }, data: { lastAssignedAt: now } });
      const label = TASK_TYPE_LABELS[task.type];
      await logEvents(tx, [
        {
          type: "TASK_REASSIGNED",
          actorId: user.id,
          productId: task.productId,
          taskId,
          data: { from: task.assignee?.name ?? null, to: target.name },
        },
      ]);
      await notify(tx, user.id, [
        {
          userId: assigneeId,
          type: "TASK_REASSIGNED",
          productId: task.productId,
          taskId,
          message: `${user.name} assigned ${label} for ${task.product.name} to you`,
        },
        {
          userId: task.assigneeId,
          type: "TASK_REASSIGNED",
          productId: task.productId,
          taskId,
          message: `${label} for ${task.product.name} was handed to ${target.name}`,
        },
      ]);
      return `${label} → ${target.name}`;
    });
    revalidate();
    return { ok: true, message: msg };
  },
});

export const updateBriefAction = defineAction({
  capability: "brief.edit",
  schema: briefSchema,
  run: async ({ productId, brief }, { user }) => {
    const now = new Date();
    await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { tasks: { select: { id: true, type: true, status: true, assigneeId: true } } },
      });
      if (!product) throw new ActionError("This product no longer exists.");
      if (isTerminalStage(product.stage)) throw new ActionError("This product is closed.");
      const text = brief.trim();
      if ((product.creativeBrief ?? "") === text) return;
      await tx.product.update({
        where: { id: productId },
        data: { creativeBrief: text || null, creativeBriefUpdatedAt: now },
      });
      await logEvents(tx, [{ type: "BRIEF_UPDATED", actorId: user.id, productId }]);
      const designers = product.tasks.filter((t) => isReviewedType(t.type) && isOpenStatus(t.status));
      await notify(
        tx,
        user.id,
        designers.map((t) => ({
          userId: t.assigneeId,
          type: "BRIEF_UPDATED" as const,
          productId,
          message: `${user.name} updated the creative brief for ${product.name}`,
        })),
      );
    });
    revalidate();
    return { ok: true, message: "Brief saved · designers notified" };
  },
});

async function itemContext(tx: Tx, itemId: string) {
  const item = await tx.submissionItem.findUnique({
    where: { id: itemId },
    include: {
      submission: {
        include: {
          task: { select: { id: true, type: true, assigneeId: true, product: { select: { id: true, name: true, mediaBuyerId: true } } } },
          items: { select: { id: true, kind: true }, orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!item) throw new ActionError("That image no longer exists.");
  const position = item.submission.items.filter((i) => i.kind === item.kind).findIndex((i) => i.id === item.id) + 1;
  const what = `${item.kind === "IMAGE" ? "image" : "link"} ${position} of ${TASK_TYPE_SHORT[item.submission.task.type]}`;
  return { item, task: item.submission.task, what };
}

/** Media Buyer / Admin: like or dislike one image (or link) in a submission. */
export const reactToItemAction = defineAction({
  capability: "task.review",
  schema: reactSchema,
  run: async ({ itemId, reaction }, { user }) => {
    await db.$transaction(async (tx) => {
      const { task, what } = await itemContext(tx, itemId);
      await tx.submissionItem.update({
        where: { id: itemId },
        data: { reaction, reactedById: reaction ? user.id : null, reactedAt: reaction ? new Date() : null },
      });
      if (!reaction) return;
      await logEvents(tx, [{ type: "ASSET_REACTED", actorId: user.id, productId: task.product.id, taskId: task.id, data: { reaction, what } }]);
      await notify(tx, user.id, [
        {
          userId: task.assigneeId,
          type: "FEEDBACK",
          productId: task.product.id,
          taskId: task.id,
          message: `${user.name} ${reaction === "LIKED" ? "liked" : "didn't like"} ${what} on ${task.product.name}`,
        },
      ]);
    });
    revalidate();
    return { ok: true, message: reaction === "LIKED" ? "Liked" : reaction === "DISLIKED" ? "Marked as not liked" : "Reaction removed" };
  },
});

/** Anyone can comment on a single image or link; the other side is notified. */
export const commentOnItemAction = defineAction({
  schema: itemCommentSchema,
  run: async ({ itemId, body }, { user }) => {
    await db.$transaction(async (tx) => {
      const { task, what } = await itemContext(tx, itemId);
      await tx.assetComment.create({ data: { itemId, authorId: user.id, body } });
      await logEvents(tx, [{ type: "ASSET_COMMENTED", actorId: user.id, productId: task.product.id, taskId: task.id, data: { what, body } }]);
      const preview = body.length > 80 ? `${body.slice(0, 80)}…` : body;
      const recipients = can(user.role, "task.review") && user.id !== task.assigneeId ? [task.assigneeId] : await reviewers(tx, task.product.mediaBuyerId);
      await notify(
        tx,
        user.id,
        recipients.map((id) => ({
          userId: id,
          type: "FEEDBACK" as const,
          productId: task.product.id,
          taskId: task.id,
          message: `${user.name} commented on ${what} (${task.product.name}): “${preview}”`,
        })),
      );
    });
    revalidate();
    return { ok: true, message: "Comment added" };
  },
});

/** Set the lane's Google Drive folder for a whole batch (images or videos) — pasted once, not per task. */
export const setBatchFolderAction = defineAction({
  schema: folderSchema,
  run: async ({ batchId, lane, url }, { user }) => {
    await db.$transaction(async (tx) => {
      const batch = await tx.creativeBatch.findUnique({
        where: { id: batchId },
        include: { tasks: { select: { type: true, assigneeId: true } }, product: { select: { id: true, mediaBuyerId: true } } },
      });
      if (!batch) throw new ActionError("That batch no longer exists.");
      const laneTasks = batch.tasks.filter((t) => laneOf(t.type) === lane);
      const allowed = user.role === "ADMIN" || can(user.role, "task.review") || laneTasks.some((t) => t.assigneeId === user.id);
      if (!allowed) throw new ActionError("Only the person doing this work, the media buyer or an Admin can set the folder.");
      await tx.creativeBatch.update({ where: { id: batchId }, data: lane === "images" ? { imageFolderUrl: url } : { videoFolderUrl: url } });
      await logEvents(tx, [{ type: "FOLDER_UPDATED", actorId: user.id, productId: batch.product.id, data: { lane, url } }]);
    });
    revalidate();
    return { ok: true, message: url ? "Drive folder saved" : "Drive folder removed" };
  },
});

/**
 * Tick / untick "ready for review" on one format. Ticking submits it with the
 * lane's Drive folder (or the store URL) and any optional preview images;
 * unticking takes it back before anyone reviewed it.
 */
export const markReadyAction = defineAction({
  schema: markReadySchema,
  run: async ({ taskId, ready, storeUrl, images, note }, { user }) => {
    const now = new Date();
    const label = await db.$transaction(async (tx) => {
      const { product, snap } = await taskWithProduct(tx, taskId);
      const task = snap.tasks.find((t) => t.id === taskId)!;
      const label = TASK_TYPE_LABELS[task.type];
      if (!canWorkOnTask(user, task)) throw new ActionError("Only the person doing this work or an Admin can change this.");

      if (!ready) {
        const planned = planWithdraw(snap, taskId);
        if (!planned.ok) throw new ActionError(planned.error);
        const latest = await tx.taskSubmission.findFirst({ where: { taskId }, orderBy: { version: "desc" } });
        if (latest && !latest.decision) await tx.taskSubmission.delete({ where: { id: latest.id } });
        await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
        await logEvents(tx, [{ type: "TASK_WITHDRAWN", actorId: user.id, productId: product.id, taskId }]);
        return label;
      }

      const checklist = await tx.checklistItem.findMany({ where: { taskId } });
      if (!isChecklistComplete(checklist)) {
        const n = missingRequiredCount(checklist);
        throw new ActionError(`Tick the remaining ${n} required checklist item${n === 1 ? "" : "s"} for ${label} first.`);
      }
      const batch = task.batchId ? await tx.creativeBatch.findUnique({ where: { id: task.batchId } }) : null;
      const lane = laneOf(task.type);
      const link = task.type === "STORE_LISTING" ? storeUrl : lane === "images" ? batch?.imageFolderUrl : batch?.videoFolderUrl;
      const missing = submissionError(task.type, { images: images.length, links: link ? 1 : 0 });
      if (missing) throw new ActionError(missing);
      if (images.length) {
        const owned = await tx.asset.findMany({
          where: { id: { in: images }, ...(user.role === "ADMIN" ? {} : { uploadedById: user.id }) },
          select: { id: true },
        });
        if (owned.length !== new Set(images).size) throw new ActionError("One of the preview images is missing. Upload it again.");
      }
      const planned = planSubmitTask(snap, taskId);
      if (!planned.ok) throw new ActionError(planned.error);
      const last = await tx.taskSubmission.aggregate({ where: { taskId }, _max: { version: true } });
      await tx.taskSubmission.create({
        data: {
          taskId,
          version: (last._max.version ?? 0) + 1,
          note,
          submittedById: user.id,
          createdAt: now,
          items: {
            create: [
              { order: 0, kind: "LINK" as const, url: link!, label: task.type === "STORE_LISTING" ? "Store page" : "Drive folder" },
              ...[...new Set(images)].map((assetId, i) => ({ order: i + 1, kind: "IMAGE" as const, assetId })),
            ],
          },
        },
      });
      await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      await notify(
        tx,
        user.id,
        (await reviewers(tx, product.mediaBuyerId)).map((id) => ({
          userId: id,
          type: "REVIEW_REQUESTED" as const,
          productId: product.id,
          taskId,
          message: `${user.name}: ${label} is ready for review (${product.name})`,
        })),
      );
      return label;
    });
    revalidate();
    return { ok: true, message: ready ? `${label} sent for review` : `${label} taken back` };
  },
});
