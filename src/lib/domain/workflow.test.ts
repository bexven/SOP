import { describe, expect, it } from "vitest";
import type { TaskType } from "@/generated/prisma/enums";
import {
  CHANGE_TARGET,
  canWorkOnTask,
  planApprove,
  planCampaignStatus,
  planComplete,
  planApproveProduct,
  planKill,
  planLaunch,
  planRejectProduct,
  planWithdraw,
  planNewBatch,
  planRequestRevision,
  planResearchSubmit,
  planSendBack,
  planSubmitTask,
  reassignError,
  researchBlockers,
  sendBackTargets,
  type Plan,
  type PlanResult,
  type ProductSnap,
} from "./workflow";

// ── A tiny in-memory "server" so we can walk a product through the pipeline ──

let seq = 0;
function newProduct(): ProductSnap {
  seq = 0;
  return {
    id: "p1",
    stage: "RESEARCH",
    mediaBuyerId: "mb",
    campaignStatus: null,
    batches: [],
    tasks: [
      {
        id: "research",
        type: "RESEARCH",
        role: "RESEARCHER",
        phase: 1,
        status: "TODO",
        dependsOnId: null,
        batchId: null,
        assigneeId: "r",
      },
    ],
  };
}

function apply(p: ProductSnap, result: PlanResult): ProductSnap {
  if (!result.ok) throw new Error(result.error);
  const plan: Plan = result.plan;
  const next: ProductSnap = structuredClone(p);
  for (const c of plan.changes) {
    const t = next.tasks.find((x) => x.id === c.taskId)!;
    expect(t.status).toBe(c.from); // guarded update
    t.status = CHANGE_TARGET[c.kind];
  }
  let batchId: string | null = null;
  if (plan.newBatch) {
    batchId = `b${plan.newBatch.number}`;
    next.batches.push({ id: batchId, number: plan.newBatch.number });
  }
  const keyToId = new Map<string, string>();
  for (const nt of plan.newTasks) keyToId.set(nt.key, `${nt.key}-${++seq}`);
  for (const nt of plan.newTasks) {
    next.tasks.push({
      id: keyToId.get(nt.key)!,
      type: nt.type,
      role: nt.role,
      phase: nt.phase,
      status: nt.status,
      dependsOnId: nt.dependsOnKey ? keyToId.get(nt.dependsOnKey)! : null,
      batchId: nt.inNewBatch ? batchId : (nt.batchId ?? null),
      assigneeId: nt.assigneeId ?? "auto",
    });
  }
  if (plan.stage) {
    expect(next.stage).toBe(plan.stage.from);
    next.stage = plan.stage.to;
  }
  if (plan.campaign) next.campaignStatus = plan.campaign.to;
  return next;
}

const byType = (p: ProductSnap, type: TaskType, batch?: string) =>
  p.tasks.filter((t) => t.type === type && (batch === undefined || t.batchId === batch)).at(-1)!;

function submitAndApprove(p: ProductSnap, type: TaskType): ProductSnap {
  const t = byType(p, type);
  p = apply(p, planSubmitTask(p, t.id));
  return apply(p, planApprove(p, t.id));
}

/** Research submitted and approved in Product review → Creative with Batch #1. */
function toCreative(): ProductSnap {
  const p = apply(newProduct(), planResearchSubmit(newProduct()));
  return apply(p, planApproveProduct(p));
}

