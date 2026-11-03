"use server";

import { revalidatePath } from "next/cache";
import { missingRequiredCount, snapshotChecklist } from "@/lib/domain/checklist";
import { dueAtFrom } from "@/lib/domain/due";
import { TASK_TYPE_LABELS } from "@/lib/domain/labels";
import { KILL_REASON_LABELS } from "@/lib/domain/labels";
import {
  canWorkOnTask,
  planApproveProduct,
  planRejectProduct,
  planResearchSubmit,
  researchBlockers,
  researchTask,
} from "@/lib/domain/workflow";
import {
  createProductSchema,
  productIdSchema,
  rejectSchema,
  reviewDecisionSchema,
  toggleChecklistSchema,
  updateResearchSchema,
} from "@/lib/validation/product";
import { ActionError, defineAction } from "../action";
import { db } from "../db";
import { applyPlan } from "../services/apply-plan";
import { autoAssign } from "../services/assign";
import { logEvents, notify } from "../services/events";
import { currentRates, researchData } from "../services/product-helpers";
import { loadSnapshot } from "../services/snapshot";

function revalidateProduct() {
  revalidatePath("/", "layout");
}

const FIELD_LABELS: Record<string, string> = {
  brandId: "brand",
  name: "name",
  supplierUrl: "supplier link",
  imageUrl: "image",
  chinaPriceBdt: "China price",
  shippingPerUnitBdt: "shipping",
  sellingPriceBdt: "selling price",
  targetCustomer: "target customer",
  problemSolved: "problem solved",
  sellingAngle: "selling angle",
  referenceLinks: "reference links",
  priority: "priority",
  targetLaunchDate: "target launch date",
};

export const createProductAction = defineAction({
  capability: "product.create",
  schema: createProductSchema,
  run: async (input, { user }) => {
    const now = new Date();
    const id = await db.$transaction(async (tx) => {
      const brand = await tx.brand.findUnique({ where: { id: input.brandId! } });
      if (!brand?.active) throw new ActionError("Choose one of the brands.");
      const rates = await currentRates(tx);
      const product = await tx.product.create({
        data: { ...researchData(input), ...rates, createdById: user.id, stageEnteredAt: now },
      });
      await tx.stageTransition.create({
        data: { productId: product.id, fromStage: null, toStage: "RESEARCH", actorId: user.id, at: now },
      });

      // The research task belongs to its creator when they are a researcher; otherwise
      // (e.g. an Admin) it goes to a researcher — or stays with the creator if there is none.
      const assigneeId =
        user.jobRole === "RESEARCHER" ? user.id : ((await autoAssign(tx, ["RESEARCHER"], now, { brandId: product.brandId }))[0] ?? user.id);
      if (assigneeId === user.id) await tx.user.update({ where: { id: user.id }, data: { lastAssignedAt: now } });
      const [templates, sla] = await Promise.all([
        tx.checklistTemplateItem.findMany({ where: { taskType: "RESEARCH", active: true } }),
        tx.taskTypeConfig.findUnique({ where: { taskType: "RESEARCH" } }),
      ]);
      const task = await tx.task.create({
        data: {
          productId: product.id,
          type: "RESEARCH",
          role: "RESEARCHER",
          phase: 1,
          status: "TODO",
          assigneeId,
          assignedAt: assigneeId ? now : null,
          unlockedAt: now,
          dueAt: dueAtFrom(now, sla?.slaHours),
          checklist: { create: snapshotChecklist(templates) },
        },
      });
      await logEvents(tx, [
        { type: "PRODUCT_CREATED", actorId: user.id, productId: product.id },
        { type: "TASK_CREATED", actorId: user.id, productId: product.id, taskId: task.id, data: { assignee: null } },
      ]);
      await notify(tx, user.id, [
        {
          userId: assigneeId,
          type: "TASK_ASSIGNED",
          productId: product.id,
          taskId: task.id,
          message: `New research: ${product.name}`,
        },
      ]);
      return product.id;
    });
    revalidateProduct();
    return { ok: true, message: `${input.name} created`, data: { id } };
  },
});

export const updateResearchAction = defineAction({
  schema: updateResearchSchema,
  run: async ({ productId, ...input }, { user }) => {
    await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      const inResearch = product.stage === "RESEARCH";
      if (!inResearch && user.role !== "ADMIN") {
        throw new ActionError("Research is locked after submission. Ask an Admin to change it.");
      }
      const task = researchTask(snap);
      if (inResearch && (!task || !canWorkOnTask(user, task))) throw new ActionError("Only the assigned researcher or an Admin can edit this.");
      if (input.brandId) {
        const brand = await tx.brand.findUnique({ where: { id: input.brandId } });
        if (!brand) throw new ActionError("Choose one of the brands.");
      }

      const data = researchData(input);
      const changed = Object.entries(data)
        .filter(([key, value]) => {
          const before = (product as Record<string, unknown>)[key];
          const norm = (v: unknown) =>
            v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
          return norm(before) !== norm(value);
        })
        .map(([key]) => key);

      if (!inResearch) {
        // Admin edit after research: the rate snapshot stays frozen; log old → new.
        const norm = (v: unknown) =>
          v === null || v === undefined || v === "" ? null : v instanceof Date ? v.toISOString().slice(0, 10) : Array.isArray(v) ? v.join(", ") || null : String(v);
        const changes = Object.fromEntries(
          changed.map((k) => [k, { old: norm((product as Record<string, unknown>)[k]), new: norm((data as Record<string, unknown>)[k]) }]),
        );
        await tx.product.update({ where: { id: productId }, data });
        if (changed.length) await logEvents(tx, [{ type: "OVERRIDE", actorId: user.id, productId, data: { changes } }]);
        return;
      }
      // Rate snapshot refreshes on every save while in RESEARCH.
      const rates = await currentRates(tx);
      await tx.product.update({ where: { id: productId }, data: { ...data, ...rates } });
      if (changed.length) {
        await logEvents(tx, [
          {
            type: "PRODUCT_UPDATED",
            actorId: user.id,
            productId,
            data: { fields: changed.map((k) => FIELD_LABELS[k] ?? k) },
          },
        ]);
      }
    });
    revalidateProduct();
    return { ok: true, message: "Research saved" };
  },
});

