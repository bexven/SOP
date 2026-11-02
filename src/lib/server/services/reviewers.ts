import "server-only";
import { can } from "@/lib/domain/permissions";
import type { Tx } from "../db";

/**
 * Who gets "ready for review": every active Senior (people with the "approve creative" permission).
 * Media buyers only for products they own (or products without an owner).
 */
export async function reviewers(tx: Tx, mediaBuyerId: string | null): Promise<string[]> {
  const people = await tx.user.findMany({
    where: { active: true },
    select: { id: true, role: true, permissions: true, adminAccess: true, isMaster: true },
  });
  return people
    .filter((u) => !u.adminAccess && !u.isMaster && u.role !== "ADMIN" && can({ role: u.role, permissions: u.permissions }, "task.review"))
    .filter((u) => u.role !== "MEDIA_BUYER" || !mediaBuyerId || u.id === mediaBuyerId)
    .map((u) => u.id);
}

