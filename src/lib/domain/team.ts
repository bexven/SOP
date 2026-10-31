import type { Role } from "@/generated/prisma/enums";

/**
 * Team-management guard rules (pure). These protect the system from locking
 * itself out: there must always be at least one active Admin.
 */

export type TeamMember = { id: string; role: Role; active: boolean };

export type GuardResult = { ok: true } | { ok: false; reason: string };

const ok: GuardResult = { ok: true };

function activeAdmins(team: TeamMember[]): TeamMember[] {
  return team.filter((m) => m.active && m.role === "ADMIN");
}

export function canDeactivate(actorId: string, target: TeamMember, team: TeamMember[]): GuardResult {
  if (!target.active) return { ok: false, reason: "This person is already inactive." };
  if (target.id === actorId) return { ok: false, reason: "You can't deactivate yourself." };
  if (target.role === "ADMIN" && activeAdmins(team).length <= 1) {
    return { ok: false, reason: "There must always be at least one active Admin." };
  }
  return ok;
}

export function canChangeRole(
  actorId: string,
  target: TeamMember,
  newRole: Role,
  team: TeamMember[],
): GuardResult {
  if (target.role === newRole) return ok;
  if (target.role === "ADMIN" && target.id === actorId) {
    return { ok: false, reason: "You can't remove your own Admin role." };
  }
  if (target.role === "ADMIN" && target.active && activeAdmins(team).length <= 1) {
    return { ok: false, reason: "There must always be at least one active Admin." };
  }
  return ok;
}
