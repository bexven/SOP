import { jwtVerify, SignJWT } from "jose";

/**
 * Session token (JWT, HS256). Edge-safe: used by both proxy.ts (signature
 * check only) and the server (full check incl. sessionVersion in the DB).
 */

export const SESSION_COOKIE = "sop_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = { userId: string; version: number };

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  return new SignJWT({ v: payload.version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key(secret));
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.v !== "number") return null;
    return { userId: payload.sub, version: payload.v };
  } catch {
    return null;
  }
}
