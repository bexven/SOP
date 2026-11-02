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
import { approveTaskSchema, markReadySchema, briefSchema, reassignSchema, revisionSchema, websiteLinkSchema } from "@/lib/validation/task";
import { ActionError, defineAction } from "../action";
import { db, type Tx } from "../db";
import { applyPlan } from "../services/apply-plan";
import { logEvents, notify } from "../services/events";
import { loadSnapshot } from "../services/snapshot";
import { reviewers } from "../services/reviewers";

function revalidate() {
  revalidatePath("/", "layout");
}

async function taskWithProduct(tx: Tx, taskId: string) {
  const task = await tx.task.findUnique({ where: { id: taskId }, select: { id: true, productId: true } });
  if (!task) throw new ActionError("This task no longer exists.");
  return loadSnapshot(tx, task.productId);
}

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
      parts.push(`Next step unlocked${who.length ? ` for ${who.join(" & ")}` : ""}`);
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

/**
 * Tick / untick "ready". Ticking sends the task to the Senior with the links
 * the maker added (website product URL, ad image links or video links);
 * unticking takes it back before anyone reviewed it.
 */
export const markReadyAction = defineAction({
  schema: markReadySchema,
  run: async ({ taskId, ready, links, note }, { user }) => {
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
      const unique = [...new Set(links)];
      const missing = submissionError(task.type, { links: unique.length });
      if (missing) throw new ActionError(missing);
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
          items: { create: unique.map((url, i) => ({ order: i, kind: "LINK" as const, url })) },
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
          message: `${user.name}: ${label} ready for review (${product.name})`,
        })),
      );
      return label;
    });
    revalidate();
    return { ok: true, message: ready ? `${label} sent for review` : `${label} taken back` };
  },
});

/**
 * "Is the product added on the website?" — yes + link, or no (clears it).
 * The image designer on this product, a Senior or an Admin can set it.
 */
export const setWebsiteLinkAction = defineAction({
  schema: websiteLinkSchema,
  run: async ({ productId, added, url }, { user }) => {
    await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { tasks: { where: { type: "WEBSITE_IMAGE" }, select: { assigneeId: true } } },
      });
      if (!product) throw new ActionError("This product no longer exists.");
      const designer = product.tasks.some((t) => t.assigneeId === user.id);
      if (!designer && !can(user, "task.review")) throw new ActionError("Only the image designer, a Senior or an Admin can change this.");
      if (added && !url) throw new ActionError("Paste the product's link on the website.");
      const next = added ? url : null;
      if ((product.websiteUrl ?? null) === next) return;
      await tx.product.update({ where: { id: productId }, data: { websiteUrl: next } });
      await logEvents(tx, [
        { type: "PRODUCT_UPDATED", actorId: user.id, productId, data: { changes: { websiteUrl: { old: product.websiteUrl, new: next } } } },
      ]);
    });
    revalidate();
    return { ok: true, message: added ? "Website link saved" : "Marked as not on the website yet" };
  },
});
