"use server";

import { z } from "zod";
import { describeEvent } from "@/lib/domain/history";
import { TASK_TYPE_SHORT } from "@/lib/domain/labels";
import { canSeeProduct } from "@/lib/domain/permissions";
import { idSchema } from "@/lib/validation/common";
import { ActionError, defineAction } from "../action";
import { db } from "../db";

/** The product's history (who did what, when), newest first. Read-only; restricted brands are checked by defineAction. */
export const productHistoryAction = defineAction({
  schema: z.object({ productId: idSchema }),
  run: async ({ productId }, { user }) => {
    const product = await db.product.findUnique({ where: { id: productId }, select: { stage: true, stageBeforeKill: true } });
    if (!product || !canSeeProduct(user, product.stage, product.stageBeforeKill)) throw new ActionError("This product isn't available.");
    const events = await db.activityEvent.findMany({
      where: { productId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 300,
      select: {
        id: true,
        type: true,
        data: true,
        createdAt: true,
        actor: { select: { name: true, avatarColor: true, avatarAssetId: true } },
        task: { select: { type: true } },
      },
    });
    return {
      ok: true,
      data: events.map((e) => ({
        id: e.id,
        at: e.createdAt.toISOString(),
        actor: e.actor,
        text: describeEvent(e.type, (e.data ?? null) as Record<string, unknown> | null, e.task ? TASK_TYPE_SHORT[e.task.type] : null),
      })),
    };
  },
});
