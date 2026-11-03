import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { getRelease } from "@/lib/server/release";

export const dynamic = "force-dynamic";

/** For the deploy scripts and uptime checks: is the app up and can it reach the database? */
export async function GET() {
  const release = await getRelease();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true, release });
  } catch {
    return NextResponse.json({ ok: false, db: false, release }, { status: 503 });
  }
}
