"use server";

import { revalidatePath } from "next/cache";
import type { TaskType } from "@/generated/prisma/enums";
import { laneOf, TASK_TYPE_SHORT } from "@/lib/domain/labels";
import { extractMentions } from "@/lib/domain/mentions";
import { addCommentSchema, editCommentSchema } from "@/lib/validation/comment";
import { ActionError, defineAction } from "../action";
import { db } from "../db";
import { logEvents, notify } from "../services/events";
import { reviewers } from "../services/reviewers";

export const addCommentAction = defineAction({
  schema: addCommentSchema,
  run: async ({ productId, body, parentId, phase, taskId }, { user }) => {
    await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true, name: true, mediaBuyerId: true } });
      if (!product) throw new ActionError("This product no longer exists.");
      let task: { id: string; type: TaskType; assigneeId: string | null } | null = null;
      if (taskId) {
        const found = await tx.task.findUnique({ where: { id: taskId }, select: { id: true, type: true, assigneeId: true, productId: true } });
        if (!found || found.productId !== productId) throw new ActionError("That task no longer exists.");
        task = found;
        const lane = laneOf(task.type);
        phase = lane === "videos" ? "VIDEOS" : lane === "images" ? "IMAGES" : phase;
      }
      let parentAuthor: string | null = null;
      if (parentId) {
        const parent = await tx.comment.findUnique({ where: { id: parentId } });
        if (!parent || parent.productId !== productId) throw new ActionError("That comment no longer exists.");
        // One level of replies: replying to a reply attaches to its thread.
        if (parent.parentId) parentId = parent.parentId;
        phase = parent.phase; // a reply stays in its thread's phase (and task)
        taskId = parent.taskId;
        parentAuthor = parent.authorId;
      }
      const people = await tx.user.findMany({ where: { active: true }, select: { id: true, name: true } });
      const mentioned = extractMentions(body, people);
      const comment = await tx.comment.create({
        data: {
          productId,
          authorId: user.id,
          parentId,
          body,
          phase,
          taskId,
          mentions: { create: mentioned.map((userId) => ({ userId })) },
        },
      });
      await logEvents(tx, [{ type: "COMMENT_ADDED", actorId: user.id, productId, data: { commentId: comment.id, phase, taskId } }]);
      const preview = body.length > 90 ? `${body.slice(0, 90)}…` : body;
      await notify(tx, user.id, [
        ...mentioned.map((userId) => ({
          userId,
          type: "MENTIONED" as const,
          productId,
          message: `${user.name} mentioned you on ${product.name}: “${preview}”`,
        })),
        // A task's discussion: the maker hears from the reviewers, and the reviewers from the maker.
        ...(task
          ? (task.assigneeId && task.assigneeId !== user.id ? [task.assigneeId] : await reviewers(tx, product.mediaBuyerId))
              .filter((id) => !mentioned.includes(id) && id !== parentAuthor)
              .map((id) => ({
                userId: id,
                type: "FEEDBACK" as const,
                productId,
                taskId: task!.id,
                message: `${user.name} on ${TASK_TYPE_SHORT[task!.type]} (${product.name}): “${preview}”`,
              }))
          : []),
        ...(parentAuthor && !mentioned.includes(parentAuthor)
          ? [
              {
                userId: parentAuthor,
                type: "MENTIONED" as const,
                productId,
                message: `${user.name} replied to you on ${product.name}: “${preview}”`,
              },
            ]
          : []),
      ]);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: parentId ? "Reply posted" : "Comment posted" };
  },
});

export const editCommentAction = defineAction({
  schema: editCommentSchema,
  run: async ({ commentId, body }, { user }) => {
    const comment = await db.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new ActionError("That comment no longer exists.");
    if (comment.authorId !== user.id) throw new ActionError("You can only edit your own comments.");
    await db.comment.update({ where: { id: commentId }, data: { body, editedAt: new Date() } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Comment updated" };
  },
});
