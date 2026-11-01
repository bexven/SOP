import "server-only";
import type { ProductStage, TaskType } from "@/generated/prisma/enums";
import { computeMargin, marginBand, type MarginBand, type MarginResult } from "@/lib/domain/margin";
import { deriveStepper, type Stepper } from "@/lib/domain/stepper";
import { latestBatch } from "@/lib/domain/workflow";
import { productRef } from "@/lib/format";
import { db } from "../db";

const person = { select: { id: true, name: true, avatarColor: true, avatarAssetId: true } } as const;
export type PersonDTO = { id: string; name: string; avatarColor: string; avatarAssetId: string | null };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const str = (d: { toString(): string } | null | undefined) => (d === null || d === undefined ? null : d.toString());

export async function getMarginThresholds() {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  return s
    ? {
        healthyMarginPct: s.healthyMarginPct.toString(),
        thinMarginPct: s.thinMarginPct.toString(),
        usdToBdtRate: s.usdToBdtRate.toString(),
        rmbToBdtRate: s.rmbToBdtRate.toString(),
        courierChargePct: s.courierChargePct.toString(),
      }
    : null;
}

/** Phase 1 progress of the current batch, for the stepper. */
export function phase1Progress(
  tasks: { phase: number; status: string; batchId: string | null }[],
  batches: { id: string; number: number }[],
) {
  const batch = latestBatch({ batches } as never);
  const phase1 = tasks.filter((t) => batch && t.batchId === batch.id && t.phase === 1 && t.status !== "CANCELLED");
  return { approved: phase1.filter((t) => t.status === "APPROVED").length, total: phase1.length };
}

