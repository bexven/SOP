"use server";

import { z } from "zod";
import { can, canSeeProduct } from "@/lib/domain/permissions";
import { TASK_TYPE_LABELS } from "@/lib/domain/labels";
import { manualTaskRef } from "@/lib/domain/manual-tasks";
import { orderTitle } from "@/lib/domain/orders";
import { shipmentRef } from "@/lib/domain/shipments";
import { productRef } from "@/lib/format";
import { defineAction } from "../action";
import { db } from "../db";
import { productScope, taskScope } from "../services/brand-scope";

/** Product list for the command palette (fetched when it opens). */
export const paletteProductsAction = defineAction({
  schema: z.object({}).optional(),
  run: async (_input, { user }) => {
    const products = await db.product.findMany({
      where: productScope(user),
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: { id: true, number: true, name: true, stage: true, stageBeforeKill: true, imageUrl: true },
    });
    return {
      ok: true,
      data: products
        .filter((p) => canSeeProduct(user, p.stage, p.stageBeforeKill))
        .map((p) => ({ id: p.id, number: p.number, name: p.name, stage: p.stage, imageUrl: p.imageUrl, ref: productRef(p.number) })),
    };
  },
});

/** Everything else the palette can find: open workflow tasks, Tasks-board tasks, orders and shipments (brand-scoped). */
export const paletteMoreAction = defineAction({
  schema: z.object({}).optional(),
  run: async (_input, { user }) => {
    const scope = productScope(user);
    const [tasks, board, orders, shipments] = await Promise.all([
      db.task.findMany({
        where: { AND: [taskScope(user)], status: { in: ["TODO", "REVISION", "SUBMITTED"] }, product: { stage: { notIn: ["COMPLETED", "KILLED"] } } },
        orderBy: { dueAt: "asc" },
        take: 300,
        select: { id: true, type: true, product: { select: { id: true, name: true, stage: true, stageBeforeKill: true } }, assignee: { select: { name: true } } },
      }),
      db.manualTask.findMany({
        where: { OR: [{ productId: null }, { product: scope }] },
        orderBy: { updatedAt: "desc" },
        take: 300,
        select: { id: true, number: true, title: true, status: true },
      }),
      db.productOrder.findMany({
        where: { product: scope },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, number: true, name: true, product: { select: { id: true, name: true } } },
      }),
      can(user, "shipments.view")
        ? db.shipment.findMany({ where: { product: scope }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, number: true, product: { select: { name: true } } } })
        : Promise.resolve([]),
    ]);
    return {
      ok: true,
      data: {
        tasks: tasks
          .filter((t) => canSeeProduct(user, t.product.stage, t.product.stageBeforeKill))
          .map((t) => ({ id: t.id, productId: t.product.id, label: TASK_TYPE_LABELS[t.type], product: t.product.name, who: t.assignee?.name ?? null })),
        board: board.map((t) => ({ id: t.id, ref: manualTaskRef(t.number), title: t.title, done: t.status === "DONE" })),
        orders: orders.map((o) => ({ id: o.id, productId: o.product.id, title: orderTitle(o), product: o.product.name })),
        shipments: shipments.map((s) => ({ id: s.id, ref: shipmentRef(s.number), product: s.product.name })),
      },
    };
  },
});
