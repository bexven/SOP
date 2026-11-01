import { z } from "zod";
import { FollowUpKind } from "@/generated/prisma/enums";
import { idSchema } from "./common";
import { urlSchema } from "./product";

const note = z.string().trim().max(2000, "Keep the note under 2000 characters");

export const approveTaskSchema = z.object({
  taskId: idSchema,
  note: note.optional().transform((v) => v || null),
  followUp: z
    .object({
      kind: z.enum(FollowUpKind).refine((k) => k !== "OTHER", "Pick a different angle or a different size"),
      note: note.optional().transform((v) => v || null),
    })
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
});
export const revisionSchema = z.object({ taskId: idSchema, note: note.min(3, "Explain what needs to change") });
export const reassignSchema = z.object({ taskId: idSchema, assigneeId: idSchema });
export const briefSchema = z.object({ productId: idSchema, brief: z.string().max(20_000, "The brief is too long") });

/** Tick "ready": the links the maker adds (website URL, ad image links or video links). Untick takes it back. */
export const markReadySchema = z.object({
  taskId: idSchema,
  ready: z.boolean(),
  links: z.array(urlSchema).max(20, "Up to 20 links").default([]),
  note: z.string().trim().max(2000).optional().transform((v) => v || null),
});
