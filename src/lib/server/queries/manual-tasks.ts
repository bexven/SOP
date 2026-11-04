import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { canSeeBrand, type BrandViewer } from "@/lib/domain/permissions";
import { db } from "../db";
import { productScope } from "../services/brand-scope";

const person = { select: { id: true, name: true, avatarColor: true, avatarAssetId: true } } as const;

/** Manual tasks the viewer may see: all, except ones linked to a product of a brand they can't see. */
export function manualTaskScope(viewer: BrandViewer): Prisma.ManualTaskWhereInput {
  if (viewer.isMaster) return {};
  return { OR: [{ productId: null }, { product: productScope(viewer) }] };
}

/** Everything the /tasks board needs: tasks with their comments, people to assign / mention, products to link. */
export async function getManualBoard(viewer: BrandViewer) {
  const [tasks, people, products] = await Promise.all([
    db.manualTask.findMany({
      where: manualTaskScope(viewer),
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        assignee: person,
        createdBy: person,
        product: { select: { id: true, name: true, number: true, brand: { select: { name: true, color: true } } } },
        comments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { author: person } },
      },
    }),
    db.user.findMany({
      where: { active: true, removedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarColor: true, avatarAssetId: true },
    }),
    db.product.findMany({
      where: { AND: [productScope(viewer), { stage: { not: "KILLED" } }] },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { id: true, name: true, number: true, brand: { select: { id: true, restricted: true } } },
    }),
  ]);
  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      number: t.number,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt?.toISOString() ?? null,
      position: t.position,
      links: t.links,
      assignee: t.assignee,
      createdBy: t.createdBy,
      createdById: t.createdById,
      assigneeId: t.assigneeId,
      product: t.product,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      comments: t.comments.map((c) => ({
        id: c.id,
        body: c.body,
        author: c.author,
        createdAt: c.createdAt.toISOString(),
        editedAt: c.editedAt?.toISOString() ?? null,
      })),
    })),
    people,
    products: products.filter((p) => canSeeBrand(viewer, p.brand)).map(({ id, name, number }) => ({ id, name, number })),
  };
}

export type ManualBoard = Awaited<ReturnType<typeof getManualBoard>>;
export type ManualTaskDTO = ManualBoard["tasks"][number];

/** Open manual tasks assigned to someone (for the dashboard / menu badge). */
export async function countMyManualTasks(userId: string) {
  return db.manualTask.count({ where: { assigneeId: userId, status: { not: "DONE" } } });
}

/** The viewer's open board tasks (dashboard): soonest due first, then most urgent. */
export async function getMyManualTasks(viewer: BrandViewer & { id: string }) {
  const rows = await db.manualTask.findMany({
    where: { AND: [manualTaskScope(viewer), { assigneeId: viewer.id, status: { not: "DONE" } }] },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 30,
    select: { id: true, number: true, title: true, status: true, priority: true, dueAt: true, product: { select: { name: true } } },
  });
  const rank = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
  return rows
    .map((t) => ({ ...t, dueAt: t.dueAt?.toISOString() ?? null }))
    .sort((a, b) => (a.dueAt ?? "~").localeCompare(b.dueAt ?? "~") || rank[a.priority] - rank[b.priority]);
}
