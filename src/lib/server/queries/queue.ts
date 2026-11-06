import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { can } from "@/lib/domain/permissions";
import { groupQueue } from "@/lib/domain/queue";
import { dueBucket } from "@/lib/domain/due";
import { productRef } from "@/lib/format";
import { db } from "../db";
import { productScope } from "../services/brand-scope";
import type { BrandViewer } from "@/lib/domain/permissions";

const REVIEWED = ["WEBSITE_IMAGE", "AD_IMAGE_LANDSCAPE", "AD_IMAGE_SQUARE", "AD_IMAGE_VERTICAL", "STORE_LISTING", "VIDEO_MAIN", "VIDEO_SQUARE"] as const;

const include = {
  product: { select: { id: true, number: true, name: true, imageUrl: true, stage: true, priority: true, mediaBuyerId: true, brand: { select: { name: true, color: true } } } },
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
    product: { id: t.product.id, ref: productRef(t.product.number), name: t.product.name, imageUrl: t.product.imageUrl, stage: t.product.stage, brand: t.product.brand },
  };
}

export type QueueItem = Omit<ReturnType<typeof toItem>, "dueAt"> & { dueAt: string | null };
const ser = (i: ReturnType<typeof toItem>): QueueItem => ({ ...i, dueAt: i.dueAt?.toISOString() ?? null });

export type QueueUser = { id: string; role: Role; jobRole: Role; permissions: readonly string[] } & BrandViewer;

/** Submitted creative work this person should review (Senior permission). Media buyers: their products + unowned. */
export function reviewWhere(user: QueueUser): Prisma.TaskWhereInput | null {
  if (!can(user, "task.review")) return null;
  const ownOnly = user.role !== "ADMIN" && user.jobRole === "MEDIA_BUYER";
  return {
    status: "SUBMITTED",
    type: { in: [...REVIEWED] },
    product: {
      AND: [productScope(user)],
      stage: { notIn: ["COMPLETED", "KILLED"] },
      ...(ownOnly ? { OR: [{ mediaBuyerId: user.id }, { mediaBuyerId: null }] } : {}),
    },
  };
}

const MINE = (userId: string): Prisma.TaskWhereInput => ({
  assigneeId: userId,
  status: { in: ["TODO", "REVISION"] },
  product: { stage: { notIn: ["COMPLETED", "KILLED"] } },
});

/** Only what is waiting on this person. Every dashboard number is counted from these same lists. */
export async function getQueue(user: QueueUser) {
  const now = new Date();
  const mine = (await loadRows(MINE(user.id))).map(toItem);
  const groups = groupQueue(mine, now);
  const rw = reviewWhere(user);
  const review = rw ? (await loadRows(rw)).map(toItem).map(ser) : [];
  let unassigned: QueueItem[] = [];
  if (can(user, "task.reassignAny")) {
    unassigned = (await loadRows({ assigneeId: null, status: { in: ["TODO", "REVISION", "SUBMITTED"] }, product: { AND: [productScope(user)], stage: { notIn: ["COMPLETED", "KILLED"] } } }))
      .map(toItem)
      .map(ser);
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

/** Menu badge: the same numbers the dashboard shows (my open tasks + reviews waiting on me). */
export async function getQueueCount(user: QueueUser): Promise<number> {
  const rw = reviewWhere(user);
  const [mine, review] = await Promise.all([db.task.count({ where: MINE(user.id) }), rw ? db.task.count({ where: rw }) : Promise.resolve(0)]);
  return mine + review;
}

/** Whole-team numbers for the Admin dashboard (open tasks on running products). */
export async function getTeamStats(viewer: BrandViewer) {
  const now = new Date();
  const open = await db.task.findMany({
    where: { status: { in: ["TODO", "REVISION", "SUBMITTED"] }, product: { AND: [productScope(viewer)], stage: { notIn: ["COMPLETED", "KILLED"] } } },
    select: { status: true, dueAt: true },
  });
  const notDone = open.filter((t) => t.status !== "SUBMITTED");
  return {
    pending: notDone.length,
    overdue: notDone.filter((t) => dueBucket(t.dueAt, now) === "overdue").length,
    today: notDone.filter((t) => dueBucket(t.dueAt, now) === "today").length,
    revision: open.filter((t) => t.status === "REVISION").length,
    review: open.filter((t) => t.status === "SUBMITTED").length,
  };
}
