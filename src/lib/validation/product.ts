import { z } from "zod";
import { Priority } from "@/generated/prisma/enums";
import { idSchema } from "./common";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const urlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a full link starting with https://");

const optionalUrl = z
  .union([urlSchema, z.literal("")])
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

/** Optional money: "" → null; otherwise a non-negative decimal with ≤ 2 places. */
const optionalMoney = (label: string, max: number) =>
  z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d+(\.\d{1,2})?$/.test(v), `${label} must be a number with up to 2 decimals`)
    .refine((v) => v === null || Number(v) <= max, `${label} is too large`);

export const researchFieldsSchema = z.object({
  brandId: z.string().trim().max(64).optional().nullable().transform((v) => v || null),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
  supplierUrl: optionalUrl,
  imageUrl: optionalUrl,
  chinaPriceBdt: optionalMoney("China price", 1_000_000),
  shippingPerUnitBdt: optionalMoney("Shipping", 1_000_000),
  sellingPriceBdt: optionalMoney("Selling price", 100_000_000),
  targetCustomer: optionalText(2000),
  problemSolved: optionalText(2000),
  sellingAngle: optionalText(2000),
  referenceLinks: z.array(urlSchema).max(20, "Up to 20 links").default([]),
  priority: z.enum(Priority).default("MEDIUM"),
  targetLaunchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export type ResearchFieldsInput = z.input<typeof researchFieldsSchema>;

export const createProductSchema = researchFieldsSchema.refine((v) => Boolean(v.brandId), {
  message: "Choose the brand",
  path: ["brandId"],
});
export const updateResearchSchema = researchFieldsSchema.extend({ productId: idSchema });
export const productIdSchema = z.object({ productId: idSchema });
export const toggleChecklistSchema = z.object({ itemId: idSchema, checked: z.boolean() });
export const reviewDecisionSchema = z.object({
  productId: idSchema,
  note: z.string().trim().max(2000).optional().transform((v) => v || null),
});
export const rejectSchema = z.object({
  productId: idSchema,
  note: z.string().trim().min(3, "Say why it isn't approved").max(2000),
});
