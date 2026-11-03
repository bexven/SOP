import "server-only";
import { randomBytes } from "node:crypto";
import webpush from "web-push";
import { dueBucket } from "@/lib/domain/due";
import { buildDigest, dhakaDate, digestDue, type Digest, type DigestCounts } from "@/lib/domain/digest";
import { normalizePermissions } from "@/lib/domain/permissions";
import { db } from "../db";
import { reviewWhere } from "../queries/queue";

/**
 * Alerts outside the app: browser / phone push (Web Push, free) and Telegram
 * (bot, free). Both are best-effort: a failure never breaks the action that
 * caused it. Keys and the bot token live in Settings, so there is nothing to
 * configure in the hosting environment.
 */

export type Alert = { title: string; body: string; url: string; tag?: string };

// ── Settings helpers ─────────────────────────────────────────────────────────

/** Web push keys; created once, on first use, and kept in Settings. */
export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const s = await db.settings.findUnique({ where: { id: 1 }, select: { vapidPublicKey: true, vapidPrivateKey: true } });
  if (s?.vapidPublicKey && s.vapidPrivateKey) return { publicKey: s.vapidPublicKey, privateKey: s.vapidPrivateKey };
  const keys = webpush.generateVAPIDKeys();
  // Only the first writer wins, so two servers starting together agree on one key pair.
  await db.settings.updateMany({ where: { id: 1, vapidPublicKey: null }, data: { vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey } });
  const saved = await db.settings.findUnique({ where: { id: 1 }, select: { vapidPublicKey: true, vapidPrivateKey: true } });
  if (!saved?.vapidPublicKey || !saved.vapidPrivateKey) throw new Error("Settings are missing — run the seed first.");
  return { publicKey: saved.vapidPublicKey, privateKey: saved.vapidPrivateKey };
}

export function randomToken(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

async function telegramConfig() {
  return db.settings.findUnique({ where: { id: 1 }, select: { telegramBotToken: true, telegramBotUsername: true, appUrl: true } });
}

/** Absolute link for messages that leave the app (Telegram needs full URLs). */
export function absoluteUrl(appUrl: string | null | undefined, path: string): string | null {
  const base = appUrl ?? process.env.APP_URL ?? null;
  return base ? new URL(path, base).toString() : null;
}

// ── Senders ──────────────────────────────────────────────────────────────────

/** Calls a Telegram Bot API method. Returns the result, or throws with Telegram's description. */
export async function telegramApi<T = unknown>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!json?.ok) throw new Error(json?.description ?? `Telegram error ${res.status}`);
  return json.result as T;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendTelegram(chatId: string, alert: Alert): Promise<boolean> {
  const cfg = await telegramConfig();
  if (!cfg?.telegramBotToken) return false;
  const link = absoluteUrl(cfg.appUrl, alert.url);
  try {
    await telegramApi(cfg.telegramBotToken, "sendMessage", {
      chat_id: chatId,
      text: `<b>${esc(alert.title)}</b>\n${esc(alert.body)}`,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(link && link.startsWith("https://") ? { reply_markup: { inline_keyboard: [[{ text: "Open in Product SOP", url: link }]] } } : {}),
    });
    return true;
  } catch (e) {
    console.error("[alerts] telegram", e);
    return false;
  }
}

/** Sends to every device of this person; forgets devices the browser says are gone. */
export async function sendPush(userId: string, alert: Alert): Promise<number> {
  const devices = await db.pushDevice.findMany({ where: { userId } });
  if (devices.length === 0) return 0;
  const { publicKey, privateKey } = await vapidKeys();
  // Apple requires a contact: the app's own https address (or VAPID_SUBJECT, e.g. "mailto:you@company.com").
  const appUrl = (await db.settings.findUnique({ where: { id: 1 }, select: { appUrl: true } }))?.appUrl;
  const subject = process.env.VAPID_SUBJECT ?? (appUrl?.startsWith("https://") ? appUrl : "mailto:admin@example.com");
  let sent = 0;
  await Promise.all(
    devices.map(async (d) => {
      try {
        await webpush.sendNotification(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
          JSON.stringify(alert),
          { vapidDetails: { subject, publicKey, privateKey }, TTL: 60 * 60 * 12, timeout: 8000 },
        );
        sent++;
        await db.pushDevice.update({ where: { id: d.id }, data: { lastUsedAt: new Date() } });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.pushDevice.delete({ where: { id: d.id } }).catch(() => {});
        else console.error("[alerts] push", code ?? e);
      }
    }),
  );
  return sent;
}

/** Push + Telegram for one person. */
export async function alertPerson(user: { id: string; telegramChatId: string | null }, alert: Alert) {
  const [push, telegram] = await Promise.all([sendPush(user.id, alert), user.telegramChatId ? sendTelegram(user.telegramChatId, alert) : false]);
  return { push, telegram };
}

// ── Instant alerts (outbox) ──────────────────────────────────────────────────

/**
 * Sends new in-app notifications to phones / Telegram. Called after every
 * action (once its transaction committed). Each notification is claimed with a
 * guarded update, so it goes out once even if two flushes overlap.
 */
