import { z } from "zod";
import { DiscussionPhase } from "@/generated/prisma/enums";
import { idSchema } from "./common";

const body = z.string().trim().min(1, "Write something first").max(5000, "Keep comments under 5000 characters");

export const addCommentSchema = z.object({
  productId: idSchema,
  body,
  parentId: idSchema.optional().nullable().transform((v) => v || null),
  phase: z.enum(DiscussionPhase).default("REVIEW"),
  /** A creative task's own discussion. */
  taskId: idSchema.optional().nullable().transform((v) => v || null),
});
export const editCommentSchema = z.object({ commentId: idSchema, body });
export const markReadSchema = z.object({ ids: z.array(idSchema).max(200).optional(), all: z.boolean().optional() });
