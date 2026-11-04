"use server";

import { revalidatePath } from "next/cache";
import { isChecklistComplete, missingRequiredCount } from "@/lib/domain/checklist";
import { CAMPAIGN_STATUS_LABELS } from "@/lib/domain/labels";
import { planCampaignStatus, planComplete, planLaunch, planNewBatch } from "@/lib/domain/workflow";
import {
  campaignDetailsSchema,
  campaignStatusSchema,
  launchDetailsSchema,
  newCampaignSchema,
  launchSchema,
  newBatchSchema,
  productActionSchema,
} from "@/lib/validation/campaign";
import { nextCampaignNumber } from "@/lib/domain/campaigns";
import { ActionError, defineAction } from "../action";
import { db, type Tx } from "../db";
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

/** The draft of campaign #1 (before launch): the row the launch form saves into. */
async function draftCampaign(tx: Tx, productId: string) {
  return tx.adCampaign.findFirst({ where: { productId, launchedAt: null }, orderBy: { number: "asc" } });
}

export const saveLaunchDetailsAction = defineAction({
  capability: "campaign.manage",
  schema: launchDetailsSchema,
  run: async ({ productId, name, type, ...fields }, { user }) => {
    await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, include: { adCampaigns: { select: { number: true } } } });
      if (!product) throw new ActionError("This product no longer exists.");
      if (product.stage !== "READY_TO_LAUNCH") throw new ActionError("The launch details can be saved while the product is ready to launch.");
      const draft = await draftCampaign(tx, productId);
      if (draft) {
        await tx.adCampaign.update({ where: { id: draft.id }, data: { ...fields, name: name ?? draft.name, type } });
      } else {
        const number = nextCampaignNumber(product.adCampaigns.map((c) => c.number));
        await tx.adCampaign.create({ data: { productId, number, name: name ?? `Campaign ${number}`, type, ...fields, createdById: user.id } });
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
      // The draft (or a new campaign) is saved as not launched; the plan below switches it to running.
      const draft = await draftCampaign(tx, productId);
      const data = { ...fields, status: "NOT_LAUNCHED" as const, launchedAt: now, launchedById: user.id };
      if (draft) await tx.adCampaign.update({ where: { id: draft.id }, data });
      else {
        const numbers = (await tx.adCampaign.findMany({ where: { productId }, select: { number: true } })).map((c) => c.number);
        await tx.adCampaign.create({ data: { productId, number: nextCampaignNumber(numbers), ...data, createdById: user.id } });
      }
      await applyPlan(tx, { ...planned.plan, campaign: { from: "NOT_LAUNCHED", to: "RUNNING" } }, { actorId: user.id, product, now });
      await logEvents(tx, [
        {
          type: "CAMPAIGN_LAUNCHED",
          actorId: user.id,
          productId,
          taskId: launchTask.id,
          data: { name: fields.name, type: fields.type, dailyBudgetUsd: fields.dailyBudgetUsd, metaCampaignId: fields.metaCampaignId },
        },
      ]);
    });
    revalidate();
    return { ok: true, message: "Campaign launched · product is live" };
  },
});

/** Another named campaign while the product is live (it starts running straight away). */
export const createCampaignAction = defineAction({
  capability: "campaign.manage",
  schema: newCampaignSchema,
  run: async ({ productId, ...fields }, { user }) => {
    const now = new Date();
    const number = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, include: { adCampaigns: { select: { number: true } } } });
      if (!product) throw new ActionError("This product no longer exists.");
      if (product.stage !== "LIVE") throw new ActionError("New campaigns can be added while the product is live.");
      const number = nextCampaignNumber(product.adCampaigns.map((c) => c.number));
      await tx.adCampaign.create({
        data: { productId, number, ...fields, status: "RUNNING", launchedAt: now, launchedById: user.id, createdById: user.id },
      });
      await logEvents(tx, [{ type: "CAMPAIGN_LAUNCHED", actorId: user.id, productId, data: { number, name: fields.name, type: fields.type, dailyBudgetUsd: fields.dailyBudgetUsd } }]);
      return number;
    });
    revalidate();
    return { ok: true, message: `Campaign #${number} “${fields.name}” is running` };
  },
});

/** Edit one campaign's name, type, link, ID, budget or strategy. */
export const saveCampaignDetailsAction = defineAction({
  capability: "campaign.manage",
  schema: campaignDetailsSchema,
  run: async ({ productId, campaignId, ...fields }, { user }) => {
    await db.$transaction(async (tx) => {
      const c = await tx.adCampaign.findUnique({ where: { id: campaignId } });
      if (!c || c.productId !== productId) throw new ActionError("That campaign no longer exists.");
      await tx.adCampaign.update({ where: { id: campaignId }, data: fields });
      await logEvents(tx, [{ type: "PRODUCT_UPDATED", actorId: user.id, productId, data: { fields: [`campaign #${c.number} details`] } }]);
    });
    revalidate();
    return { ok: true, message: "Campaign saved" };
  },
});

export const setCampaignStatusAction = defineAction({
  capability: "campaign.manage",
  schema: campaignStatusSchema,
  run: async ({ productId, campaignId, status, note }, { user }) => {
    const name = await db.$transaction(async (tx) => {
      const { snap } = await loadSnapshot(tx, productId);
      const c = await tx.adCampaign.findUnique({ where: { id: campaignId } });
      if (!c || c.productId !== productId) throw new ActionError("That campaign no longer exists.");
      const planned = planCampaignStatus({ ...snap, campaignStatus: c.status }, status);
      if (!planned.ok) throw new ActionError(planned.error);
      const updated = await tx.adCampaign.updateMany({ where: { id: campaignId, status: c.status }, data: { status } });
      if (updated.count !== 1) throw new ActionError(CONFLICT_MESSAGE);
      await logEvents(tx, [{ type: "CAMPAIGN_STATUS_CHANGED", actorId: user.id, productId, data: { from: c.status, to: status, note, campaign: c.name } }]);
      return c.name;
    });
    revalidate();
    return { ok: true, message: `${name}: ${CAMPAIGN_STATUS_LABELS[status].toLowerCase()}` };
  },
});

export const requestBatchAction = defineAction({
  capability: "batch.request",
  schema: newBatchSchema,
  run: async ({ productId, name, types, dueDate, reason, brief }, { user }) => {
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
      const planned = planNewBatch(snap, { types, dueAt, reason, name });
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
          data: { number: planned.plan.newBatch!.number, name, types, reason, dueAt: dueAt.toISOString() },
        },
      ]);
      return { number: planned.plan.newBatch!.number, count: applied.createdTasks.length, name };
    });
    revalidate();
    return { ok: true, message: `Batch #${result.number} “${result.name}” requested · ${result.count} task${result.count === 1 ? "" : "s"} assigned` };
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
