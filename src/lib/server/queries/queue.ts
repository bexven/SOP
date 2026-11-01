import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { can } from "@/lib/domain/permissions";
import { groupQueue } from "@/lib/domain/queue";
import { productRef } from "@/lib/format";
import { db } from "../db";

const REVIEWED = ["WEBSITE_IMAGE", "AD_IMAGE_LANDSCAPE", "AD_IMAGE_SQUARE", "AD_IMAGE_VERTICAL", "STORE_LISTING", "VIDEO_MAIN", "VIDEO_SQUARE"] as const;

const include = {
  product: { select: { id: true, number: true, name: true, imageUrl: true, stage: true, priority: true, mediaBuyerId: true } },
  assignee: { select: { id: true, name: true, avatarColor: true, avatarAssetId: true } },
} as const;

type Row = Awaited<ReturnType<typeof loadRows>>[number];
async function loadRows(where: Prisma.TaskWhereInput) {
  return db.task.findMany({ where, include, orderBy: { dueAt: "asc" } });
}

function toItem(t: Row) {
  return {
    id: t.id,
    type: t.type,
    status: t.status,
    dueAt: t.dueAt,
    priority: t.product.priority,
    revisionNote: t.revisionNote,
    submittedAt: t.submittedAt?.toISOString() ?? null,
    assignee: t.assignee,
    product: { id: t.product.id, ref: productRef(t.product.number), name: t.product.name, imageUrl: t.product.imageUrl, stage: t.product.stage },
  };
}

export type QueueItem = Omit<ReturnType<typeof toItem>, "dueAt"> & { dueAt: string | null };
const ser = (i: ReturnType<typeof toItem>): QueueItem => ({ ...i, dueAt: i.dueAt?.toISOString() ?? null });

/** Only what is waiting on this person. */
export async function getQueue(user: { id: string; role: Role }) {
  const now = new Date();
  const mine = (await loadRows({ assigneeId: user.id, status: { in: ["TODO", "REVISION"] } })).map(toItem);
  const groups = groupQueue(mine, now);

  let review: QueueItem[] = [];
  if (user.role === "MEDIA_BUYER" || user.role === "REVIEWER" || user.role === "ADMIN") {
    // Media buyers: products they own, plus products without an owner. Admin: everything.
    review = (
      await loadRows({
        status: "SUBMITTED",
        type: { in: [...REVIEWED] },
        ...(user.role === "MEDIA_BUYER" ? { product: { OR: [{ mediaBuyerId: user.id }, { mediaBuyerId: null }] } } : {}),
      })
    )
      .map(toItem)
      .map(ser);
  }
  let unassigned: QueueItem[] = [];
  if (can(user.role, "task.reassignAny")) {
    unassigned = (await loadRows({ assigneeId: null, status: { in: ["TODO", "REVISION", "SUBMITTED", "LOCKED"] } })).map(toItem).map(ser);
  }
  return {
    overdue: groups.overdue.map(ser),
    today: groups.today.map(ser),
    upcoming: groups.upcoming.map(ser),
    revision: groups.revision.map(ser),
    review,
    unassigned,
  };
}

/** Sidebar badge: actionable items for this person. */
export async function getQueueCount(user: { id: string; role: Role }): Promise<number> {
  const mine = await db.task.count({ where: { assigneeId: user.id, status: { in: ["TODO", "REVISION"] } } });
  if (user.role !== "MEDIA_BUYER" && user.role !== "REVIEWER") return mine;
  const review = await db.task.count({
    where: {
      status: "SUBMITTED",
      type: { in: [...REVIEWED] },
      ...(user.role === "MEDIA_BUYER" ? { product: { OR: [{ mediaBuyerId: user.id }, { mediaBuyerId: null }] } } : {}),
    },
  });
  return mine + review;
}
