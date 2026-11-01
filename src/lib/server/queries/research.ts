import "server-only";
import type { Role } from "@/generated/prisma/enums";
import { computeMargin, marginBand } from "@/lib/domain/margin";
import { productRef } from "@/lib/format";
import { db } from "../db";
import { getMarginThresholds } from "./product";

/** The Research page: drafts in research (yours, or all for Admin) and what you've already submitted. */
export async function getResearchBoard(user: { id: string; role: Role }) {
  const admin = user.role === "ADMIN";
  const [inResearch, submitted, thresholds] = await Promise.all([
    db.product.findMany({
      where: {
        stage: "RESEARCH",
        ...(admin ? {} : { tasks: { some: { type: "RESEARCH", assigneeId: user.id } } }),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        tasks: {
          where: { type: "RESEARCH" },
          include: { checklist: true, assignee: { select: { id: true, name: true, avatarColor: true, avatarAssetId: true } } },
        },
      },
    }),
    db.product.findMany({
      where: { stage: { not: "RESEARCH" }, ...(admin ? {} : { createdById: user.id }) },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, number: true, name: true, stage: true, imageUrl: true, updatedAt: true, killReason: true },
    }),
    getMarginThresholds(),
  ]);

  const drafts = inResearch.map((p) => {
    const task = p.tasks[0];
    const margin = computeMargin({
      chinaPriceRmb: p.chinaPriceRmb?.toString() ?? null,
      shippingPerUnitRmb: p.shippingPerUnitRmb?.toString() ?? null,
      sellingPriceBdt: p.sellingPriceBdt?.toString() ?? null,
      rmbToBdtRate: p.rmbToBdtRate.toString(),
      courierChargePct: p.courierChargePct.toString(),
    });
    const filled = [p.supplierUrl, p.chinaPriceRmb, p.shippingPerUnitRmb, p.sellingPriceBdt].filter((v) => v !== null && v !== "").length + 1;
    return {
      id: p.id,
      ref: productRef(p.number),
      name: p.name,
      imageUrl: p.imageUrl,
      priority: p.priority,
      updatedAt: p.updatedAt.toISOString(),
      sentBack: task?.status === "REVISION",
      revisionNote: task?.revisionNote ?? null,
      dueAt: task?.dueAt?.toISOString() ?? null,
      assignee: task?.assignee ?? null,
      fieldsDone: filled,
      fieldsTotal: 5,
      checklistDone: task?.checklist.filter((c) => c.checked).length ?? 0,
      checklistTotal: task?.checklist.length ?? 0,
      marginPct: margin?.marginPct ?? null,
      marginBand: margin?.marginPct && thresholds ? marginBand(margin.marginPct, thresholds) : null,
    };
  });

  return {
    sentBack: drafts.filter((d) => d.sentBack),
    drafts: drafts.filter((d) => !d.sentBack),
    submitted: submitted.map((p) => ({ ...p, ref: productRef(p.number), updatedAt: p.updatedAt.toISOString() })),
  };
}

export type ResearchDraft = Awaited<ReturnType<typeof getResearchBoard>>["drafts"][number];
