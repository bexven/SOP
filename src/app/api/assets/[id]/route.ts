import { getCurrentUser } from "@/lib/server/auth/current-user";
import { db } from "@/lib/server/db";

/**
 * Serves an uploaded image. Creative work requires a signed-in user; profile
 * photos are also shown on the login screen, so those are public.
 * Assets never change, so they cache forever.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/assets/[id]">) {
  const { id } = await ctx.params;
  const asset = await db.asset.findUnique({
    where: { id },
    select: { mime: true, bytes: true, _count: { select: { avatarUsers: true } } },
  });
  if (!asset) return new Response("Not found", { status: 404 });
  if (asset._count.avatarUsers === 0 && !(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  return new Response(Buffer.from(asset.bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
