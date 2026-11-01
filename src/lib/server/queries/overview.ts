import "server-only";
import type { KillReason, ProductStage, TaskStatus } from "@/generated/prisma/enums";
import { OPEN_STATUSES } from "@/lib/domain/assignment";
import { STAGES } from "@/lib/domain/labels";
import { averageStageDurations } from "@/lib/domain/stage-time";
import { productRef } from "@/lib/format";
import { db } from "../db";

export async function getOverview() {
  const now = new Date();
  const [stageGroups, overdue, people, openTasks, transitions, killed] = await Promise.all([
    db.product.groupBy({ by: ["stage"], _count: { _all: true } }),
    db.task.findMany({
      where: { status: { in: ["TODO", "REVISION"] }, dueAt: { lt: now } },
      orderBy: { dueAt: "asc" },
      take: 12,
      include: {
        assignee: { select: { id: true, name: true, avatarColor: true } },
        product: { select: { id: true, name: true, number: true } },
      },
    }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true, avatarColor: true, role: true }, orderBy: { name: "asc" } }),
    db.task.groupBy({ by: ["assigneeId", "status"], where: { status: { in: [...OPEN_STATUSES] } }, _count: { _all: true } }),
    db.stageTransition.findMany({ select: { productId: true, toStage: true, at: true }, orderBy: { at: "asc" } }),
    db.product.findMany({
      where: { stage: "KILLED" },
      orderBy: { killedAt: "desc" },
      select: { id: true, number: true, name: true, killReason: true, killNote: true, killedAt: true, stageBeforeKill: true },
    }),
  ]);

  const stageCounts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<ProductStage, number>;
  for (const g of stageGroups) stageCounts[g.stage] = g._count._all;

  const workload = people
    .map((p) => {
      const rows = openTasks.filter((t) => t.assigneeId === p.id);
      const by = (s: TaskStatus) => rows.filter((r) => r.status === s).reduce((n, r) => n + r._count._all, 0);
      return { ...p, todo: by("TODO") + by("REVISION"), review: by("SUBMITTED"), locked: by("LOCKED"), total: rows.reduce((n, r) => n + r._count._all, 0) };
    })
    .filter((p) => p.role !== "ADMIN" || p.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const unassigned = openTasks.filter((t) => t.assigneeId === null).reduce((n, r) => n + r._count._all, 0);

  const byProduct = new Map<string, { toStage: ProductStage; at: Date }[]>();
  for (const t of transitions) {
    const list = byProduct.get(t.productId) ?? [];
    list.push({ toStage: t.toStage, at: t.at });
    byProduct.set(t.productId, list);
  }
  const averages = averageStageDurations([...byProduct.values()]);

  const reasonCounts = new Map<KillReason, number>();
  for (const k of killed) if (k.killReason) reasonCounts.set(k.killReason, (reasonCounts.get(k.killReason) ?? 0) + 1);

  return {
    stageCounts,
    overdue: overdue.map((t) => ({
      id: t.id,
      type: t.type,
      dueAt: t.dueAt!.toISOString(),
      assignee: t.assignee,
      product: { id: t.product.id, name: t.product.name, ref: productRef(t.product.number) },
    })),
    workload,
    unassigned,
    averages: (["RESEARCH", "CREATIVE", "READY_TO_LAUNCH", "LIVE"] as const).map((stage) => ({
      stage,
      avgMs: averages[stage]?.avgMs ?? null,
      count: averages[stage]?.count ?? 0,
    })),
    killed: killed.slice(0, 8).map((k) => ({ ...k, ref: productRef(k.number), killedAt: k.killedAt?.toISOString() ?? null })),
    killReasons: [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
    killedTotal: killed.length,
  };
}
