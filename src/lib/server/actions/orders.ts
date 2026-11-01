"use server";

import { revalidatePath } from "next/cache";
import { addOrderError, moveToOrderingError, SCALE_VERDICT_LABELS } from "@/lib/domain/orders";
import { orderSchema, productIdSchema, scalingSchema } from "@/lib/validation/orders";
import { ActionError, defineAction } from "../action";
import { db } from "../db";
import { logEvents } from "../services/events";

function revalidate() {
  revalidatePath("/", "layout");
}

/** A live product performing well in its campaign moves to ordering. */
export const moveToOrderingAction = defineAction({
  capability: "orders.manage",
  schema: productIdSchema,
  run: async ({ productId }, { user }) => {
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId } });
      if (!p) throw new ActionError("This product no longer exists.");
      const err = moveToOrderingError(p);
      if (err) throw new ActionError(err);
      const updated = await tx.product.updateMany({ where: { id: productId, orderingSince: null, stage: "LIVE" }, data: { orderingSince: new Date() } });
      if (updated.count !== 1) throw new ActionError("This product changed just now. Refresh and try again.");
      await logEvents(tx, [{ type: "MOVED_TO_ORDERING", actorId: user.id, productId }]);
    });
    revalidate();
    return { ok: true, message: "Moved to ordering · add the first order" };
  },
});

/** Add an order, or correct one. Each order keeps its own prices. */
export const saveOrderAction = defineAction({
  capability: "orders.manage",
  schema: orderSchema,
  run: async ({ productId, orderId, ...fields }, { user }) => {
    const number = await db.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId } });
      if (!p) throw new ActionError("This product no longer exists.");
      const err = addOrderError(p);
      if (err) throw new ActionError(err);
      const data = {
        quantity: fields.quantity,
        buyingPriceBdt: fields.buyingPriceBdt,
        shippingCostBdt: fields.shippingCostBdt,
        sellingPriceBdt: fields.sellingPriceBdt,
        orderedOn: new Date(`${fields.orderedOn}T00:00:00Z`),
        note: fields.note,
      };
      if (orderId) {
        const existing = await tx.productOrder.findUnique({ where: { id: orderId } });
        if (!existing || existing.productId !== productId) throw new ActionError("That order no longer exists.");
        await tx.productOrder.update({ where: { id: orderId }, data });
        await logEvents(tx, [{ type: "ORDER_UPDATED", actorId: user.id, productId, data: { number: existing.number } }]);
        return existing.number;
      }
      const settings = await tx.settings.findFirst();
      const last = await tx.productOrder.aggregate({ where: { productId }, _max: { number: true } });
      const next = (last._max.number ?? 0) + 1;
      await tx.productOrder.create({
        data: { ...data, productId, number: next, createdById: user.id, courierChargePct: settings?.courierChargePct ?? p.courierChargePct },
      });
      await logEvents(tx, [{ type: "ORDER_CREATED", actorId: user.id, productId, data: { number: next, quantity: fields.quantity } }]);
      return next;
    });
    revalidate();
    return { ok: true, message: orderId ? `Order #${number} updated` : `Order #${number} added` };
  },
});

export const saveScalingAction = defineAction({
  capability: "orders.manage",
  schema: scalingSchema,
  run: async ({ productId, scalable, scalePlans, scaleNote }, { user }) => {
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId } });
      if (!p) throw new ActionError("This product no longer exists.");
      if (!p.orderingSince) throw new ActionError("Move the product to ordering first.");
      await tx.product.update({ where: { id: productId }, data: { scalable, scalePlans: [...new Set(scalePlans)], scaleNote } });
      await logEvents(tx, [
        { type: "SCALING_UPDATED", actorId: user.id, productId, data: { scalable: scalable ? SCALE_VERDICT_LABELS[scalable] : null, plans: scalePlans } },
      ]);
    });
    revalidate();
    return { ok: true, message: "Scaling plan saved" };
  },
});
