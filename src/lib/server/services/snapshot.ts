import "server-only";
import { overallCampaignStatus } from "@/lib/domain/campaigns";
import type { ProductSnap } from "@/lib/domain/workflow";
import type { Tx } from "../db";
import { ActionError } from "../action";

/** Loads a product as the domain's ProductSnap, plus fields the server needs. */
export async function loadSnapshot(tx: Tx, productId: string) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    include: {
      tasks: { orderBy: { createdAt: "asc" } },
      batches: { select: { id: true, number: true } },
      adCampaigns: { select: { id: true, status: true } },
    },
  });
  if (!product) throw new ActionError("This product no longer exists.");
  const snap: ProductSnap = {
    id: product.id,
    stage: product.stage,
    mediaBuyerId: product.mediaBuyerId,
    campaignStatus: overallCampaignStatus(product.adCampaigns.map((c) => c.status)),
    batches: product.batches,
    tasks: product.tasks.map((t) => ({
      id: t.id,
      type: t.type,
      role: t.role,
      phase: t.phase,
      status: t.status,
      dependsOnId: t.dependsOnId,
      batchId: t.batchId,
      assigneeId: t.assigneeId,
    })),
  };
  return { product, snap };
}
