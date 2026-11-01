"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  afterFailedAttempt,
  afterSuccessfulAttempt,
  ipWindowStart,
  isIpThrottled,
  isLocked,
  isWeakPin,
  MAX_FAILED_ATTEMPTS,
  minutesUntilUnlock,
} from "@/lib/domain/pin";
import { changePinSchema, loginSchema } from "@/lib/validation/auth";
import { defineAction, type ActionResult } from "../action";
import { hashPin, verifyPin } from "../auth/pin-hash";
import { clearSession, writeSession } from "../auth/session";
import { db } from "../db";

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

export async function loginAction(raw: unknown): Promise<ActionResult<{ mustChangePin: boolean }>> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter your PIN." };
  const { userId, pin } = parsed.data;
  const now = new Date();
  const ip = await clientIp();

  const recentFailures = await db.loginAttempt.count({
    where: { ip, success: false, createdAt: { gte: ipWindowStart(now) } },
  });
  if (isIpThrottled(recentFailures)) {
    return { ok: false, error: "Too many attempts from this device. Try again in 15 minutes." };
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) {
    await db.loginAttempt.create({ data: { ip, success: false } });
    return { ok: false, error: "This account isn't available. Ask an Admin." };
  }

  // Accounts created without a PIN (e.g. by a migration) wait for the Master Admin to set one.
  if (user.pinHash.startsWith("!")) {
    return { ok: false, error: "Your PIN hasn't been set yet. Ask the Master Admin to set it on the Team page." };
  }

  if (isLocked(user, now)) {
    const mins = minutesUntilUnlock(user, now);
    return { ok: false, error: `Too many wrong PINs. Locked for ${mins} more minute${mins === 1 ? "" : "s"}.` };
  }

  const valid = await verifyPin(pin, user.pinHash);
  if (!valid) {
    const next = afterFailedAttempt(user, now);
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: next }),
      db.loginAttempt.create({ data: { ip, success: false } }),
    ]);
    if (next.lockedUntil) {
      return { ok: false, error: "Too many wrong PINs. Your account is locked for 15 minutes." };
    }
    const left = MAX_FAILED_ATTEMPTS - next.failedPinAttempts;
    return { ok: false, error: `Incorrect PIN. ${left} attempt${left === 1 ? "" : "s"} left.` };
  }

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: afterSuccessfulAttempt() }),
    db.loginAttempt.create({ data: { ip, success: true } }),
    // Housekeeping: throttle rows older than a day are no longer useful.
    db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 86_400_000) } } }),
  ]);
  await writeSession({ userId: user.id, version: user.sessionVersion });
  return { ok: true, data: { mustChangePin: user.mustChangePin } };
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}

export const changePinAction = defineAction({
  schema: changePinSchema,
  allowPendingPinChange: true,
  run: async ({ pin }, { user }) => {
    if (isWeakPin(pin)) {
      return { ok: false, error: "That PIN is too easy to guess. Avoid repeats and simple runs." };
    }
    const updated = await db.user.update({
      where: { id: user.id },
      data: { pinHash: await hashPin(pin), mustChangePin: false, sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });
    // New version: every other device is signed out; this one stays signed in.
    await writeSession({ userId: user.id, version: updated.sessionVersion });
    return { ok: true, message: "PIN updated" };
  },
});
