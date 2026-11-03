"use server";

import { z } from "zod";
import { canSeeProduct } from "@/lib/domain/permissions";
import { productRef } from "@/lib/format";
import { defineAction } from "../action";
import { db } from "../db";
import { productScope } from "../services/brand-scope";

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
