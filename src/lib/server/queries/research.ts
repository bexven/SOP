import "server-only";
import type { Role } from "@/generated/prisma/enums";
import { computeMargin, marginBand } from "@/lib/domain/margin";
import { productRef } from "@/lib/format";
import { db } from "../db";
import { getMarginThresholds } from "./product";

/** The Research page: drafts in research (yours, or all for Admin) and what you've already submitted. */
export async function getResearchBoard(user: { id: string; role: Role; jobRole: Role }) {
  // Researchers see their own drafts; Admin, reviewers and media buyers see everyone's.
  const admin = user.role !== "RESEARCHER";
  const [inResearch, submitted, thresholds, inReview] = await Promise.all([
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
        brand: { select: { id: true, name: true, color: true } },
      },
    }),
    db.product.findMany({
      where: { stage: { not: "RESEARCH" }, ...(admin ? {} : { createdById: user.id }) },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, number: true, name: true, stage: true, imageUrl: true, updatedAt: true, killReason: true, brand: { select: { id: true, name: true, color: true } } },
    }),
    getMarginThresholds(),
    db.product.findMany({
      where: { stage: "REVIEW" },
      orderBy: { stageEnteredAt: "asc" },
      select: {
        id: true,
        number: true,
        name: true,
        imageUrl: true,
        stageEnteredAt: true,
        brand: { select: { id: true, name: true, color: true } },
        tasks: {
          where: { type: "PRODUCT_APPROVAL", status: { in: ["TODO", "REVISION"] } },
          select: { id: true, dueAt: true, assignee: { select: { id: true, name: true, avatarColor: true, avatarAssetId: true } } },
        },
      },
    }),
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
      brand: p.brand,
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
    submitted: submitted.filter((p) => p.stage !== "REVIEW").map((p) => ({ ...p, ref: productRef(p.number), updatedAt: p.updatedAt.toISOString() })),
    inReview: inReview.map((p) => ({
      id: p.id,
      ref: productRef(p.number),
      name: p.name,
      imageUrl: p.imageUrl,
      brand: p.brand,
      since: p.stageEnteredAt.toISOString(),
      taskId: p.tasks[0]?.id ?? null,
      dueAt: p.tasks[0]?.dueAt?.toISOString() ?? null,
      reviewer: p.tasks[0]?.assignee ?? null,
    })),
  };
}

export type ResearchDraft = Awaited<ReturnType<typeof getResearchBoard>>["drafts"][number];
