import { z } from "zod";
import { ManualTaskStatus, Priority } from "@/generated/prisma/enums";
import { idSchema } from "./common";
import { urlSchema } from "./product";

const optionalId = z.string().trim().max(64).optional().nullable().transform((v) => v || null);

export const manualTaskFieldsSchema = z.object({
  title: z.string().trim().min(2, "Give the task a title").max(140, "Keep the title under 140 characters"),
  description: z.string().trim().max(5000, "Keep the details under 5000 characters").optional().nullable().transform((v) => v || null),
  priority: z.enum(Priority).default("MEDIUM"),
  dueAt: z.string().datetime({ offset: true, message: "Pick a date and time" }).nullable().optional().or(z.literal("")).transform((v) => v || null),
  assigneeId: optionalId,
  productId: optionalId,
  links: z.array(urlSchema).max(20, "Up to 20 links").default([]),
});

export const createManualTaskSchema = manualTaskFieldsSchema.extend({ status: z.enum(ManualTaskStatus).default("TODO") });
export const updateManualTaskSchema = manualTaskFieldsSchema.extend({ manualTaskId: idSchema });

/** Drag and drop (or the "Move to" menu): new column and the cards it now sits between. */
export const moveManualTaskSchema = z.object({
  manualTaskId: idSchema,
  status: z.enum(ManualTaskStatus),
  beforeId: optionalId,
  afterId: optionalId,
});

export const manualTaskIdSchema = z.object({ manualTaskId: idSchema });

export const manualCommentSchema = z.object({
  manualTaskId: idSchema,
  body: z.string().trim().min(1, "Write something first").max(5000, "Keep it under 5000 characters"),
});

export type ManualTaskFieldsInput = z.input<typeof manualTaskFieldsSchema>;
