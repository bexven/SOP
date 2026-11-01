import { z } from "zod";
import { FollowUpKind, Reaction } from "@/generated/prisma/enums";
import { idSchema } from "./common";
import { urlSchema } from "./product";

const note = z.string().trim().max(2000, "Keep the note under 2000 characters");

export const submitTaskSchema = z.object({
  taskId: idSchema,
  images: z.array(idSchema).max(20, "Up to 20 images per submission").default([]),
  links: z
    .array(z.object({ url: urlSchema, label: z.string().trim().max(80).optional().transform((v) => v || null) }))
    .max(10, "Up to 10 links")
    .default([]),
  note: note.optional().transform((v) => v || null),
});
export const approveTaskSchema = z.object({
  taskId: idSchema,
  note: note.optional().transform((v) => v || null),
  followUp: z
    .object({ kind: z.enum(FollowUpKind), note: note.optional().transform((v) => v || null) })
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
});
export const reactSchema = z.object({ itemId: idSchema, reaction: z.enum(Reaction).nullable() });
export const itemCommentSchema = z.object({ itemId: idSchema, body: z.string().trim().min(1, "Write a comment").max(2000) });
export const revisionSchema = z.object({ taskId: idSchema, note: note.min(3, "Explain what needs to change") });
export const reassignSchema = z.object({ taskId: idSchema, assigneeId: idSchema });
export const briefSchema = z.object({ productId: idSchema, brief: z.string().max(20_000, "The brief is too long") });

export const folderSchema = z.object({
  batchId: idSchema,
  lane: z.enum(["images", "videos"]),
  url: z.union([urlSchema, z.literal("")]).transform((v) => v || null),
});
export const markReadySchema = z.object({
  taskId: idSchema,
  ready: z.boolean(),
  storeUrl: z.union([urlSchema, z.literal("")]).optional().transform((v) => v || null),
  images: z.array(idSchema).max(20).default([]),
  note: z.string().trim().max(2000).optional().transform((v) => v || null),
});
