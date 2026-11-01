"use server";

import { revalidatePath } from "next/cache";
import { missingRequiredCount, snapshotChecklist } from "@/lib/domain/checklist";
import { dueAtFrom } from "@/lib/domain/due";
import { TASK_TYPE_LABELS } from "@/lib/domain/labels";
import { canWorkOnTask, planResearchSubmit, researchBlockers, researchTask } from "@/lib/domain/workflow";
import {
  createProductSchema,
  productIdSchema,
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
  name: "name",
  supplierUrl: "supplier link",
  imageUrl: "image",
  chinaPriceRmb: "China price",
  shippingPerUnitRmb: "shipping",
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
      const rates = await currentRates(tx);
      const product = await tx.product.create({
        data: { ...researchData(input), ...rates, createdById: user.id, stageEnteredAt: now },
      });
      await tx.stageTransition.create({
        data: { productId: product.id, fromStage: null, toStage: "RESEARCH", actorId: user.id, at: now },
      });

      // The research task belongs to its creator when they are a researcher;
      // otherwise (Admin) it is auto-assigned to a researcher.
      const assigneeId = user.role === "RESEARCHER" ? user.id : ((await autoAssign(tx, ["RESEARCHER"], now))[0] ?? null);
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
      if (product.stage !== "RESEARCH") {
        throw new ActionError("Research is locked after submission. An Admin can still override fields.");
      }
      const task = researchTask(snap);
      if (!task || !canWorkOnTask(user, task)) throw new ActionError("Only the assigned researcher or an Admin can edit this.");

      const data = researchData(input);
      const changed = Object.entries(data)
        .filter(([key, value]) => {
          const before = (product as Record<string, unknown>)[key];
          const norm = (v: unknown) =>
            v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
          return norm(before) !== norm(value);
        })
        .map(([key]) => key);

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
          name: product.name,
          supplierUrl: product.supplierUrl,
          chinaPriceRmb: product.chinaPriceRmb?.toString() ?? null,
          shippingPerUnitRmb: product.shippingPerUnitRmb?.toString() ?? null,
          sellingPriceBdt: product.sellingPriceBdt?.toString() ?? null,
        },
        missingRequiredCount(checklist),
      );
      if (blockers.length) throw new ActionError(`Still needed: ${blockers.join(", ")}.`);

      const planned = planResearchSubmit(snap);
      if (!planned.ok) throw new ActionError(planned.error);

      // Q1: the product gets an owning media buyer at research submit.
      let mediaBuyerId = product.mediaBuyerId;
      const owner = mediaBuyerId ? await tx.user.findUnique({ where: { id: mediaBuyerId } }) : null;
      if (!owner?.active) {
        mediaBuyerId = (await autoAssign(tx, ["MEDIA_BUYER"], now))[0] ?? null;
        await tx.product.update({ where: { id: productId }, data: { mediaBuyerId } });
      }

      const applied = await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      await logEvents(tx, [{ type: "RESEARCH_SUBMITTED", actorId: user.id, productId, taskId: task.id }]);
      await notify(tx, user.id, [
        {
          userId: mediaBuyerId,
          type: "TASK_ASSIGNED",
          productId,
          message: `${product.name} entered Creative — you're the media buyer. Write the creative brief.`,
        },
      ]);
      return applied;
    });
    revalidateProduct();
    const unassigned = result.createdTasks.filter((t) => !t.assigneeId).length;
    return {
      ok: true,
      message: `Research submitted · ${result.createdTasks.length} creative tasks created${
        unassigned ? ` (${unassigned} need an assignee)` : ""
      }`,
    };
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

