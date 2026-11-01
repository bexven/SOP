"use server";

import { z } from "zod";
import { markReadSchema } from "@/lib/validation/comment";
import { defineAction } from "../action";
import { db } from "../db";

export type NotificationDTO = {
  id: string;
  type: string;
  message: string;
  productId: string | null;
  read: boolean;
  createdAt: string;
  actor: { name: string; avatarColor: string } | null;
};

/** Polled by the bell (~30 s) — returns the latest notifications and the unread count. */
export const fetchNotificationsAction = defineAction({
  schema: z.object({}).optional(),
  run: async (_input, { user }) => {
    const [items, unread] = await Promise.all([
      db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    const actorIds = [...new Set(items.map((i) => i.actorId).filter((x): x is string => Boolean(x)))];
    const actors = new Map(
      (await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, avatarColor: true } })).map((a) => [a.id, a]),
    );
    const data: { items: NotificationDTO[]; unread: number } = {
      unread,
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        productId: n.productId,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
        actor: n.actorId ? (actors.get(n.actorId) ?? null) : null,
      })),
    };
    return { ok: true, data };
  },
});

export const markNotificationsReadAction = defineAction({
  schema: markReadSchema,
  run: async ({ ids, all }, { user }) => {
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(all ? {} : { id: { in: ids ?? [] } }) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  },
});
