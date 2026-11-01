import { z } from "zod";
import { TaskType } from "@/generated/prisma/enums";
import { idSchema } from "./common";
import { urlSchema } from "./product";

const label = z.string().trim().min(2, "Write the checklist item").max(300, "Keep it under 300 characters");

export const addTemplateItemSchema = z.object({ taskType: z.enum(TaskType), label, required: z.boolean() });
export const updateTemplateItemSchema = z.object({ id: idSchema, label, required: z.boolean() });
export const setTemplateItemActiveSchema = z.object({ id: idSchema, active: z.boolean() });
export const reorderTemplateSchema = z.object({ taskType: z.enum(TaskType), ids: z.array(idSchema).max(200) });

export const stepGuideSchema = z.object({
  taskType: z.enum(TaskType),
  body: z.string().max(20_000, "The guide is too long"),
  links: z
    .array(z.object({ label: z.string().trim().min(1, "Give the link a name").max(80), url: urlSchema }))
    .max(30, "Up to 30 links"),
});
