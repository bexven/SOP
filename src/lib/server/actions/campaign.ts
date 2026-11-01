"use server";

import { revalidatePath } from "next/cache";
import { isChecklistComplete, missingRequiredCount } from "@/lib/domain/checklist";
import { CAMPAIGN_STATUS_LABELS } from "@/lib/domain/labels";
import { planCampaignStatus, planComplete, planLaunch, planNewBatch } from "@/lib/domain/workflow";
import {
  campaignStatusSchema,
  launchDetailsSchema,
  launchSchema,
  newBatchSchema,
  productActionSchema,
} from "@/lib/validation/campaign";
import { ActionError, defineAction } from "../action";
import { db } from "../db";
import { applyPlan, CONFLICT_MESSAGE } from "../services/apply-plan";
import { logEvents, notify } from "../services/events";
import { loadSnapshot } from "../services/snapshot";

function revalidate() {
  revalidatePath("/", "layout");
}

/** End of the chosen calendar day in Dhaka (23:59), as a UTC instant. */
function endOfDhakaDay(day: string): Date {
  return new Date(`${day}T23:59:00+06:00`);
}

export const saveLaunchDetailsAction = defineAction({
  capability: "campaign.manage",
  schema: launchDetailsSchema,
  run: async ({ productId, ...fields }, { user }) => {
    await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, include: { campaign: true } });
      if (!product) throw new ActionError("This product no longer exists.");
      if (!(product.stage === "READY_TO_LAUNCH" || product.stage === "LIVE")) {
        throw new ActionError("Campaign details can be edited once the product is ready to launch.");
      }
      await tx.campaign.upsert({
        where: { productId },
        create: { productId, ...fields },
        update: fields,
      });
      if (product.stage === "LIVE") {
        await logEvents(tx, [{ type: "PRODUCT_UPDATED", actorId: user.id, productId, data: { fields: ["campaign details"] } }]);
      }
    });
    revalidate();
    return { ok: true, message: "Campaign details saved" };
  },
});

export const launchCampaignAction = defineAction({
  capability: "campaign.manage",
  schema: launchSchema,
  run: async ({ productId, ...fields }, { user }) => {
    const now = new Date();
    await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      const planned = planLaunch(snap);
      if (!planned.ok) throw new ActionError(planned.error);
      const launchTask = snap.tasks.find((t) => t.type === "CAMPAIGN_LAUNCH" && (t.status === "TODO" || t.status === "REVISION"))!;
      const checklist = await tx.checklistItem.findMany({ where: { taskId: launchTask.id } });
      if (!isChecklistComplete(checklist)) {
        const n = missingRequiredCount(checklist);
        throw new ActionError(`Tick the remaining ${n} launch checklist item${n === 1 ? "" : "s"} first.`);
      }
      await tx.campaign.upsert({
        where: { productId },
        create: { productId, ...fields, launchedAt: now, launchedById: user.id },
        update: { ...fields, launchedAt: now, launchedById: user.id },
      });
      await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      await logEvents(tx, [
        {
          type: "CAMPAIGN_LAUNCHED",
          actorId: user.id,
          productId,
          taskId: launchTask.id,
          data: { dailyBudgetUsd: fields.dailyBudgetUsd, metaCampaignId: fields.metaCampaignId },
        },
      ]);
    });
    revalidate();
    return { ok: true, message: "Campaign launched · product is live" };
  },
});

export const setCampaignStatusAction = defineAction({
  capability: "campaign.manage",
  schema: campaignStatusSchema,
  run: async ({ productId, status, note }, { user }) => {
    await db.$transaction(async (tx) => {
      const { snap } = await loadSnapshot(tx, productId);
      const planned = planCampaignStatus(snap, status);
      if (!planned.ok) throw new ActionError(planned.error);
      const from = planned.plan.campaign!.from;
      const updated = await tx.campaign.updateMany({ where: { productId, status: from ?? undefined }, data: { status } });
      if (updated.count !== 1) throw new ActionError(CONFLICT_MESSAGE);
      await logEvents(tx, [{ type: "CAMPAIGN_STATUS_CHANGED", actorId: user.id, productId, data: { from, to: status, note } }]);
    });
    revalidate();
    return { ok: true, message: `Campaign ${CAMPAIGN_STATUS_LABELS[status].toLowerCase()}` };
  },
});

export const requestBatchAction = defineAction({
  capability: "batch.request",
  schema: newBatchSchema,
  run: async ({ productId, types, dueDate, reason, brief }, { user }) => {
    const now = new Date();
    const dueAt = endOfDhakaDay(dueDate);
    if (dueAt.getTime() <= now.getTime()) {
      return { ok: false, error: "Pick a due date in the future.", fieldErrors: { dueDate: ["Pick a future date"] } };
    }
    const result = await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      let briefNow = product.creativeBrief;
      if (brief !== undefined && brief.trim() !== (product.creativeBrief ?? "")) {
        briefNow = brief.trim() || null;
        await tx.product.update({ where: { id: productId }, data: { creativeBrief: briefNow, creativeBriefUpdatedAt: now } });
        await logEvents(tx, [{ type: "BRIEF_UPDATED", actorId: user.id, productId }]);
      }
      const planned = planNewBatch(snap, { types, dueAt, reason });
      if (!planned.ok) throw new ActionError(planned.error);
      const applied = await applyPlan(tx, planned.plan, {
        actorId: user.id,
        product: { ...product, creativeBrief: briefNow },
        now,
      });
      await logEvents(tx, [
        {
          type: "BATCH_REQUESTED",
          actorId: user.id,
          productId,
          data: { number: planned.plan.newBatch!.number, types, reason, dueAt: dueAt.toISOString() },
        },
      ]);
      return { number: planned.plan.newBatch!.number, count: applied.createdTasks.length };
    });
    revalidate();
    return { ok: true, message: `Creative batch #${result.number} requested · ${result.count} task${result.count === 1 ? "" : "s"} assigned` };
  },
});

export const completeProductAction = defineAction({
  capability: "campaign.manage",
  schema: productActionSchema,
  run: async ({ productId }, { user }) => {
    const now = new Date();
    const cancelled = await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      const planned = planComplete(snap);
      if (!planned.ok) throw new ActionError(planned.error);
      await tx.product.update({ where: { id: productId }, data: { completedAt: now } });
      await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      await logEvents(tx, [{ type: "PRODUCT_COMPLETED", actorId: user.id, productId }]);
      const cancelledTasks = planned.plan.changes.filter((c) => c.kind === "cancel");
      await notify(
        tx,
        user.id,
        snap.tasks
          .filter((t) => cancelledTasks.some((c) => c.taskId === t.id))
          .map((t) => ({
            userId: t.assigneeId,
            type: "SENT_BACK" as const,
            productId,
            taskId: t.id,
            message: `${product.name} was completed — your open task was cancelled`,
          })),
      );
      return cancelledTasks.length;
    });
    revalidate();
    return { ok: true, message: `Product completed${cancelled ? ` · ${cancelled} open task${cancelled === 1 ? "" : "s"} cancelled` : ""}` };
  },
});
