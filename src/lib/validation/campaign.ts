import { z } from "zod";
import { CampaignStatus, KillReason, ProductStage, TaskType } from "@/generated/prisma/enums";
import { idSchema } from "./common";
import { researchFieldsSchema, urlSchema } from "./product";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

const usd = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter the budget in dollars, e.g. 25 or 12.50")
  .refine((v) => Number(v) > 0, "Budget must be more than $0")
  .refine((v) => Number(v) <= 100000, "That budget looks too large");

export const launchDetailsSchema = z.object({
  productId: idSchema,
  adsManagerUrl: z.union([urlSchema, z.literal("")]).optional().nullable().transform((v) => v || null),
  metaCampaignId: optionalText(100),
  dailyBudgetUsd: z.union([usd, z.literal("")]).optional().nullable().transform((v) => v || null),
  strategyNotes: optionalText(5000),
});

export const launchSchema = z.object({
  productId: idSchema,
  adsManagerUrl: urlSchema,
  metaCampaignId: optionalText(100),
  dailyBudgetUsd: usd,
  strategyNotes: optionalText(5000),
});

export const campaignStatusSchema = z.object({
  productId: idSchema,
  status: z.enum(CampaignStatus),
  note: optionalText(1000),
});

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const newBatchSchema = z.object({
  productId: idSchema,
  name: z.string().trim().min(2, "Give the batch a name").max(60, "Keep the name under 60 characters"),
  types: z.array(z.enum(TaskType)).min(1, "Pick at least one format"),
  dueDate: dayString,
  reason: optionalText(500),
  brief: z.string().max(20_000).optional(),
});

export const productActionSchema = z.object({ productId: idSchema });

export const killSchema = z.object({
  productId: idSchema,
  reason: z.enum(KillReason),
  note: z.string().trim().min(3, "Explain why the product is being killed").max(2000),
});

export const sendBackSchema = z.object({
  productId: idSchema,
  target: z.enum(ProductStage),
  note: z.string().trim().min(3, "Explain what needs to change").max(2000),
  reopenTaskIds: z.array(idSchema).max(20).default([]),
});

/** Admin override: any research field plus the courier snapshot and owner. */
export const overrideSchema = researchFieldsSchema.extend({
  productId: idSchema,
  courierChargePct: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a percentage").refine((v) => Number(v) <= 100, "At most 100%"),
  mediaBuyerId: z.string().optional().nullable().transform((v) => v || null),
});

export const taskDueSchema = z.object({
  taskId: idSchema,
  dueAt: z.string().datetime({ offset: true, message: "Pick a date and time" }).nullable(),
});
