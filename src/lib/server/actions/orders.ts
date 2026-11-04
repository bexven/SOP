"use server";

import { revalidatePath } from "next/cache";
import { addOrderError, moveToOrderingError, SCALE_VERDICT_LABELS } from "@/lib/domain/orders";
import { shippingFromWeight, SHIPPING_METHOD_LABELS } from "@/lib/domain/margin";
import { orderSchema, productIdSchema, scalingSchema, testOrderIdSchema, testOrderSchema } from "@/lib/validation/orders";
import { ActionError, defineAction } from "../action";
import { db } from "../db";
import { logEvents } from "../services/events";
import { settingsRateFor } from "../services/product-helpers";

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
      const existing = orderId ? await tx.productOrder.findUnique({ where: { id: orderId } }) : null;
      if (orderId && (!existing || existing.productId !== productId)) throw new ActionError("That order no longer exists.");
      // Shipping = weight × the method's rate per kg. An order keeps its rate while the method stays the same.
      const settings = await tx.settings.findUnique({ where: { id: 1 } });
      const rate =
        existing?.shippingRatePerKgBdt && existing.shippingMethod === fields.shippingMethod
          ? existing.shippingRatePerKgBdt.toString()
          : settingsRateFor(fields.shippingMethod, settings);
      const shipping = shippingFromWeight(fields.weightKg, rate);
      if (!rate || !shipping) {
        throw new ActionError(`An Admin needs to set the ${SHIPPING_METHOD_LABELS[fields.shippingMethod].toLowerCase()} shipping rate per kg in Settings first.`);
      }
      const data = {
        quantity: fields.quantity,
        buyingPriceBdt: fields.buyingPriceBdt,
        weightKg: fields.weightKg,
        shippingMethod: fields.shippingMethod,
        shippingRatePerKgBdt: rate,
        shippingCostBdt: shipping,
        sellingPriceBdt: fields.sellingPriceBdt,
        orderedOn: new Date(`${fields.orderedOn}T00:00:00Z`),
        note: fields.note,
      };
      if (existing) {
        await tx.productOrder.update({ where: { id: existing.id }, data });
        await logEvents(tx, [{ type: "ORDER_UPDATED", actorId: user.id, productId, data: { number: existing.number } }]);
        return existing.number;
      }
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

/** Admins only: a small test order to check the product's quality, with a result and a note. */
export const saveTestOrderAction = defineAction({
  schema: testOrderSchema,
  run: async ({ productId, testOrderId, quality, note }, { user }) => {
    if (user.role !== "ADMIN") throw new ActionError("Only Admins can place test orders.");
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId } });
      if (!p) throw new ActionError("This product no longer exists.");
      if (!p.orderingSince) throw new ActionError("Move the product to ordering first.");
      if (testOrderId) {
        const t = await tx.testOrder.findUnique({ where: { id: testOrderId } });
        if (!t || t.productId !== productId) throw new ActionError("That test order no longer exists.");
        await tx.testOrder.update({ where: { id: testOrderId }, data: { quality, note } });
      } else {
        await tx.testOrder.create({ data: { productId, quality, note, createdById: user.id } });
      }
      await logEvents(tx, [{ type: "ORDER_UPDATED", actorId: user.id, productId, data: { test: true, quality } }]);
    });
    revalidate();
    return { ok: true, message: testOrderId ? "Test order updated" : "Test order added" };
  },
});

export const deleteTestOrderAction = defineAction({
  schema: testOrderIdSchema,
  run: async ({ testOrderId }, { user }) => {
    if (user.role !== "ADMIN") throw new ActionError("Only Admins can remove test orders.");
    const t = await db.testOrder.findUnique({ where: { id: testOrderId } });
    if (!t) throw new ActionError("That test order no longer exists.");
    await db.testOrder.delete({ where: { id: testOrderId } });
    revalidate();
    return { ok: true, message: "Test order removed" };
  },
});
