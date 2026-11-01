import "server-only";
import type { Role } from "@/generated/prisma/enums";
import { IMAGE_LANE, VIDEO_LANE } from "@/lib/domain/labels";
import { productRef } from "@/lib/format";
import { db } from "../db";

/** Open creative work, split into the image and video lanes. */
export async function getCreativeBoard(user: { id: string; role: Role; jobRole: Role }, scope: "mine" | "all") {
  const lanes: ("images" | "videos")[] =
    user.jobRole === "IMAGE_DESIGNER" ? ["images"] : user.jobRole === "VIDEO_EDITOR" ? ["videos"] : ["images", "videos"];
  const types = [...(lanes.includes("images") ? IMAGE_LANE : []), ...(lanes.includes("videos") ? VIDEO_LANE : [])];
  const tasks = await db.task.findMany({
    where: {
      type: { in: types },
      status: { in: ["TODO", "REVISION", "SUBMITTED", "LOCKED"] },
      ...(scope === "mine" ? { assigneeId: user.id } : {}),
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    include: {
      product: { select: { id: true, number: true, name: true, imageUrl: true, priority: true } },
      assignee: { select: { id: true, name: true, avatarColor: true, avatarAssetId: true } },
    },
  });
  const rows = tasks.map((t) => ({
    id: t.id,
    type: t.type,
    status: t.status,
    requestKind: t.requestKind,
    dueAt: t.dueAt?.toISOString() ?? null,
    revisionNote: t.revisionNote,
    assignee: t.assignee,
    product: { id: t.product.id, ref: productRef(t.product.number), name: t.product.name, imageUrl: t.product.imageUrl, priority: t.product.priority },
    lane: (IMAGE_LANE as readonly string[]).includes(t.type) ? ("images" as const) : ("videos" as const),
  }));
  return { lanes, rows };
}

export type CreativeRow = Awaited<ReturnType<typeof getCreativeBoard>>["rows"][number];
