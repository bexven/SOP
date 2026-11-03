import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** For the deploy scripts and uptime checks: is the app up and can it reach the database? */
export async function GET() {
  const release = await readFile(path.join(process.cwd(), "RELEASE"), "utf8").then((s) => s.trim()).catch(() => null);
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true, release });
  } catch {
    return NextResponse.json({ ok: false, db: false, release }, { status: 503 });
  }
}
