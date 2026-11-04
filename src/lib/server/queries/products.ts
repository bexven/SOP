import "server-only";
import { overallCampaignStatus } from "@/lib/domain/campaigns";
import { isOpenStatus } from "@/lib/domain/assignment";
import { computeMargin, marginBand } from "@/lib/domain/margin";
import { canSeeProduct, type BrandViewer, type Subject } from "@/lib/domain/permissions";
import { productScope } from "../services/brand-scope";
import { deriveStepper } from "@/lib/domain/stepper";
import { productRef } from "@/lib/format";
import { db } from "../db";
import { getMarginThresholds, laneProgress } from "./product";

/** Every product as a compact row (pipeline cards, products table, palette). */
/** Every product the viewer may see, as a compact row (pipeline, table, dashboard). */
export async function listProducts(viewer: Subject & BrandViewer) {
  const [products, thresholds] = await Promise.all([
    db.product.findMany({
      where: productScope(viewer),
      orderBy: [{ updatedAt: "desc" }],
      include: {
        adCampaigns: { select: { status: true } },
        brand: { select: { id: true, name: true, color: true } },
        batches: { select: { id: true, number: true } },
        createdBy: { select: { id: true, name: true, avatarColor: true, avatarAssetId: true } },
        tasks: {
          select: {
            id: true,
            type: true,
            phase: true,
            status: true,
            batchId: true,
            dueAt: true,
            assignee: { select: { id: true, name: true, avatarColor: true, avatarAssetId: true } },
          },
        },
      },
    }),
    getMarginThresholds(),
  ]);
  const now = Date.now();
  return products.filter((p) => canSeeProduct(viewer, p.stage, p.stageBeforeKill)).map((p) => {
    const margin = computeMargin({
      chinaPriceBdt: p.chinaPriceBdt?.toString() ?? null,
      shippingPerUnitBdt: p.shippingPerUnitBdt?.toString() ?? null,
      sellingPriceBdt: p.sellingPriceBdt?.toString() ?? null,
      courierChargePct: p.courierChargePct.toString(),
    });
    const open = p.tasks.filter((t) => isOpenStatus(t.status) && t.status !== "LOCKED");
    const waiting = open
      .filter((t) => t.type !== "RESEARCH" || p.stage === "RESEARCH")
      .map((t) => ({ id: t.id, type: t.type, status: t.status, dueAt: t.dueAt?.toISOString() ?? null, assignee: t.assignee }));
    const assignees = [...new Map(open.filter((t) => t.assignee).map((t) => [t.assignee!.id, t.assignee!])).values()];
    const dues = open.map((t) => t.dueAt).filter((d): d is Date => Boolean(d));
    const nextDue = dues.length ? new Date(Math.min(...dues.map((d) => d.getTime()))) : null;
    return {
      id: p.id,
      ref: productRef(p.number),
      number: p.number,
      name: p.name,
      brand: p.brand,
      waiting,
      imageUrl: p.imageUrl,
      stage: p.stage,
      priority: p.priority,
      killReason: p.killReason,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      stageEnteredAt: p.stageEnteredAt.toISOString(),
      marginPct: margin?.marginPct ?? null,
      marginBand: margin?.marginPct && thresholds ? marginBand(margin.marginPct, thresholds) : null,
      stepper: deriveStepper({
        stage: p.stage,
        stageBeforeKill: p.stageBeforeKill,
        campaignStatus: overallCampaignStatus(p.adCampaigns.map((c) => c.status)),
        lanes: laneProgress(p.tasks, p.batches),
        ordering: Boolean(p.orderingSince),
      }),
      assignees,
      nextDueAt: nextDue?.toISOString() ?? null,
      // Overdue = work not yet done (to do / needs changes) past its due time — same rule as the dashboard counters.
      overdue: open.some((t) => (t.status === "TODO" || t.status === "REVISION") && t.dueAt !== null && t.dueAt.getTime() < now),
      openTaskCount: open.length,
    };
  });
}

export type ProductRow = Awaited<ReturnType<typeof listProducts>>[number];