export const submitResearchAction = defineAction({
  schema: productIdSchema,
  run: async ({ productId }, { user }) => {
    const now = new Date();
    const result = await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      const task = researchTask(snap);
      if (!task || !canWorkOnTask(user, task)) throw new ActionError("Only the assigned researcher or an Admin can submit.");

      const checklist = await tx.checklistItem.findMany({ where: { taskId: task.id } });
      const blockers = researchBlockers(
        {
          brandId: product.brandId,
          name: product.name,
          supplierUrl: product.supplierUrl,
          chinaPriceBdt: product.chinaPriceBdt?.toString() ?? null,
          shippingPerUnitBdt: product.shippingPerUnitBdt?.toString() ?? null,
          sellingPriceBdt: product.sellingPriceBdt?.toString() ?? null,
        },
        missingRequiredCount(checklist),
      );
      if (blockers.length) throw new ActionError(`Still needed: ${blockers.join(", ")}.`);

      const planned = planResearchSubmit(snap);
      if (!planned.ok) throw new ActionError(planned.error);

      const applied = await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      await logEvents(tx, [{ type: "RESEARCH_SUBMITTED", actorId: user.id, productId, taskId: task.id }]);
      return applied;
    });
    revalidateProduct();
    const reviewer = result.createdTasks[0]?.assigneeName;
    return { ok: true, message: `Research submitted · waiting for product review${reviewer ? ` by ${reviewer}` : ""}` };
  },
});

export const toggleChecklistItemAction = defineAction({
  schema: toggleChecklistSchema,
  run: async ({ itemId, checked }, { user }) => {
    const item = await db.checklistItem.findUnique({
      where: { id: itemId },
      include: { task: { select: { id: true, type: true, status: true, assigneeId: true } } },
    });
    if (!item) throw new ActionError("That checklist item no longer exists.");
    if (!canWorkOnTask(user, item.task)) throw new ActionError("Only the assignee or an Admin can tick this.");
    if (!(item.task.status === "TODO" || item.task.status === "REVISION")) {
      throw new ActionError(
        item.task.status === "LOCKED"
          ? "This task is still locked."
          : `${TASK_TYPE_LABELS[item.task.type]} isn't open for changes right now.`,
      );
    }
    await db.checklistItem.update({
      where: { id: itemId },
      data: checked
        ? { checked: true, checkedById: user.id, checkedAt: new Date() }
        : { checked: false, checkedById: null, checkedAt: null },
    });
    revalidateProduct();
    return { ok: true };
  },
});


/** Reviewer / Admin: approve the product for testing → Creative starts (7 tasks, assigned). */
export const approveProductAction = defineAction({
  capability: "product.approve",
  schema: reviewDecisionSchema,
  run: async ({ productId, note }, { user }) => {
    const now = new Date();
    const result = await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      const planned = planApproveProduct(snap);
      if (!planned.ok) throw new ActionError(planned.error);
      // Q1: the product gets an owning media buyer when it enters Creative.
      let mediaBuyerId = product.mediaBuyerId;
      const owner = mediaBuyerId ? await tx.user.findUnique({ where: { id: mediaBuyerId } }) : null;
      if (!owner?.active) {
        mediaBuyerId = (await autoAssign(tx, ["MEDIA_BUYER"], now, { brandId: product.brandId }))[0] ?? null;
        await tx.product.update({ where: { id: productId }, data: { mediaBuyerId } });
      }
      const applied = await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      await logEvents(tx, [{ type: "PRODUCT_APPROVED", actorId: user.id, productId, data: { note } }]);
      await notify(tx, user.id, [
        { userId: product.createdById, type: "TASK_APPROVED", productId, message: `${user.name} approved ${product.name} for testing${note ? `: ${note}` : ""}` },
        { userId: mediaBuyerId, type: "TASK_ASSIGNED", productId, message: `${product.name} was approved for testing — you're the media buyer. Write the creative brief.` },
      ]);
      return applied;
    });
    revalidateProduct();
    const unassigned = result.createdTasks.filter((t) => !t.assigneeId).length;
    return {
      ok: true,
      message: `Approved for testing · ${result.createdTasks.length} creative tasks created${unassigned ? ` (${unassigned} need an assignee)` : ""}`,
    };
  },
});

/** Reviewer / Admin: not approved → the product is closed with the reason recorded. */
export const rejectProductAction = defineAction({
  capability: "product.approve",
  schema: rejectSchema,
  run: async ({ productId, note }, { user }) => {
    const now = new Date();
    await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      const planned = planRejectProduct(snap);
      if (!planned.ok) throw new ActionError(planned.error);
      await tx.product.update({
        where: { id: productId },
        data: { killReason: "NOT_APPROVED", killNote: note, killedAt: now, stageBeforeKill: "REVIEW" },
      });
      await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      await logEvents(tx, [{ type: "PRODUCT_REJECTED", actorId: user.id, productId, data: { note } }]);
      await notify(tx, user.id, [
        { userId: product.createdById, type: "PRODUCT_KILLED", productId, message: `${product.name}: ${KILL_REASON_LABELS.NOT_APPROVED} — ${note}` },
      ]);
    });
    revalidateProduct();
    return { ok: true, message: "Marked as not approved" };
  },
});
