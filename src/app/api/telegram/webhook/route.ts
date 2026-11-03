import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { sendDigestTo, telegramApi } from "@/lib/server/services/alerts";

export const dynamic = "force-dynamic";

type Update = { message?: { chat?: { id?: number; type?: string }; text?: string; from?: { first_name?: string } } };

function sameSecret(a: string | null, b: string | null) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Telegram sends every message people write to the bot here. Telegram signs
 * each call with the secret we gave it when connecting the bot.
 *   /start <code>  link this chat to the person who clicked "Connect Telegram"
 *   /today         send my summary now
 *   /stop          disconnect
 */
export async function POST(request: NextRequest) {
  const settings = await db.settings.findUnique({ where: { id: 1 }, select: { telegramBotToken: true, telegramWebhookSecret: true } });
  if (!settings?.telegramBotToken || !sameSecret(request.headers.get("x-telegram-bot-api-secret-token"), settings.telegramWebhookSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await request.json().catch(() => ({}))) as Update;
  const chatId = update.message?.chat?.id;
  const text = (update.message?.text ?? "").trim();
  if (!chatId || update.message?.chat?.type !== "private") return NextResponse.json({ ok: true });
  const chat = String(chatId);
  const reply = (message: string) =>
    telegramApi(settings.telegramBotToken!, "sendMessage", { chat_id: chatId, text: message, parse_mode: "HTML" }).catch((e) => console.error("[telegram] reply", e));

  const [command, arg] = text.split(/\s+/, 2);
  if (command === "/start" && arg) {
    const user = await db.user.findFirst({ where: { telegramLinkCode: arg, telegramLinkUntil: { gt: new Date() }, active: true } });
    if (!user) {
      await reply("This link has expired. Open <b>My profile</b> in Product SOP and tap <b>Connect Telegram</b> again.");
      return NextResponse.json({ ok: true });
    }
    await db.$transaction([
      // One Telegram account belongs to one person.
      db.user.updateMany({ where: { telegramChatId: chat, id: { not: user.id } }, data: { telegramChatId: null } }),
      db.user.update({ where: { id: user.id }, data: { telegramChatId: chat, telegramLinkCode: null, telegramLinkUntil: null } }),
    ]);
    await reply(
      `✅ Connected, ${user.name}!\n\nYou'll get your alerts here and a summary every morning at 10:00.\n\nCommands:\n/today — what's waiting on me now\n/stop — disconnect`,
    );
    return NextResponse.json({ ok: true });
  }

  const linked = await db.user.findUnique({ where: { telegramChatId: chat } });
  if (command === "/stop") {
    if (linked) await db.user.update({ where: { id: linked.id }, data: { telegramChatId: null } });
    await reply("Disconnected. You can connect again from <b>My profile</b> in Product SOP.");
  } else if (command === "/today" && linked) {
    await sendDigestTo(linked.id);
  } else if (linked) {
    await reply("Commands:\n/today — what's waiting on me now\n/stop — disconnect");
  } else {
    await reply("Hi! To get Product SOP alerts here, open <b>My profile</b> in Product SOP and tap <b>Connect Telegram</b>.");
  }
  return NextResponse.json({ ok: true });
}
