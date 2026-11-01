import "server-only";
import type { EventType, NotificationType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "../db";

export type EventInput = {
  type: EventType;
  actorId: string;
  productId?: string | null;
  taskId?: string | null;
  data?: Prisma.InputJsonValue;
};

export async function logEvents(tx: Tx, events: EventInput[]) {
  if (events.length === 0) return;
  await tx.activityEvent.createMany({
    data: events.map((e) => ({
      type: e.type,
      actorId: e.actorId,
      productId: e.productId ?? null,
      taskId: e.taskId ?? null,
      data: e.data,
    })),
  });
}

export type NotificationInput = {
  userId: string | null | undefined;
  type: NotificationType;
  message: string;
  productId?: string | null;
  taskId?: string | null;
};

/** Creates notifications, skipping the actor themselves, empty recipients and duplicates. */
export async function notify(tx: Tx, actorId: string, items: NotificationInput[]) {
  const seen = new Set<string>();
  const data = items
    .filter((n): n is NotificationInput & { userId: string } => Boolean(n.userId) && n.userId !== actorId)
    .filter((n) => {
      const key = `${n.userId}|${n.type}|${n.taskId ?? ""}|${n.productId ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((n) => ({
      userId: n.userId,
      actorId,
      type: n.type,
      message: n.message,
      productId: n.productId ?? null,
      taskId: n.taskId ?? null,
    }));
  if (data.length) await tx.notification.createMany({ data });
}

export async function activeAdminIds(tx: Tx): Promise<string[]> {
  const admins = await tx.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  return admins.map((a) => a.id);
}