export async function getProductDetail(id: string) {
  const [p, thresholds] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        createdBy: person,
        mediaBuyer: person,
        campaign: true,
        batches: { orderBy: { number: "asc" } },
        transitions: { orderBy: { at: "asc" } },
        tasks: {
          orderBy: [{ createdAt: "asc" }],
          include: {
            assignee: person,
            checklist: { orderBy: { order: "asc" } },
            submissions: {
              orderBy: { version: "desc" },
              include: {
                submittedBy: person,
                decidedBy: person,
                items: {
                  orderBy: { order: "asc" },
                  include: { comments: { orderBy: { createdAt: "asc" }, include: { author: person } } },
                },
              },
            },
          },
        },
      },
    }),
    getMarginThresholds(),
  ]);
  if (!p) return null;

  const people = await db.user.findMany({ select: { id: true, name: true, avatarColor: true, avatarAssetId: true, role: true, active: true } });
  const nameOf = (uid: string | null | undefined) => (uid ? (people.find((u) => u.id === uid)?.name ?? null) : null);

  const [comments, events] = await Promise.all([
    db.comment.findMany({
      where: { productId: id },
      orderBy: { createdAt: "asc" },
      include: { author: person },
    }),
    db.activityEvent.findMany({
      where: { productId: id },
      // Events from one transaction share a timestamp; cuid ids break the tie in insertion order.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 300,
      include: { actor: person, task: { select: { type: true } } },
    }),
  ]);

  const types = [...new Set(p.tasks.map((t) => t.type))];
  const guides = await db.taskTypeConfig.findMany({ where: { taskType: { in: types } } });

  const margin: MarginResult | null = computeMargin({
    chinaPriceRmb: str(p.chinaPriceRmb),
    shippingPerUnitRmb: str(p.shippingPerUnitRmb),
    sellingPriceBdt: str(p.sellingPriceBdt),
    rmbToBdtRate: p.rmbToBdtRate.toString(),
    courierChargePct: p.courierChargePct.toString(),
  });
  const band: MarginBand | null = margin?.marginPct && thresholds ? marginBand(margin.marginPct, thresholds) : null;

  const stepper: Stepper = deriveStepper({
    stage: p.stage,
    stageBeforeKill: p.stageBeforeKill,
    campaignStatus: p.campaign?.status ?? null,
    phase1: phase1Progress(p.tasks, p.batches),
  });

  return {
    id: p.id,
    number: p.number,
    ref: productRef(p.number),
    name: p.name,
    stage: p.stage,
    stageBeforeKill: p.stageBeforeKill,
    stageEnteredAt: p.stageEnteredAt.toISOString(),
    priority: p.priority,
    imageUrl: p.imageUrl,
    supplierUrl: p.supplierUrl,
    chinaPriceRmb: str(p.chinaPriceRmb),
    shippingPerUnitRmb: str(p.shippingPerUnitRmb),
    sellingPriceBdt: str(p.sellingPriceBdt),
    rmbToBdtRate: p.rmbToBdtRate.toString(),
    courierChargePct: p.courierChargePct.toString(),
    targetCustomer: p.targetCustomer,
    problemSolved: p.problemSolved,
    sellingAngle: p.sellingAngle,
    referenceLinks: p.referenceLinks,
    targetLaunchDate: p.targetLaunchDate ? p.targetLaunchDate.toISOString().slice(0, 10) : null,
    creativeBrief: p.creativeBrief,
    creativeBriefUpdatedAt: iso(p.creativeBriefUpdatedAt),
    killReason: p.killReason,
    killNote: p.killNote,
    killedAt: iso(p.killedAt),
    completedAt: iso(p.completedAt),
    createdAt: p.createdAt.toISOString(),
    createdBy: p.createdBy,
    mediaBuyer: p.mediaBuyer,
    campaign: p.campaign
      ? {
          status: p.campaign.status,
          adsManagerUrl: p.campaign.adsManagerUrl,
          metaCampaignId: p.campaign.metaCampaignId,
          dailyBudgetUsd: str(p.campaign.dailyBudgetUsd),
          strategyNotes: p.campaign.strategyNotes,
          launchedAt: iso(p.campaign.launchedAt),
          launchedBy: nameOf(p.campaign.launchedById),
        }
      : null,
    batches: p.batches.map((b) => ({
      id: b.id,
      number: b.number,
      reason: b.reason,
      dueAt: iso(b.dueAt),
      createdAt: b.createdAt.toISOString(),
      requestedBy: nameOf(b.requestedById),
    })),
    transitions: p.transitions.map((t) => ({ toStage: t.toStage, at: t.at.toISOString() })),
    tasks: p.tasks.map((t) => ({
      id: t.id,
      type: t.type,
      role: t.role,
      phase: t.phase,
      status: t.status,
      batchId: t.batchId,
      dependsOnId: t.dependsOnId,
      assignee: t.assignee,
      dueAt: iso(t.dueAt),
      unlockedAt: iso(t.unlockedAt),
      revisionNote: t.revisionNote,
      submittedAt: iso(t.submittedAt),
      approvedAt: iso(t.approvedAt),
      approvedBy: nameOf(t.approvedById),
      followUpOfId: t.followUpOfId,
      requestKind: t.requestKind,
      requestNote: t.requestNote,
      createdAt: t.createdAt.toISOString(),
      checklist: t.checklist.map((c) => ({
        id: c.id,
        label: c.label,
        required: c.required,
        checked: c.checked,
        checkedBy: nameOf(c.checkedById),
        checkedAt: iso(c.checkedAt),
      })),
      submissions: t.submissions.map((s) => ({
        id: s.id,
        version: s.version,
        url: s.url,
        note: s.note,
        submittedBy: s.submittedBy,
        createdAt: s.createdAt.toISOString(),
        decision: s.decision,
        decisionNote: s.decisionNote,
        decidedBy: s.decidedBy,
        decidedAt: iso(s.decidedAt),
        items: s.items.map((it) => ({
          id: it.id,
          kind: it.kind,
          assetId: it.assetId,
          url: it.url,
          label: it.label,
          reaction: it.reaction,
          reactedBy: nameOf(it.reactedById),
          comments: it.comments.map((c) => ({ id: c.id, body: c.body, author: c.author, createdAt: c.createdAt.toISOString() })),
        })),
      })),
    })),
    guides: Object.fromEntries(
      guides.map((g) => [
        g.taskType,
        { body: g.guideBody, links: Array.isArray(g.guideLinks) ? (g.guideLinks as { label: string; url: string }[]) : [] },
      ]),
    ) as Partial<Record<TaskType, { body: string; links: { label: string; url: string }[] }>>,
    comments: comments.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      body: c.body,
      author: c.author,
      createdAt: c.createdAt.toISOString(),
      editedAt: iso(c.editedAt),
    })),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      actor: e.actor,
      taskType: e.task?.type ?? null,
      data: (e.data ?? null) as Record<string, unknown> | null,
      createdAt: e.createdAt.toISOString(),
    })),
    margin,
    marginBand: band,
    thresholds,
    stepper,
    people: people.filter((u) => u.active).map(({ id, name, avatarColor, avatarAssetId, role }) => ({ id, name, avatarColor, avatarAssetId, role })),
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;
export type TaskDTO = ProductDetail["tasks"][number];
export type StageKey = ProductStage;
