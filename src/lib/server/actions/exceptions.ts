"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { KILL_REASON_LABELS, STAGE_LABELS } from "@/lib/domain/labels";
import { planKill, planSendBack } from "@/lib/domain/workflow";
import { killSchema, overrideSchema, sendBackSchema, taskDueSchema } from "@/lib/validation/campaign";
import { ActionError, defineAction } from "../action";
import { db } from "../db";
import { applyPlan } from "../services/apply-plan";
import { logEvents, notify } from "../services/events";
import { researchData } from "../services/product-helpers";
import { loadSnapshot } from "../services/snapshot";

function revalidate() {
  revalidatePath("/", "layout");
}

export const killProductAction = defineAction({
  capability: "product.kill",
  schema: killSchema,
  run: async ({ productId, reason, note }, { user }) => {
    const now = new Date();
    await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      const planned = planKill(snap);
      if (!planned.ok) throw new ActionError(planned.error);
      await tx.product.update({
        where: { id: productId },
        data: { killReason: reason, killNote: note, killedAt: now, stageBeforeKill: product.stage },
      });
      await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      await logEvents(tx, [{ type: "PRODUCT_KILLED", actorId: user.id, productId, data: { reason, note } }]);
      const involved = new Set<string | null>([product.mediaBuyerId, product.createdById]);
      for (const c of planned.plan.changes) involved.add(snap.tasks.find((t) => t.id === c.taskId)?.assigneeId ?? null);
      await notify(
        tx,
        user.id,
        [...involved].map((uid) => ({
          userId: uid,
          type: "PRODUCT_KILLED" as const,
          productId,
          message: `${product.name} was killed (${KILL_REASON_LABELS[reason]}): ${note}`,
        })),
      );
    });
    revalidate();
    return { ok: true, message: "Product killed · open tasks cancelled" };
  },
});

export const sendBackAction = defineAction({
  capability: "product.sendBack",
  schema: sendBackSchema,
  run: async ({ productId, target, note, reopenTaskIds }, { user }) => {
    const now = new Date();
    const count = await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      const planned = planSendBack(snap, { target, actorRole: user.role, note, reopenTaskIds });
      if (!planned.ok) throw new ActionError(planned.error);
      await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      await logEvents(tx, [
        { type: "PRODUCT_SENT_BACK", actorId: user.id, productId, data: { from: product.stage, to: target, note } },
      ]);
      // Assignees whose open work was cancelled by the send-back also hear about it.
      await notify(
        tx,
        user.id,
        planned.plan.changes
          .filter((c) => c.kind === "cancel")
          .map((c) => ({
            userId: snap.tasks.find((t) => t.id === c.taskId)?.assigneeId,
            type: "SENT_BACK" as const,
            productId,
            taskId: c.taskId,
            message: `${product.name} was sent back to ${STAGE_LABELS[target]}: ${note}`,
          })),
      );
      return planned.plan.changes.filter((c) => c.kind === "reopen" || c.kind === "relock").length;
    });
    revalidate();
    return { ok: true, message: `Sent back to ${STAGE_LABELS[target]}${count ? ` · ${count} task${count === 1 ? "" : "s"} reopened` : ""}` };
  },
});

function normalize(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.join(", ") || null;
  if (v instanceof Decimal || (typeof v === "object" && v && "toFixed" in v)) return new Decimal(String(v)).toString();
  if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v)) return new Decimal(v).toString();
  return String(v);
}

export const overrideProductAction = defineAction({
  capability: "product.override",
  schema: overrideSchema,
  run: async ({ productId, rmbToBdtRate, courierChargePct, mediaBuyerId, ...rest }, { user }) => {
    const changes = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new ActionError("This product no longer exists.");
      if (mediaBuyerId) {
        const mb = await tx.user.findUnique({ where: { id: mediaBuyerId } });
        if (!mb?.active || mb.role !== "MEDIA_BUYER") throw new ActionError("Pick an active media buyer.");
      }
      const next: Record<string, unknown> = { ...researchData(rest), rmbToBdtRate, courierChargePct, mediaBuyerId };
      const changes: Record<string, { old: string | null; new: string | null }> = {};
      for (const [key, value] of Object.entries(next)) {
        const before = normalize((product as Record<string, unknown>)[key]);
        const after = normalize(value);
        if (before !== after) changes[key] = { old: before, new: after };
      }
      if (Object.keys(changes).length === 0) return changes;
      await tx.product.update({ where: { id: productId }, data: next });
      await logEvents(tx, [{ type: "OVERRIDE", actorId: user.id, productId, data: { changes } }]);
      return changes;
    });
    revalidate();
    const n = Object.keys(changes).length;
    return n ? { ok: true, message: `Override saved · ${n} field${n === 1 ? "" : "s"} changed` } : { ok: true, message: "Nothing changed" };
  },
});

export const overrideTaskDueAction = defineAction({
  capability: "product.override",
  schema: taskDueSchema,
  run: async ({ taskId, dueAt }, { user }) => {
    await db.$transaction(async (tx) => {
      const task = await tx.task.findUnique({ where: { id: taskId } });
      if (!task) throw new ActionError("This task no longer exists.");
      const next = dueAt ? new Date(dueAt) : null;
      await tx.task.update({ where: { id: taskId }, data: { dueAt: next } });
      await logEvents(tx, [
        {
          type: "OVERRIDE",
          actorId: user.id,
          productId: task.productId,
          taskId,
          data: { changes: { dueAt: { old: task.dueAt?.toISOString() ?? null, new: next?.toISOString() ?? null } } },
        },
      ]);
      await notify(tx, user.id, [
        {
          userId: task.assigneeId,
          type: "TASK_REASSIGNED",
          productId: task.productId,
          taskId,
          message: next ? `Due date changed by ${user.name}` : `Due date removed by ${user.name}`,
        },
      ]);
    });
    revalidate();
    return { ok: true, message: "Due date updated" };
  },
});
