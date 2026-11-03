"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { alertPrefsSchema, botTokenSchema, emptySchema, pushDeviceSchema, removePushSchema } from "@/lib/validation/alerts";
import { ActionError, defineAction } from "../action";
import { db } from "../db";
import { alertPerson, randomToken, sendDigestTo, telegramApi } from "../services/alerts";

function done(message: string) {
  revalidatePath("/profile");
  revalidatePath("/settings/notifications");
  return { ok: true as const, message };
}

/** This browser / phone turned on push notifications. */
export const savePushDeviceAction = defineAction({
  schema: pushDeviceSchema,
  run: async ({ endpoint, keys, label }, { user }) => {
    await db.pushDevice.upsert({
      where: { endpoint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, label, userId: user.id },
      update: { p256dh: keys.p256dh, auth: keys.auth, label, userId: user.id },
    });
    return done("Notifications are on for this device");
  },
});

export const removePushDeviceAction = defineAction({
  schema: removePushSchema,
  run: async ({ endpoint }, { user }) => {
    await db.pushDevice.deleteMany({ where: { endpoint, userId: user.id } });
    return done("Notifications are off for this device");
  },
});

export const setAlertPrefsAction = defineAction({
  schema: alertPrefsSchema,
  run: async ({ instant, digest }, { user }) => {
    await db.user.update({ where: { id: user.id }, data: { alertsInstant: instant, alertsDigest: digest } });
    return done("Alert settings saved");
  },
});

/** Sends a test alert to this person's devices and Telegram. */
export const sendTestAlertAction = defineAction({
  schema: emptySchema,
  run: async (_input, { user }) => {
    const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, telegramChatId: true } });
    const r = await alertPerson(me, { title: "Product SOP", body: `Test alert for ${user.name} — notifications work ✅`, url: "/profile", tag: "test" });
    if (!r.push && !r.telegram) throw new ActionError("Nothing to send to yet. Turn on notifications on this device or connect Telegram first.");
    const where = [r.push ? `${r.push} device${r.push === 1 ? "" : "s"}` : null, r.telegram ? "Telegram" : null].filter(Boolean).join(" and ");
    return { ok: true, message: `Test sent to ${where}` };
  },
});

/** Sends my morning summary now (to check how it looks). */
export const sendMyDigestAction = defineAction({
  schema: emptySchema,
  run: async (_input, { user }) => {
    const r = await sendDigestTo(user.id);
    if (!r.push && !r.telegram) throw new ActionError("Turn on notifications on this device or connect Telegram first.");
    return { ok: true, message: "Summary sent — check your phone / Telegram" };
  },
});

/** A one-time link that opens the bot; pressing Start connects this person's Telegram. */
export const createTelegramLinkAction = defineAction({
  schema: emptySchema,
  run: async (_input, { user }) => {
    const s = await db.settings.findUnique({ where: { id: 1 }, select: { telegramBotUsername: true } });
    if (!s?.telegramBotUsername) throw new ActionError("The Telegram bot isn't connected yet. Ask an Admin (Settings → Notifications).");
    const code = randomToken(18);
    await db.user.update({ where: { id: user.id }, data: { telegramLinkCode: code, telegramLinkUntil: new Date(Date.now() + 15 * 60_000) } });
    return { ok: true, message: "Opening Telegram — press Start", data: { url: `https://t.me/${s.telegramBotUsername}?start=${code}` } };
  },
});

export const disconnectTelegramAction = defineAction({
  schema: emptySchema,
  run: async (_input, { user }) => {
    await db.user.update({ where: { id: user.id }, data: { telegramChatId: null, telegramLinkCode: null, telegramLinkUntil: null } });
    return done("Telegram disconnected");
  },
});

// ── Admin: the team's Telegram bot ───────────────────────────────────────────

async function publicBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) throw new ActionError("Couldn't tell the app's address. Open the app from its public link and try again.");
  return `${proto}://${host}`;
}

/** Checks the token with Telegram, points the bot at this app and saves it. */
export const connectTelegramBotAction = defineAction({
  capability: "settings.manage",
  schema: botTokenSchema,
  run: async ({ token }, { user }) => {
    const base = await publicBaseUrl();
    if (!base.startsWith("https://")) throw new ActionError("Telegram needs the app on a public https:// address (it can't reach a local computer).");
    let me: { username?: string };
    try {
      me = await telegramApi<{ username?: string }>(token, "getMe");
    } catch (e) {
      throw new ActionError(`Telegram didn't accept that token: ${(e as Error).message}`);
    }
    if (!me.username) throw new ActionError("Telegram didn't return the bot's username.");
    const secret = randomToken(24);
    try {
      await telegramApi(token, "setWebhook", { url: `${base}/api/telegram/webhook`, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true });
      await telegramApi(token, "setMyCommands", {
        commands: [
          { command: "today", description: "What's waiting on me now" },
          { command: "stop", description: "Disconnect from Product SOP" },
        ],
      });
    } catch (e) {
      throw new ActionError(`Couldn't connect the bot: ${(e as Error).message}`);
    }
    await db.settings.update({
      where: { id: 1 },
      data: { telegramBotToken: token, telegramBotUsername: me.username, telegramWebhookSecret: secret, appUrl: base, updatedById: user.id },
    });
    return done(`Bot @${me.username} connected`);
  },
});

export const disconnectTelegramBotAction = defineAction({
  capability: "settings.manage",
  schema: emptySchema,
  run: async (_input, { user }) => {
    const s = await db.settings.findUnique({ where: { id: 1 }, select: { telegramBotToken: true } });
    if (s?.telegramBotToken) await telegramApi(s.telegramBotToken, "deleteWebhook").catch(() => {});
    await db.settings.update({
      where: { id: 1 },
      data: { telegramBotToken: null, telegramBotUsername: null, telegramWebhookSecret: null, updatedById: user.id },
    });
    return done("Telegram bot disconnected");
  },
});
