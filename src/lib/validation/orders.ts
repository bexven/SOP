import { z } from "zod";
import { ScalePlan, ScaleVerdict } from "@/generated/prisma/enums";
import { decimalString, idSchema } from "./common";

const money = (label: string) => decimalString({ label, max: 10_000_000, allowZero: true, maxDecimals: 2 });

export const productIdSchema = z.object({ productId: idSchema });

export const orderSchema = z.object({
  productId: idSchema,
  /** Present when correcting an existing order. */
  orderId: idSchema.optional().nullable().transform((v) => v || null),
  quantity: z.coerce.number({ error: "Enter how many units" }).int("Units must be a whole number").min(1, "At least 1 unit").max(1_000_000, "That's too many units"),
  buyingPriceBdt: money("Buying price"),
  shippingCostBdt: money("Shipping cost"),
  sellingPriceBdt: decimalString({ label: "Selling price", max: 10_000_000, maxDecimals: 2 }),
  orderedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the order date"),
  note: z.string().trim().max(2000).optional().transform((v) => v || null),
});

export const scalingSchema = z.object({
  productId: idSchema,
  scalable: z.enum(ScaleVerdict).nullable(),
  scalePlans: z.array(z.enum(ScalePlan)).max(3).default([]),
  scaleNote: z.string().trim().max(2000).optional().transform((v) => v || null),
});
