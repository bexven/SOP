import { NextResponse, type NextRequest } from "next/server";
import { runDueReminders, runMorningDigest } from "@/lib/server/services/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Due reminders (every call) and the 10:00 (Dhaka) morning summary. Called by a scheduler: Vercel Cron
 * (vercel.json) or, on a VPS, a system cron job. Safe to call often — it only
 * sends once per day and never before 10:00. If CRON_SECRET is set, the call
 * must carry "Authorization: Bearer <CRON_SECRET>" (Vercel adds it itself).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  // Due reminders go out on every call; the summary only once a day from 10:00.
  const reminders = await runDueReminders().catch((e) => {
    console.error("[alerts] reminders", e);
    return { reminders: 0 };
  });
  const result = await runMorningDigest();
  return NextResponse.json({ ok: true, ...reminders, ...result });
}
