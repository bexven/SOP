import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth/session-token";

/**
 * First line of defence: only checks that a validly-signed session cookie is
 * present. The authoritative check (user active, sessionVersion, role) runs on
 * the server in every page loader and server action.
 */
// /api/assets checks access itself (profile photos are public for the login screen).
// /api/telegram (signed by Telegram) and /api/cron (scheduler; optional CRON_SECRET) check their own callers.
// The service worker and the app manifest must load without a session.
const PUBLIC_PATHS = ["/login", "/api/assets", "/api/telegram", "/api/cron", "/api/health", "/sw.js", "/manifest.webmanifest", "/icons"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // "/" is the public front page (it only shows a Log in button).
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const secret = process.env.SESSION_SECRET;
  const session = secret ? await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;

  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
