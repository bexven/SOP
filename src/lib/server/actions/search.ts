"use server";

import { z } from "zod";
import { productRef } from "@/lib/format";
import { defineAction } from "../action";
import { db } from "../db";

/** Product list for the command palette (fetched when it opens). */
export const paletteProductsAction = defineAction({
  schema: z.object({}).optional(),
  run: async () => {
    const products = await db.product.findMany({
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: { id: true, number: true, name: true, stage: true, imageUrl: true },
    });
    return { ok: true, data: products.map((p) => ({ ...p, ref: productRef(p.number) })) };
  },
});
