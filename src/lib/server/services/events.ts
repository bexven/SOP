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
  /** Where clicking goes when it isn't the product page (e.g. a manual task). */
  link?: string | null;
};

/** Creates notifications, skipping the actor themselves, empty recipients and duplicates. */
export async function notify(tx: Tx, actorId: string, items: NotificationInput[]) {
  const seen = new Set<string>();
  const data = items
    .filter((n): n is NotificationInput & { userId: string } => Boolean(n.userId) && n.userId !== actorId)
    .filter((n) => {
      const key = `${n.userId}|${n.type}|${n.taskId ?? ""}|${n.productId ?? ""}|${n.link ?? ""}`;
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
      link: n.link ?? null,
    }));
  if (data.length === 0) return;
  // Restricted brands (e.g. Bexven): never tell people who can't see the product.
  const productIds = [...new Set(data.map((d) => d.productId).filter((id): id is string => Boolean(id)))];
  const restricted = productIds.length
    ? await tx.product.findMany({ where: { id: { in: productIds }, brand: { restricted: true } }, select: { id: true, brandId: true } })
    : [];
  let allowed = data;
  if (restricted.length) {
    const brandOf = new Map(restricted.map((p) => [p.id, p.brandId!]));
    const users = await tx.user.findMany({ where: { id: { in: [...new Set(data.map((d) => d.userId))] } }, select: { id: true, isMaster: true, brandAccess: true } });
    const byId = new Map(users.map((u) => [u.id, u]));
    allowed = data.filter((d) => {
      const brandId = d.productId ? brandOf.get(d.productId) : undefined;
      if (!brandId) return true;
      const u = byId.get(d.userId);
      return Boolean(u && (u.isMaster || u.brandAccess.includes(brandId)));
    });
  }
  if (allowed.length) await tx.notification.createMany({ data: allowed });
}

export async function activeAdminIds(tx: Tx): Promise<string[]> {
  const admins = await tx.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  return admins.map((a) => a.id);
}
