import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { can, type Capability } from "@/lib/domain/permissions";
import { db } from "../db";
import { readSession } from "./session";

export type CurrentUser = {
  id: string;
  name: string;
  role: Role;
  avatarColor: string;
  avatarAssetId: string | null;
  mustChangePin: boolean;
};

/**
 * The signed-in user, or null. Verifies the cookie signature AND that the
 * user is still active with a matching sessionVersion (revocation).
 * Memoised per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, role: true, avatarColor: true, avatarAssetId: true, mustChangePin: true, active: true, sessionVersion: true },
  });
  if (!user || !user.active || user.sessionVersion !== session.version) return null;
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    avatarColor: user.avatarColor,
    avatarAssetId: user.avatarAssetId,
    mustChangePin: user.mustChangePin,
  };
});

/** For pages/layouts: redirect to /login (or /change-pin) when needed. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePin) redirect("/change-pin");
  return user;
}

/** For pages: require a capability, otherwise send the user home. */
export async function requireCapability(capability: Capability): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, capability)) redirect("/dashboard");
  return user;
}
