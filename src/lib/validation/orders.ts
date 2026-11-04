import { z } from "zod";
import { ScalePlan, ScaleVerdict, ShippingMethod, TestQuality } from "@/generated/prisma/enums";
import { decimalString, idSchema } from "./common";

const money = (label: string) => decimalString({ label, max: 10_000_000, allowZero: true, maxDecimals: 2 });

export const productIdSchema = z.object({ productId: idSchema });

export const orderSchema = z.object({
  productId: idSchema,
  /** Present when correcting an existing order. */
  orderId: idSchema.optional().nullable().transform((v) => v || null),
  quantity: z.coerce.number({ error: "Enter how many units" }).int("Units must be a whole number").min(1, "At least 1 unit").max(1_000_000, "That's too many units"),
  buyingPriceBdt: money("Buying price"),
  weightKg: z
    .string()
    .trim()
    .transform((v) => v.replace(/^\./, "0."))
    .refine((v) => /^\d+(\.\d{1,3})?$/.test(v), "Enter the weight in kg, e.g. 0.150")
    .refine((v) => Number(v) > 0, "Weight must be more than 0")
    .refine((v) => Number(v) <= 10_000, "Weight is too large"),
  shippingMethod: z.enum(ShippingMethod, { error: "Choose Air or Sea" }),
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

/** Admin test order to check quality. */
export const testOrderSchema = z.object({
  productId: idSchema,
  testOrderId: idSchema.optional().nullable().transform((v) => v || null),
  quality: z.enum(TestQuality).default("WAITING"),
  note: z.string().trim().max(1000, "Keep the note under 1000 characters").optional().transform((v) => v || null),
});
export const testOrderIdSchema = z.object({ testOrderId: idSchema });
