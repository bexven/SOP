"use server";

import { revalidatePath } from "next/cache";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { isWeakPin } from "@/lib/domain/pin";
import { canChangeRole, canDeactivate } from "@/lib/domain/team";
import {
  createMemberSchema,
  resetPinSchema,
  setActiveSchema,
  unlockSchema,
  updateMemberSchema,
  accessSchema,
} from "@/lib/validation/team";
import { defaultPermissions, normalizePermissions } from "@/lib/domain/permissions";
import { ActionError, defineAction } from "../action";
import { hashPin } from "../auth/pin-hash";
import { db } from "../db";
import { redistributeWork } from "../services/deactivate";

async function assertNameAvailable(name: string, exceptId?: string) {
  const clash = await db.user.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new ActionError("Someone with that name already exists. Names must be unique on the login screen.");
}

function assertStrongPin(pin: string) {
  if (isWeakPin(pin)) throw new ActionError("That PIN is too easy to guess. Avoid repeats and simple runs.");
}

async function teamSnapshot() {
  return db.user.findMany({ select: { id: true, role: true, active: true } });
}

function done(message: string) {
  revalidatePath("/team");
  revalidatePath("/login");
  return { ok: true as const, message };
}

export const createMemberAction = defineAction({
  masterOnly: true,
  schema: createMemberSchema,
  run: async (input) => {
    await assertNameAvailable(input.name);
    assertStrongPin(input.pin);
    await db.user.create({
      data: {
        name: input.name,
        role: input.role,
        avatarColor: input.avatarColor,
        adminAccess: input.role === "ADMIN" ? false : input.adminAccess,
        permissions: defaultPermissions(input.role),
        pinHash: await hashPin(input.pin),
        mustChangePin: true,
      },
    });
    return done(`${input.name} added as ${ROLE_LABELS[input.role]}`);
  },
});

export const updateMemberAction = defineAction({
  masterOnly: true,
  schema: updateMemberSchema,
  run: async (input, { user }) => {
    const target = await db.user.findUnique({ where: { id: input.id } });
    if (!target) throw new ActionError("That person no longer exists.");
    if (target.isMaster && input.role !== "ADMIN") throw new ActionError("The Master Admin must keep the Admin role.");
    await assertNameAvailable(input.name, input.id);
    const guard = canChangeRole(user.id, target, input.role, await teamSnapshot());
    if (!guard.ok) throw new ActionError(guard.reason);
    await db.user.update({
      where: { id: input.id },
      data: {
        name: input.name,
        role: input.role,
        avatarColor: input.avatarColor,
        adminAccess: input.role === "ADMIN" ? false : input.adminAccess,
        // A new job role starts from that role's default permissions (fine-tune on the Roles page).
        ...(input.role !== target.role ? { permissions: defaultPermissions(input.role) } : {}),
        // Permissions are read fresh from the DB on every request; bump only when access is reduced.
        ...(target.adminAccess && !input.adminAccess ? { sessionVersion: { increment: 1 } } : {}),
      },
    });
    return done(`${input.name} updated`);
  },
});

export const setMemberActiveAction = defineAction({
  masterOnly: true,
  schema: setActiveSchema,
  run: async ({ id, active }, { user }) => {
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new ActionError("That person no longer exists.");
    if (!active) {
      if (target.isMaster) throw new ActionError("The Master Admin can't be deactivated.");
      const guard = canDeactivate(user.id, target, await teamSnapshot());
      if (!guard.ok) throw new ActionError(guard.reason);
      // Deactivation signs them out everywhere and hands their open work on (Q8).
      const moved = await db.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { active: false, sessionVersion: { increment: 1 } } });
        return redistributeWork(tx, id, user.id);
      });
      revalidatePath("/", "layout");
      const parts = [`${target.name} deactivated`];
      if (moved.moved) parts.push(`${moved.moved} task${moved.moved === 1 ? "" : "s"} reassigned`);
      if (moved.unassigned) parts.push(`${moved.unassigned} need an assignee`);
      return done(parts.join(" · "));
    }
    if (target.active) throw new ActionError(`${target.name} is already active.`);
    await db.user.update({ where: { id }, data: { active: true } });
    return done(`${target.name} reactivated`);
  },
});

export const resetPinAction = defineAction({
  masterOnly: true,
  schema: resetPinSchema,
  run: async ({ id, pin, requireChange }, { user }) => {
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new ActionError("That person no longer exists.");
    assertStrongPin(pin);
    await db.user.update({
      where: { id },
      data: {
        pinHash: await hashPin(pin),
        mustChangePin: requireChange && id !== user.id,
        failedPinAttempts: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    });
    return done(
      requireChange && id !== user.id
        ? `PIN changed for ${target.name}. They'll choose their own at next sign-in.`
        : `PIN changed for ${target.name}.`,
    );
  },
});

export const unlockMemberAction = defineAction({
  masterOnly: true,
  schema: unlockSchema,
  run: async ({ id }) => {
    const target = await db.user.update({
      where: { id },
      data: { failedPinAttempts: 0, lockedUntil: null },
      select: { name: true },
    });
    return done(`${target.name} unlocked`);
  },
});

/** Roles & permissions: the Master Admin ticks what each person may do. */
export const setAccessAction = defineAction({
  masterOnly: true,
  schema: accessSchema,
  run: async ({ id, role, adminAccess, permissions }, { user }) => {
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new ActionError("That person no longer exists.");
    if (target.isMaster) throw new ActionError("The Master Admin always has every permission.");
    if (role !== target.role) {
      const guard = canChangeRole(user.id, target, role, await teamSnapshot());
      if (!guard.ok) throw new ActionError(guard.reason);
    }
    await db.user.update({
      where: { id },
      data: { role, adminAccess: role === "ADMIN" ? false : adminAccess, permissions: normalizePermissions(permissions) },
    });
    revalidatePath("/", "layout");
    return done(`${target.name}'s access saved`);
  },
});
