import "server-only";
import { cookies } from "next/headers";
import { env } from "../env";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session-token";

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token, env().SESSION_SECRET);
}

export async function writeSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload, env().SESSION_SECRET);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
