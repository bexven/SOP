import { z } from "zod";
import { TaskType } from "@/generated/prisma/enums";
import { idSchema } from "./common";

const label = z.string().trim().min(2, "Write the checklist item").max(300, "Keep it under 300 characters");

export const addTemplateItemSchema = z.object({ taskType: z.enum(TaskType), label, required: z.boolean() });
export const updateTemplateItemSchema = z.object({ id: idSchema, label, required: z.boolean() });
export const setTemplateItemActiveSchema = z.object({ id: idSchema, active: z.boolean() });
export const reorderTemplateSchema = z.object({ taskType: z.enum(TaskType), ids: z.array(idSchema).max(200) });

