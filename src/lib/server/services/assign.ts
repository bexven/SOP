import "server-only";
import type { Role } from "@/generated/prisma/enums";
import { assignMany, OPEN_STATUSES, type Candidate } from "@/lib/domain/assignment";
import type { Tx } from "../db";
import { userCanSeeBrandWhere } from "./brand-scope";

/**
 * Active people in the given roles with their current open-task counts.
 * For a restricted brand (e.g. Bexven) only people with access to it are candidates.
 */
export async function loadCandidates(tx: Tx, roles: Role[], opts: { brandId?: string | null } = {}): Promise<Candidate[]> {
  if (roles.length === 0) return [];
  const brand = opts.brandId ? await tx.brand.findUnique({ where: { id: opts.brandId }, select: { id: true, restricted: true } }) : null;
  const users = await tx.user.findMany({
    where: { active: true, removedAt: null, role: { in: [...new Set(roles)] }, ...userCanSeeBrandWhere(brand) },
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
export async function autoAssign(tx: Tx, roles: Role[], now: Date, opts: { brandId?: string | null } = {}): Promise<(string | null)[]> {
  const picks = assignMany(await loadCandidates(tx, roles, opts), roles, now);
  const ids = [...new Set(picks.filter((p): p is string => Boolean(p)))];
  if (ids.length) await tx.user.updateMany({ where: { id: { in: ids } }, data: { lastAssignedAt: now } });
  return picks;
}
