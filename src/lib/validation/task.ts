import { z } from "zod";
import { idSchema } from "./common";
import { urlSchema } from "./product";

const note = z.string().trim().max(2000, "Keep the note under 2000 characters");

export const submitTaskSchema = z.object({
  taskId: idSchema,
  url: urlSchema,
  note: note.optional().transform((v) => v || null),
});
export const approveTaskSchema = z.object({ taskId: idSchema, note: note.optional().transform((v) => v || null) });
export const revisionSchema = z.object({ taskId: idSchema, note: note.min(3, "Explain what needs to change") });
export const reassignSchema = z.object({ taskId: idSchema, assigneeId: idSchema });
export const briefSchema = z.object({ productId: idSchema, brief: z.string().max(20_000, "The brief is too long") });
