import "server-only";
import { db } from "../db";

/** Active people for the login avatar grid (pre-auth: expose names only). */
export async function getLoginRoster() {
  return db.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true, avatarColor: true, avatarAssetId: true },
    orderBy: [{ name: "asc" }],
  });
}

export async function getTeam() {
  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      avatarColor: true, avatarAssetId: true,
      active: true,
      adminAccess: true,
      isMaster: true,
      mustChangePin: true,
      pinHash: true,
      lockedUntil: true,
      createdAt: true,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const now = Date.now();
  return users.map(({ pinHash, ...u }) => ({
    ...u,
    // Never send hashes to the client; only whether a PIN exists.
    pinNotSet: pinHash.startsWith("!"),
    locked: u.lockedUntil !== null && u.lockedUntil.getTime() > now,
    createdAt: u.createdAt.toISOString(),
    lockedUntil: u.lockedUntil?.toISOString() ?? null,
  }));
}

export type TeamRow = Awaited<ReturnType<typeof getTeam>>[number];
