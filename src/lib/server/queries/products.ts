import "server-only";
import { isOpenStatus } from "@/lib/domain/assignment";
import { computeMargin, marginBand } from "@/lib/domain/margin";
import { deriveStepper } from "@/lib/domain/stepper";
import { productRef } from "@/lib/format";
import { db } from "../db";
import { getMarginThresholds, phase1Progress } from "./product";

/** Every product as a compact row (pipeline cards, products table, palette). */
export async function listProducts() {
  const [products, thresholds] = await Promise.all([
    db.product.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: {
        campaign: { select: { status: true } },
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
  return products.map((p) => {
    const margin = computeMargin({
      chinaPriceRmb: p.chinaPriceRmb?.toString() ?? null,
      shippingPerUnitRmb: p.shippingPerUnitRmb?.toString() ?? null,
      sellingPriceBdt: p.sellingPriceBdt?.toString() ?? null,
      rmbToBdtRate: p.rmbToBdtRate.toString(),
      courierChargePct: p.courierChargePct.toString(),
    });
    const open = p.tasks.filter((t) => isOpenStatus(t.status) && t.status !== "LOCKED");
    const assignees = [...new Map(open.filter((t) => t.assignee).map((t) => [t.assignee!.id, t.assignee!])).values()];
    const dues = open.map((t) => t.dueAt).filter((d): d is Date => Boolean(d));
    const nextDue = dues.length ? new Date(Math.min(...dues.map((d) => d.getTime()))) : null;
    return {
      id: p.id,
      ref: productRef(p.number),
      number: p.number,
      name: p.name,
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
        campaignStatus: p.campaign?.status ?? null,
        phase1: phase1Progress(p.tasks, p.batches),
      }),
      assignees,
      nextDueAt: nextDue?.toISOString() ?? null,
      overdue: nextDue ? nextDue.getTime() < now : false,
      openTaskCount: open.length,
    };
  });
}

export type ProductRow = Awaited<ReturnType<typeof listProducts>>[number];
