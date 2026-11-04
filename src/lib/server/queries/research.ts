import "server-only";
import type { Role } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { computeMargin, marginBand } from "@/lib/domain/margin";
import { productRef } from "@/lib/format";
import { db } from "../db";
import { productScope } from "../services/brand-scope";
import type { BrandViewer } from "@/lib/domain/permissions";
import { getMarginThresholds } from "./product";

const person = { select: { id: true, name: true, avatarColor: true, avatarAssetId: true } } satisfies Prisma.UserDefaultArgs;
const brandSel = { select: { id: true, name: true, color: true } } satisfies Prisma.BrandDefaultArgs;
const EARLY = ["RESEARCH", "REVIEW"] as const;

type Priced = {
  chinaPriceBdt: { toString(): string } | null;
  shippingPerUnitBdt: { toString(): string } | null;
  sellingPriceBdt: { toString(): string } | null;
  courierChargePct: { toString(): string };
};

function marginOf(p: Priced, thresholds: Awaited<ReturnType<typeof getMarginThresholds>>) {
  const margin = computeMargin({
    chinaPriceBdt: p.chinaPriceBdt?.toString() ?? null,
    shippingPerUnitBdt: p.shippingPerUnitBdt?.toString() ?? null,
    sellingPriceBdt: p.sellingPriceBdt?.toString() ?? null,
    courierChargePct: p.courierChargePct.toString(),
  });
  return {
    marginPct: margin?.marginPct ?? null,
    marginBand: margin?.marginPct && thresholds ? marginBand(margin.marginPct, thresholds) : null,
  };
}

/**
 * The Research page:
 *  - In research: drafts being filled in (and ones sent back).
 *  - Pending approval: submitted, waiting for the reviewer.
 *  - Approved: passed Product review (now in Creative or later).
 *  - Not approved: killed at research / review.
 * Everyone who can see the page sees every product (Q12); researchers without admin access see only their own drafts.
 */
export async function getResearchBoard(user: { id: string; role: Role; jobRole: Role } & BrandViewer) {
  const scope = productScope(user);
  const admin = user.role !== "RESEARCHER";
  const decided = {
    events: {
      where: { type: { in: ["PRODUCT_APPROVED", "PRODUCT_REJECTED"] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1,
      select: { createdAt: true, data: true, actor: { select: { id: true, name: true } } },
    },
  } satisfies Prisma.ProductInclude;
  const [inResearch, inReview, approved, notApproved, thresholds] = await Promise.all([
    db.product.findMany({
      where: {
        AND: [scope],
        stage: "RESEARCH",
        ...(admin ? {} : { tasks: { some: { type: "RESEARCH", assigneeId: user.id } } }),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        tasks: { where: { type: "RESEARCH" }, include: { checklist: true, assignee: person } },
        brand: brandSel,
      },
    }),
    db.product.findMany({
      where: { AND: [scope], stage: "REVIEW" },
      orderBy: { stageEnteredAt: "asc" },
      include: {
        brand: brandSel,
        createdBy: person,
        tasks: {
          where: { type: "PRODUCT_APPROVAL", status: { in: ["TODO", "REVISION"] } },
          select: { id: true, dueAt: true, assignee: person },
        },
      },
    }),
    db.product.findMany({
      where: {
        AND: [scope],
        stage: { notIn: [...EARLY] },
        NOT: { stage: "KILLED", stageBeforeKill: { in: [...EARLY] } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { brand: brandSel, createdBy: person, ...decided },
    }),
    db.product.findMany({
      where: { AND: [scope], stage: "KILLED", stageBeforeKill: { in: [...EARLY] } },
      orderBy: { killedAt: "desc" },
      take: 100,
      include: { brand: brandSel, createdBy: person, ...decided },
    }),
    getMarginThresholds(),
  ]);

  const drafts = inResearch.map((p) => {
    const task = p.tasks[0];
    const filled = [p.supplierUrl, p.chinaPriceBdt, p.weightKg, p.sellingPriceBdt].filter((v) => v !== null && v !== "").length + 1;
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
      ...marginOf(p, thresholds),
    };
  });

  const decision = (p: { events: { createdAt: Date; data: unknown; actor: { id: string; name: string } | null }[] }) => {
    const e = p.events[0];
    const note = e && e.data && typeof e.data === "object" && "note" in e.data ? String((e.data as { note?: unknown }).note ?? "") : "";
    return { decidedAt: e?.createdAt.toISOString() ?? null, decidedBy: e?.actor?.name ?? null, decisionNote: note || null };
  };

  const base = (p: (typeof approved)[number] | (typeof inReview)[number]) => ({
    id: p.id,
    ref: productRef(p.number),
    name: p.name,
    imageUrl: p.imageUrl,
    brand: p.brand,
    stage: p.stage,
    sellingPriceBdt: p.sellingPriceBdt?.toString() ?? null,
    submittedBy: p.createdBy,
    ...marginOf(p, thresholds),
  });

  return {
    drafts,
    pending: inReview.map((p) => ({
      ...base(p),
      since: p.stageEnteredAt.toISOString(),
      dueAt: p.tasks[0]?.dueAt?.toISOString() ?? null,
      reviewer: p.tasks[0]?.assignee ?? null,
    })),
    approved: approved.map((p) => ({ ...base(p), ...decision(p), at: (decision(p).decidedAt ?? p.stageEnteredAt.toISOString()) })),
    notApproved: notApproved.map((p) => ({
      ...base(p),
      ...decision(p),
      at: (p.killedAt ?? p.updatedAt).toISOString(),
      killNote: p.killNote,
    })),
  };
}

export type ResearchDraft = Awaited<ReturnType<typeof getResearchBoard>>["drafts"][number];
export type ResearchBoard = Awaited<ReturnType<typeof getResearchBoard>>;
