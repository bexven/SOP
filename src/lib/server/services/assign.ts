import "server-only";
import type { Role } from "@/generated/prisma/enums";
import { assignMany, OPEN_STATUSES, type Candidate } from "@/lib/domain/assignment";
import type { Tx } from "../db";

/** Active people in the given roles with their current open-task counts. */
export async function loadCandidates(tx: Tx, roles: Role[]): Promise<Candidate[]> {
  if (roles.length === 0) return [];
  const users = await tx.user.findMany({
    where: { active: true, role: { in: [...new Set(roles)] } },
    select: { id: true, name: true, role: true, active: true, lastAssignedAt: true },
  });
  if (users.length === 0) return [];
  const counts = await tx.task.groupBy({
    by: ["assigneeId"],
    where: { assigneeId: { in: users.map((u) => u.id) }, status: { in: [...OPEN_STATUSES] } },
    _count: { _all: true },
  });
  const byUser = new Map(counts.map((c) => [c.assigneeId, c._count._all]));
  return users.map((u) => ({ ...u, openTaskCount: byUser.get(u.id) ?? 0 }));
}

/** Picks assignees for several roles at once and records lastAssignedAt. */
export async function autoAssign(tx: Tx, roles: Role[], now: Date): Promise<(string | null)[]> {
  const picks = assignMany(await loadCandidates(tx, roles), roles, now);
  const ids = [...new Set(picks.filter((p): p is string => Boolean(p)))];
  if (ids.length) await tx.user.updateMany({ where: { id: { in: ids } }, data: { lastAssignedAt: now } });
  return picks;
}
