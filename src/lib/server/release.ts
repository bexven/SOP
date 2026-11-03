import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Which build is running: the Docker image writes a RELEASE file; Vercel gives the commit sha. */
export async function getRelease(): Promise<string | null> {
  const file = await readFile(path.join(process.cwd(), "RELEASE"), "utf8").then((s) => s.trim()).catch(() => null);
  return file || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 10) || null;
}

/** Where this copy runs: the Vercel test site or the live server. */
export function getSiteKind(): "test" | "live" {
  return process.env.VERCEL ? "test" : "live";
}
