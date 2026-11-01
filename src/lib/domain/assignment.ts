import type { Role, TaskStatus } from "@/generated/prisma/enums";

/**
 * Auto-assignment (pure). A task goes to the active person in the required
 * role with the fewest open tasks; ties go to whoever was assigned least
 * recently (never-assigned first), then by name for determinism.
 */

/** Statuses that count towards someone's workload. */
export const OPEN_STATUSES = ["LOCKED", "TODO", "REVISION", "SUBMITTED"] as const satisfies readonly TaskStatus[];

export function isOpenStatus(status: TaskStatus): boolean {
  return (OPEN_STATUSES as readonly TaskStatus[]).includes(status);
}

export type Candidate = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  openTaskCount: number;
  lastAssignedAt: Date | null;
};

export function pickAssignee(candidates: Candidate[], role: Role, opts: { exclude?: string[] } = {}): Candidate | null {
  const pool = candidates.filter((c) => c.active && c.role === role && !opts.exclude?.includes(c.id));
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => {
    if (a.openTaskCount !== b.openTaskCount) return a.openTaskCount - b.openTaskCount;
    const at = a.lastAssignedAt?.getTime() ?? -Infinity;
    const bt = b.lastAssignedAt?.getTime() ?? -Infinity;
    if (at !== bt) return at - bt;
    return a.name.localeCompare(b.name);
  })[0]!;
}

/**
 * Assigns a list of roles in order, updating the in-memory workload after
 * each pick so several tasks created together are spread fairly.
 */
export function assignMany(candidates: Candidate[], roles: Role[], now: Date): (string | null)[] {
  const pool = candidates.map((c) => ({ ...c }));
  return roles.map((role) => {
    const pick = pickAssignee(pool, role);
    if (!pick) return null;
    const entry = pool.find((c) => c.id === pick.id)!;
    entry.openTaskCount += 1;
    entry.lastAssignedAt = now;
    return pick.id;
  });
}