function toReadyToLaunch(): ProductSnap {
  let p = toCreative();
  for (const type of ["WEBSITE_IMAGE", "AD_IMAGE_VERTICAL", "AD_IMAGE_SQUARE", "VIDEO_MAIN", "VIDEO_SQUARE"] as const) {
    p = submitAndApprove(p, type);
  }
  return p;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("research", () => {
  it("lists what blocks submission", () => {
    expect(
      researchBlockers(
        { name: "Lamp", supplierUrl: "", chinaPriceBdt: "10", weightKg: null, shippingMethod: null, sellingPriceBdt: "900" },
        2,
      ),
    ).toEqual(["Supplier link", "Weight (kg)", "Shipping by (Air / Sea)", "2 checklist items"]);
    expect(
      researchBlockers(
        { name: "Lamp", supplierUrl: "https://x", chinaPriceBdt: "10", weightKg: "0.5", shippingMethod: "SEA", sellingPriceBdt: "900" },
        0,
      ),
    ).toEqual([]);
  });

  it("submit goes to Product review with an approval task for the Reviewer", () => {
    const p = apply(newProduct(), planResearchSubmit(newProduct()));
    expect(p.stage).toBe("REVIEW");
    expect(p.batches).toEqual([]);
    expect(byType(p, "PRODUCT_APPROVAL")).toMatchObject({ role: "REVIEWER", status: "TODO" });
    expect(byType(p, "RESEARCH").status).toBe("APPROVED");
  });

  it("not approved closes the product; there is no send-back from review", () => {
    const p = apply(newProduct(), planResearchSubmit(newProduct()));
    const rejected = apply(p, planRejectProduct(p));
    expect(rejected.stage).toBe("KILLED");
    expect(byType(rejected, "PRODUCT_APPROVAL").status).toBe("CANCELLED");
    // Product review is approve / not approved only — no send-back to the researcher.
    expect(sendBackTargets("REVIEW", "REVIEWER")).toEqual([]);
    expect(sendBackTargets("REVIEW", "ADMIN")).toEqual([]);
    expect(planSendBack(p, { target: "RESEARCH", actorRole: "ADMIN", note: "x", reopenTaskIds: [] }).ok).toBe(false);
  });

  it("approval creates Batch #1 (website → portrait ads → square ads; main → square video) and moves to CREATIVE", () => {
    const p = toCreative();
    expect(p.stage).toBe("CREATIVE");
    expect(p.batches).toEqual([{ id: "b1", number: 1 }]);
    const batch = p.tasks.filter((t) => t.batchId === "b1");
    expect(batch.map((t) => [t.type, t.role, t.phase, t.status])).toEqual([
      ["WEBSITE_IMAGE", "IMAGE_DESIGNER", 1, "TODO"],
      ["AD_IMAGE_VERTICAL", "IMAGE_DESIGNER", 2, "LOCKED"],
      ["AD_IMAGE_SQUARE", "IMAGE_DESIGNER", 3, "LOCKED"],
      ["VIDEO_MAIN", "VIDEO_EDITOR", 1, "TODO"],
      ["VIDEO_SQUARE", "VIDEO_EDITOR", 2, "LOCKED"],
    ]);
    expect(byType(p, "AD_IMAGE_VERTICAL").dependsOnId).toBe(byType(p, "WEBSITE_IMAGE").id);
    expect(byType(p, "AD_IMAGE_SQUARE").dependsOnId).toBe(byType(p, "AD_IMAGE_VERTICAL").id);
    expect(byType(p, "VIDEO_SQUARE").dependsOnId).toBe(byType(p, "VIDEO_MAIN").id);
    expect(byType(p, "RESEARCH").status).toBe("APPROVED");
  });

  it("can't submit or approve twice", () => {
    const p = toCreative();
    expect(planResearchSubmit(p).ok).toBe(false);
    expect(planApproveProduct(p).ok).toBe(false);
  });
});

describe("creative phase gating", () => {
  it("each step stays locked until the Senior approves the one before it", () => {
    let p = toCreative();
    const portrait = byType(p, "AD_IMAGE_VERTICAL");
    expect(planSubmitTask(p, portrait.id)).toEqual({ ok: false, error: "This task is still locked." });

    // Main video approval only unlocks the square video
    p = submitAndApprove(p, "VIDEO_MAIN");
    expect(byType(p, "VIDEO_SQUARE").status).toBe("TODO");
    expect(byType(p, "AD_IMAGE_VERTICAL").status).toBe("LOCKED");

    // Website images unlock the portrait ads only; portrait ads unlock the square ads
    p = submitAndApprove(p, "WEBSITE_IMAGE");
    expect(byType(p, "AD_IMAGE_VERTICAL").status).toBe("TODO");
    expect(byType(p, "AD_IMAGE_SQUARE").status).toBe("LOCKED");
    p = submitAndApprove(p, "AD_IMAGE_VERTICAL");
    expect(byType(p, "AD_IMAGE_SQUARE").status).toBe("TODO");
    expect(p.stage).toBe("CREATIVE");
  });

  it("revision requires a note and allows resubmission", () => {
    let p = toCreative();
    const website = byType(p, "WEBSITE_IMAGE");
    p = apply(p, planSubmitTask(p, website.id));
    expect(planRequestRevision(p, website.id, "   ")).toEqual({ ok: false, error: "A revision note is required." });
    p = apply(p, planRequestRevision(p, website.id, "Background too busy"));
    expect(byType(p, "WEBSITE_IMAGE").status).toBe("REVISION");
    expect(planApprove(p, website.id).ok).toBe(false);
    p = apply(p, planSubmitTask(p, website.id));
    expect(byType(p, "WEBSITE_IMAGE").status).toBe("SUBMITTED");
  });

  it("only submitted work can be reviewed", () => {
    const p = toCreative();
    const website = byType(p, "WEBSITE_IMAGE");
    expect(planApprove(p, website.id).ok).toBe(false);
    expect(planRequestRevision(p, website.id, "x").ok).toBe(false);
  });

  it("approving the last task moves to READY_TO_LAUNCH and creates Campaign Launch for the media buyer", () => {
    const p = toReadyToLaunch();
    expect(p.stage).toBe("READY_TO_LAUNCH");
    const launch = byType(p, "CAMPAIGN_LAUNCH");
    expect(launch).toMatchObject({ role: "MEDIA_BUYER", status: "TODO", batchId: null, assigneeId: "mb" });
  });
});

describe("launch & live", () => {
  it("launch moves to LIVE with a RUNNING campaign", () => {
    let p = toReadyToLaunch();
    p = apply(p, planLaunch(p));
    expect(p.stage).toBe("LIVE");
    expect(p.campaignStatus).toBe("RUNNING");
    expect(byType(p, "CAMPAIGN_LAUNCH").status).toBe("APPROVED");
    expect(planLaunch(p).ok).toBe(false);
  });

  it("campaign status changes only while live and must differ", () => {
    let p = toReadyToLaunch();
    expect(planCampaignStatus(p, "PAUSED").ok).toBe(false);
    p = apply(p, planLaunch(p));
    expect(planCampaignStatus(p, "RUNNING").ok).toBe(false);
    expect(planCampaignStatus(p, "SCALING").ok).toBe(false); // not offered any more
    p = apply(p, planCampaignStatus(p, "PAUSED"));
    expect(p.campaignStatus).toBe("PAUSED");
    expect(planCampaignStatus(p, "NOT_LAUNCHED").ok).toBe(false);
  });

  it("a new batch while LIVE creates unlocked tasks and keeps the stage", () => {
    let p = toReadyToLaunch();
    p = apply(p, planLaunch(p));
    const due = new Date("2026-11-10T12:00:00Z");
    expect(planNewBatch(p, { types: ["VIDEO_SQUARE"], dueAt: due, reason: null, name: "  " }).ok).toBe(false);
    const result = planNewBatch(p, { types: ["VIDEO_SQUARE", "AD_IMAGE_SQUARE", "AD_IMAGE_SQUARE"], dueAt: due, reason: "Fatigue", name: "Winter angles" });
    expect(result.ok && result.plan.newBatch?.name).toBe("Winter angles");
    expect(result.ok && result.plan.newTasks.every((t) => t.dueAt === due)).toBe(true);
    p = apply(p, result);
    expect(p.stage).toBe("LIVE");
    expect(p.batches.map((b) => b.number)).toEqual([1, 2]);
    const batch2 = p.tasks.filter((t) => t.batchId === "b2");
    expect(batch2.map((t) => [t.type, t.status, t.dependsOnId])).toEqual([
      ["AD_IMAGE_SQUARE", "TODO", null],
      ["VIDEO_SQUARE", "TODO", null],
    ]);
    // portrait + square together: square waits for portrait
    const both = planNewBatch(p, { types: ["AD_IMAGE_SQUARE", "AD_IMAGE_VERTICAL"], dueAt: null, reason: null });
    expect(both.ok && both.plan.newTasks.map((t) => [t.type, t.status, t.dependsOnKey])).toEqual([
      ["AD_IMAGE_VERTICAL", "TODO", null],
      ["AD_IMAGE_SQUARE", "LOCKED", "AD_IMAGE_VERTICAL"],
    ]);
    // approving batch #2 work never changes the stage
    p = submitAndApprove(p, "AD_IMAGE_SQUARE");
    p = submitAndApprove(p, "VIDEO_SQUARE");
    expect(p.stage).toBe("LIVE");
  });

  it("new batches reject the store listing and empty selections, and need LIVE", () => {
    let p = toReadyToLaunch();
    expect(planNewBatch(p, { types: ["AD_IMAGE_SQUARE"], dueAt: null, reason: null }).ok).toBe(false);
    p = apply(p, planLaunch(p));
    expect(planNewBatch(p, { types: [], dueAt: null, reason: null }).ok).toBe(false);
    expect(planNewBatch(p, { types: ["STORE_LISTING"], dueAt: null, reason: null }).ok).toBe(false);
  });

  it("completing cancels open tasks and stops the campaign", () => {
    let p = toReadyToLaunch();
    p = apply(p, planLaunch(p));
    p = apply(p, planNewBatch(p, { types: ["VIDEO_MAIN"], dueAt: null, reason: null }));
    p = apply(p, planComplete(p));
    expect(p.stage).toBe("COMPLETED");
    expect(p.campaignStatus).toBe("STOPPED");
    expect(byType(p, "VIDEO_MAIN", "b2").status).toBe("CANCELLED");
    expect(byType(p, "VIDEO_MAIN", "b1").status).toBe("APPROVED");
  });
});

describe("kill", () => {
  it("cancels open tasks from any active stage", () => {
    let p = toCreative();
    p = apply(p, planKill(p));
    expect(p.stage).toBe("KILLED");
    expect(p.tasks.filter((t) => t.batchId === "b1").every((t) => t.status === "CANCELLED")).toBe(true);
    expect(byType(p, "RESEARCH").status).toBe("APPROVED");
    expect(planKill(p).ok).toBe(false);
  });

  it("works from research and stops a live campaign", () => {
    expect(apply(newProduct(), planKill(newProduct())).tasks[0]!.status).toBe("CANCELLED");
    const inReview = apply(newProduct(), planResearchSubmit(newProduct()));
    expect(apply(inReview, planKill(inReview)).stage).toBe("KILLED");
    let p = toReadyToLaunch();
    p = apply(p, planLaunch(p));
    p = apply(p, planKill(p));
    expect(p.campaignStatus).toBe("STOPPED");
  });
});

describe("send back", () => {
  it("targets by role and stage (Q4, Q5)", () => {
    expect(sendBackTargets("CREATIVE", "MEDIA_BUYER")).toEqual(["RESEARCH"]);
    expect(sendBackTargets("CREATIVE", "IMAGE_DESIGNER")).toEqual([]);
    expect(sendBackTargets("READY_TO_LAUNCH", "MEDIA_BUYER")).toEqual(["CREATIVE"]);
    expect(sendBackTargets("READY_TO_LAUNCH", "ADMIN")).toEqual(["CREATIVE", "RESEARCH"]);
    expect(sendBackTargets("LIVE", "ADMIN")).toEqual([]);
    expect(sendBackTargets("RESEARCH", "ADMIN")).toEqual([]);
  });

  it("requires a note", () => {
    const p = toCreative();
    expect(planSendBack(p, { target: "RESEARCH", actorRole: "ADMIN", note: " ", reopenTaskIds: [] }).ok).toBe(false);
  });

  it("Creative → Research cancels creative work, reopens research, and resubmit creates Batch #2 (Q2)", () => {
    let p = toCreative();
    p = submitAndApprove(p, "WEBSITE_IMAGE");
    p = apply(p, planSendBack(p, { target: "RESEARCH", actorRole: "MEDIA_BUYER", note: "Supplier changed", reopenTaskIds: [] }));
    expect(p.stage).toBe("RESEARCH");
    expect(byType(p, "RESEARCH").status).toBe("REVISION");
    const b1 = p.tasks.filter((t) => t.batchId === "b1");
    expect(b1.filter((t) => t.status === "APPROVED").map((t) => t.type)).toEqual(["WEBSITE_IMAGE"]);
    expect(b1.filter((t) => t.status !== "APPROVED").every((t) => t.status === "CANCELLED")).toBe(true);

    p = apply(p, planResearchSubmit(p));
    expect(p.stage).toBe("REVIEW");
    p = apply(p, planApproveProduct(p));
    expect(p.stage).toBe("CREATIVE");
    expect(p.batches.map((b) => b.number)).toEqual([1, 2]);
    const b2 = p.tasks.filter((t) => t.batchId === "b2");
    expect(b2).toHaveLength(5);
    expect(b2.filter((t) => t.status === "LOCKED")).toHaveLength(3);
  });

  it("Ready to Launch → Creative reopens chosen tasks and cancels the launch task", () => {
    let p = toReadyToLaunch();
    const landscape = byType(p, "AD_IMAGE_SQUARE");
    expect(planSendBack(p, { target: "CREATIVE", actorRole: "MEDIA_BUYER", note: "x", reopenTaskIds: [] }).ok).toBe(false);
    p = apply(p, planSendBack(p, { target: "CREATIVE", actorRole: "MEDIA_BUYER", note: "Wrong size", reopenTaskIds: [landscape.id] }));
    expect(p.stage).toBe("CREATIVE");
    expect(byType(p, "AD_IMAGE_SQUARE").status).toBe("REVISION");
    expect(byType(p, "CAMPAIGN_LAUNCH").status).toBe("CANCELLED");
    // fixing it brings the product back to READY_TO_LAUNCH with a fresh launch task
    p = apply(p, planSubmitTask(p, landscape.id));
    p = apply(p, planApprove(p, landscape.id));
    expect(p.stage).toBe("READY_TO_LAUNCH");
    expect(p.tasks.filter((t) => t.type === "CAMPAIGN_LAUNCH").map((t) => t.status)).toEqual(["CANCELLED", "TODO"]);
  });

  it("reopening a Phase 1 task together with its dependent relocks the dependent (Q3)", () => {
    let p = toReadyToLaunch();
    const website = byType(p, "WEBSITE_IMAGE");
    const portrait = byType(p, "AD_IMAGE_VERTICAL");
    p = apply(
      p,
      planSendBack(p, { target: "CREATIVE", actorRole: "ADMIN", note: "Rebrand", reopenTaskIds: [website.id, portrait.id] }),
    );
    expect(byType(p, "WEBSITE_IMAGE").status).toBe("REVISION");
    expect(byType(p, "AD_IMAGE_VERTICAL").status).toBe("LOCKED");
    expect(byType(p, "AD_IMAGE_SQUARE").status).toBe("APPROVED"); // approved dependents stay approved
    p = submitAndApprove(p, "WEBSITE_IMAGE");
    expect(byType(p, "AD_IMAGE_VERTICAL").status).toBe("TODO");
  });

  it("only approved tasks of the current batch can be reopened", () => {
    const p = toReadyToLaunch();
    const launch = byType(p, "CAMPAIGN_LAUNCH");
    expect(planSendBack(p, { target: "CREATIVE", actorRole: "ADMIN", note: "x", reopenTaskIds: [launch.id] }).ok).toBe(false);
  });

  it("refuses illegal transitions", () => {
    const p = toReadyToLaunch();
    expect(planSendBack(p, { target: "RESEARCH", actorRole: "MEDIA_BUYER", note: "x", reopenTaskIds: [] }).ok).toBe(false);
  });
});

describe("task permissions", () => {
  const task = { status: "TODO" as const, assigneeId: "t1", role: "IMAGE_DESIGNER" as const };
  const designer2 = { id: "t2", role: "IMAGE_DESIGNER" as const, active: true };

  it("assignee or admin can work on a task", () => {
    expect(canWorkOnTask({ id: "t1", role: "IMAGE_DESIGNER" }, task)).toBe(true);
    expect(canWorkOnTask({ id: "a", role: "ADMIN" }, task)).toBe(true);
    expect(canWorkOnTask({ id: "t2", role: "IMAGE_DESIGNER" }, task)).toBe(false);
  });

  it("assignee can hand off to an active same-role person", () => {
    expect(reassignError({ id: "t1", role: "IMAGE_DESIGNER" }, task, designer2)).toBeNull();
    expect(reassignError({ id: "t1", role: "IMAGE_DESIGNER" }, task, { ...designer2, active: false })).not.toBeNull();
    expect(reassignError({ id: "t1", role: "IMAGE_DESIGNER" }, task, { id: "v", role: "VIDEO_EDITOR", active: true })).not.toBeNull();
    expect(reassignError({ id: "t2", role: "IMAGE_DESIGNER" }, task, { id: "t3", role: "IMAGE_DESIGNER", active: true })).not.toBeNull();
  });

  it("admin can reassign any open task", () => {
    expect(reassignError({ id: "a", role: "ADMIN" }, task, designer2)).toBeNull();
    expect(reassignError({ id: "a", role: "ADMIN" }, { ...task, status: "APPROVED" }, designer2)).not.toBeNull();
  });
});

describe("approve with a follow-up (different angle / size)", () => {
  it("creates a follow-up task for the same person in the same batch and still unlocks Phase 2", () => {
    let p = toCreative();
    const website = byType(p, "WEBSITE_IMAGE");
    p = apply(p, planSubmitTask(p, website.id));
    const r = planApprove(p, website.id, { followUp: { kind: "DIFFERENT_ANGLE", note: "Show it folded" } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.newTasks).toHaveLength(1);
    expect(r.plan.newTasks[0]).toMatchObject({
      type: "WEBSITE_IMAGE",
      status: "TODO",
      batchId: website.batchId,
      assigneeId: website.assigneeId,
      followUp: { ofTaskId: website.id, kind: "DIFFERENT_ANGLE", note: "Show it folded" },
    });
    expect(r.plan.changes.filter((c) => c.kind === "unlock")).toHaveLength(1);
  });

  it("a follow-up on the last task keeps the product in Creative", () => {
    let p = toCreative();
    for (const type of ["WEBSITE_IMAGE", "AD_IMAGE_VERTICAL", "AD_IMAGE_SQUARE", "VIDEO_MAIN"] as const) {
      p = submitAndApprove(p, type);
    }
    const sq = byType(p, "VIDEO_SQUARE");
    p = apply(p, planSubmitTask(p, sq.id));
    const r = planApprove(p, sq.id, { followUp: { kind: "DIFFERENT_SIZE", note: null } });
    expect(r.ok && r.plan.stage).toBeNull();
  });

  it("is only for creative work", () => {
    const p = toReadyToLaunch();
    expect(planApprove(p, byType(p, "CAMPAIGN_LAUNCH").id, { followUp: { kind: "DIFFERENT_ANGLE", note: null } }).ok).toBe(false);
  });
});

describe("withdraw (un-tick ready)", () => {
  it("takes submitted work back to To do before review", () => {
    let p = toCreative();
    const w = byType(p, "WEBSITE_IMAGE");
    expect(planWithdraw(p, w.id).ok).toBe(false);
    p = apply(p, planSubmitTask(p, w.id));
    p = apply(p, planWithdraw(p, w.id));
    expect(byType(p, "WEBSITE_IMAGE").status).toBe("TODO");
  });
});
