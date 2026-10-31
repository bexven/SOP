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
} from "@/lib/validation/team";
import { ActionError, defineAction } from "../action";
import { hashPin } from "../auth/pin-hash";
import { db } from "../db";

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
  capability: "team.manage",
  schema: createMemberSchema,
  run: async (input) => {
    await assertNameAvailable(input.name);
    assertStrongPin(input.pin);
    await db.user.create({
      data: {
        name: input.name,
        role: input.role,
        avatarColor: input.avatarColor,
        pinHash: await hashPin(input.pin),
        mustChangePin: true,
      },
    });
    return done(`${input.name} added as ${ROLE_LABELS[input.role]}`);
  },
});

export const updateMemberAction = defineAction({
  capability: "team.manage",
  schema: updateMemberSchema,
  run: async (input, { user }) => {
    const target = await db.user.findUnique({ where: { id: input.id } });
    if (!target) throw new ActionError("That person no longer exists.");
    await assertNameAvailable(input.name, input.id);
    const guard = canChangeRole(user.id, target, input.role, await teamSnapshot());
    if (!guard.ok) throw new ActionError(guard.reason);
    await db.user.update({
      where: { id: input.id },
      data: { name: input.name, role: input.role, avatarColor: input.avatarColor },
    });
    return done(`${input.name} updated`);
  },
});

export const setMemberActiveAction = defineAction({
  capability: "team.manage",
  schema: setActiveSchema,
  run: async ({ id, active }, { user }) => {
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new ActionError("That person no longer exists.");
    if (!active) {
      const guard = canDeactivate(user.id, target, await teamSnapshot());
      if (!guard.ok) throw new ActionError(guard.reason);
      // Deactivation signs them out everywhere.
      await db.user.update({ where: { id }, data: { active: false, sessionVersion: { increment: 1 } } });
      return done(`${target.name} deactivated`);
    }
    if (target.active) throw new ActionError(`${target.name} is already active.`);
    await db.user.update({ where: { id }, data: { active: true } });
    return done(`${target.name} reactivated`);
  },
});

export const resetPinAction = defineAction({
  capability: "team.manage",
  schema: resetPinSchema,
  run: async ({ id, pin }) => {
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new ActionError("That person no longer exists.");
    assertStrongPin(pin);
    await db.user.update({
      where: { id },
      data: {
        pinHash: await hashPin(pin),
        mustChangePin: true,
        failedPinAttempts: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    });
    return done(`PIN reset for ${target.name}. They'll choose a new one at next sign-in.`);
  },
});

export const unlockMemberAction = defineAction({
  capability: "team.manage",
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