export async function flushAlerts() {
  const since = new Date(Date.now() - 30 * 60_000);
  const pending = await db.notification.findMany({
    where: { pushedAt: null, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { user: { select: { id: true, active: true, alertsInstant: true, telegramChatId: true } } },
  });
  for (const n of pending) {
    const claimed = await db.notification.updateMany({ where: { id: n.id, pushedAt: null }, data: { pushedAt: new Date() } });
    if (claimed.count !== 1 || !n.user.active || !n.user.alertsInstant) continue;
    const url = n.productId ? `/products/${n.productId}${n.taskId ? `?task=${n.taskId}` : ""}` : "/dashboard";
    await alertPerson(n.user, { title: "Product SOP", body: n.message, url, tag: n.id });
  }
}

// ── Morning summary ──────────────────────────────────────────────────────────

/** What's waiting on one person right now. */
export async function digestFor(user: { id: string; name: string; role: string; adminAccess: boolean; isMaster: boolean; permissions: string[] }, now = new Date()): Promise<Digest | null> {
  const subject = {
    id: user.id,
    role: (user.role === "ADMIN" || user.adminAccess || user.isMaster ? "ADMIN" : user.role) as "ADMIN",
    jobRole: user.role as "ADMIN",
    permissions: normalizePermissions(user.permissions),
  };
  const running = { stage: { notIn: ["COMPLETED", "KILLED"] as ("COMPLETED" | "KILLED")[] } };
  const [mine, review, mentions] = await Promise.all([
    db.task.findMany({ where: { assigneeId: user.id, status: { in: ["TODO", "REVISION"] }, product: running }, select: { type: true, status: true, dueAt: true } }),
    (async () => {
      const where = reviewWhere(subject);
      return where ? db.task.count({ where }) : 0;
    })(),
    db.notification.count({ where: { userId: user.id, type: "MENTIONED", readAt: null, createdAt: { gte: new Date(now.getTime() - 24 * 3_600_000) } } }),
  ]);
  const approvals = mine.filter((t) => t.type === "PRODUCT_APPROVAL").length;
  const work = mine.filter((t) => t.type !== "PRODUCT_APPROVAL");
  const counts: DigestCounts = {
    todo: work.filter((t) => t.status === "TODO").length,
    revision: work.filter((t) => t.status === "REVISION").length,
    overdue: mine.filter((t) => dueBucket(t.dueAt, now) === "overdue").length,
    dueToday: mine.filter((t) => dueBucket(t.dueAt, now) === "today").length,
    review,
    approvals,
    mentions,
  };
  return buildDigest(user.name, counts);
}

const PERSON = { id: true, name: true, role: true, adminAccess: true, isMaster: true, permissions: true, telegramChatId: true } as const;

export function digestAlert(d: Digest): Alert {
  return { title: d.title, body: d.lines.join("\n"), url: "/dashboard", tag: "morning-summary" };
}

/**
 * Sends the morning summary to everyone who has something waiting (and wants it).
 * Runs at most once per Dhaka day, from 10:00 — safe to call repeatedly.
 */
export async function runMorningDigest(now = new Date()) {
  const settings = await db.settings.findUnique({ where: { id: 1 }, select: { lastDigestOn: true } });
  if (!settings || !digestDue(now, settings.lastDigestOn)) return { sent: 0, skipped: "not due" as const };
  const today = dhakaDate(now);
  const claimed = await db.settings.updateMany({
    where: { id: 1, OR: [{ lastDigestOn: null }, { lastDigestOn: { not: today } }] },
    data: { lastDigestOn: today },
  });
  if (claimed.count !== 1) return { sent: 0, skipped: "already sent" as const };

  const people = await db.user.findMany({ where: { active: true, alertsDigest: true }, select: PERSON });
  let sent = 0;
  for (const p of people) {
    const d = await digestFor(p, now);
    if (!d) continue;
    const r = await alertPerson(p, digestAlert(d));
    if (r.push || r.telegram) sent++;
  }
  return { sent, people: people.length };
}

/** One person's summary right now (test button, Telegram /today). */
export async function sendDigestTo(userId: string) {
  const p = await db.user.findUnique({ where: { id: userId }, select: PERSON });
  if (!p) return { digest: null, push: 0, telegram: false };
  const d = await digestFor(p);
  const alert = d ? digestAlert(d) : { title: `Good morning, ${p.name.split(" ")[0]}`, body: "Nothing is waiting on you right now. 🎉", url: "/dashboard" };
  const r = await alertPerson(p, alert);
  return { digest: d, ...r };
}

/** Keeps the app's public address for links in Telegram (taken from the browser's request). */
export async function rememberAppUrl(host: string | null, proto: string | null) {
  if (!host || host.startsWith("localhost") || host.startsWith("127.")) return;
  const url = `${proto === "http" ? "http" : "https"}://${host}`;
  await db.settings.updateMany({ where: { id: 1, OR: [{ appUrl: null }, { appUrl: { not: url } }] }, data: { appUrl: url } });
}
