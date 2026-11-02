import type { CampaignStatus, FollowUpKind, ProductStage, Role, TaskStatus, TaskType } from "@/generated/prisma/enums";
import { isOpenStatus } from "./assignment";
import { CAMPAIGN_STATUSES, CREATIVE_TYPES, isReviewedType, TASK_TYPE_ROLE } from "./labels";

/**
 * The pipeline workflow (pure).
 *
 * Every workflow step takes a snapshot of a product and returns a Plan: the
 * task status changes, new batch/tasks, stage change and campaign change it
 * implies — or an error explaining why the step isn't allowed. The server
 * applies a plan inside one transaction (with guarded updates), then writes
 * events and notifications. Nothing here touches the database.
 */

// ── Snapshot ────────────────────────────────────────────────────────────────

export type TaskSnap = {
  id: string;
  type: TaskType;
  role: Role;
  phase: number;
  status: TaskStatus;
  dependsOnId: string | null;
  batchId: string | null;
  assigneeId: string | null;
};

export type BatchSnap = { id: string; number: number };

export type ProductSnap = {
  id: string;
  stage: ProductStage;
  mediaBuyerId: string | null;
  /** Null when no campaign row exists yet. */
  campaignStatus: CampaignStatus | null;
  tasks: TaskSnap[];
  batches: BatchSnap[];
};

// ── Plan ────────────────────────────────────────────────────────────────────

export type TaskChange =
  | { kind: "unlock"; taskId: string; from: TaskStatus }
  | { kind: "submit"; taskId: string; from: TaskStatus }
  | { kind: "approve"; taskId: string; from: TaskStatus }
  | { kind: "revision"; taskId: string; from: TaskStatus; note: string }
  /** Research / campaign launch finished (no reviewer). */
  | { kind: "complete"; taskId: string; from: TaskStatus }
  | { kind: "cancel"; taskId: string; from: TaskStatus }
  | { kind: "relock"; taskId: string; from: TaskStatus; note?: string }
  /** Send-back: an approved/finished task goes back to REVISION with a note. */
  | { kind: "reopen"; taskId: string; from: TaskStatus; note: string }
  /** The maker un-ticks "ready" before anyone reviewed it. */
  | { kind: "withdraw"; taskId: string; from: TaskStatus };

export const CHANGE_TARGET: Record<TaskChange["kind"], TaskStatus> = {
  unlock: "TODO",
  submit: "SUBMITTED",
  approve: "APPROVED",
  revision: "REVISION",
  complete: "APPROVED",
  cancel: "CANCELLED",
  relock: "LOCKED",
  reopen: "REVISION",
  withdraw: "TODO",
};

export type NewTask = {
  /** Local key so other new tasks can depend on it. */
  key: string;
  type: TaskType;
  role: Role;
  phase: number;
  status: "TODO" | "LOCKED";
  dependsOnKey: string | null;
  /** True: belongs to the plan's newBatch. False: no batch (e.g. campaign launch) unless `batchId` is set. */
  inNewBatch: boolean;
  /** An existing batch to join (follow-ups). */
  batchId?: string | null;
  /** Follow-up of an approved task (different angle / size). */
  followUp?: { ofTaskId: string; kind: FollowUpKind; note: string | null };
  /** Explicit assignee (e.g. the product's media buyer); undefined = auto-assign by role. */
  assigneeId?: string | null;
  /** Explicit due date (Batch #N); undefined = SLA from unlock time. */
  dueAt?: Date | null;
};

export type Plan = {
  changes: TaskChange[];
  newBatch: { number: number; name?: string | null; reason: string | null; dueAt: Date | null } | null;
  newTasks: NewTask[];
  stage: { from: ProductStage; to: ProductStage } | null;
  campaign: { from: CampaignStatus | null; to: CampaignStatus } | null;
};

export type PlanResult = { ok: true; plan: Plan } | { ok: false; error: string };

function emptyPlan(): Plan {
  return { changes: [], newBatch: null, newTasks: [], stage: null, campaign: null };
}

const fail = (error: string): PlanResult => ({ ok: false, error });
const ok = (plan: Plan): PlanResult => ({ ok: true, plan });

// ── Helpers ─────────────────────────────────────────────────────────────────

function findTask(p: ProductSnap, taskId: string): TaskSnap | undefined {
  return p.tasks.find((t) => t.id === taskId);
}

export function latestBatch(p: ProductSnap): BatchSnap | null {
  return p.batches.reduce<BatchSnap | null>((best, b) => (!best || b.number > best.number ? b : best), null);
}

export function nextBatchNumber(p: ProductSnap): number {
  return (latestBatch(p)?.number ?? 0) + 1;
}

/** The research task currently relevant (latest by position in the list is fine: there is only ever one). */
export function researchTask(p: ProductSnap): TaskSnap | undefined {
  return p.tasks.find((t) => t.type === "RESEARCH");
}

function statusAfter(p: ProductSnap, changes: TaskChange[]): Map<string, TaskStatus> {
  const map = new Map(p.tasks.map((t) => [t.id, t.status]));
  for (const c of changes) map.set(c.taskId, CHANGE_TARGET[c.kind]);
  return map;
}

function cancelOpen(p: ProductSnap, keep: (t: TaskSnap) => boolean = () => false): TaskChange[] {
  return p.tasks
    .filter((t) => isOpenStatus(t.status) && !keep(t))
    .map((t) => ({ kind: "cancel" as const, taskId: t.id, from: t.status }));
}

const TERMINAL: ProductStage[] = ["COMPLETED", "KILLED"];

export function isTerminalStage(stage: ProductStage): boolean {
  return TERMINAL.includes(stage);
}

// ── Blueprints ──────────────────────────────────────────────────────────────

/** Batch #1 (created when the product is approved for testing): each step gates the next. */
export function firstBatchBlueprint(): NewTask[] {
  const t = (
    key: string,
    type: TaskType,
    phase: number,
    dependsOnKey: string | null,
  ): NewTask => ({
    key,
    type,
    role: TASK_TYPE_ROLE[type],
    phase,
    status: dependsOnKey ? "LOCKED" : "TODO",
    dependsOnKey,
    inNewBatch: true,
  });
  // Images: website product images → Meta ads portrait → Meta ads square (each unlocks after the Senior approves the previous one).
  // Videos: main video → square video.
  return [
    t("website", "WEBSITE_IMAGE", 1, null),
    t("adPortrait", "AD_IMAGE_VERTICAL", 2, "website"),
    t("adSquare", "AD_IMAGE_SQUARE", 3, "adPortrait"),
    t("videoMain", "VIDEO_MAIN", 1, null),
    t("videoSquare", "VIDEO_SQUARE", 2, "videoMain"),
  ];
}

// ── Research ────────────────────────────────────────────────────────────────

export type ResearchFields = {
  brandId?: string | null;
  name: string | null;
  supplierUrl: string | null;
  chinaPriceBdt: string | null;
  shippingPerUnitBdt: string | null;
  sellingPriceBdt: string | null;
};

const RESEARCH_REQUIRED: { key: keyof ResearchFields; label: string }[] = [
  { key: "name", label: "Product name" },
  { key: "supplierUrl", label: "Supplier link" },
  { key: "chinaPriceBdt", label: "China unit price" },
  { key: "shippingPerUnitBdt", label: "Shipping per unit" },
  { key: "sellingPriceBdt", label: "Selling price" },
];

/** What still blocks research submission (empty = ready). */
export function researchBlockers(fields: ResearchFields, checklistMissing: number): string[] {
  const missing = RESEARCH_REQUIRED.filter(({ key }) => !fields[key] || !String(fields[key]).trim()).map(
    (f) => f.label,
  );
  if ("brandId" in fields && !fields.brandId) missing.unshift("Brand");
  if (checklistMissing > 0) {
    missing.push(`${checklistMissing} checklist item${checklistMissing === 1 ? "" : "s"}`);
  }
  return missing;
}

/** Research submitted → Product review: a Reviewer decides whether it goes to testing. */
export function planResearchSubmit(p: ProductSnap): PlanResult {
  if (p.stage !== "RESEARCH") return fail("This product has already left Research.");
  const research = researchTask(p);
  if (!research || !(research.status === "TODO" || research.status === "REVISION")) {
    return fail("There is no open research task to submit.");
  }
  const plan = emptyPlan();
  plan.changes.push({ kind: "complete", taskId: research.id, from: research.status });
  plan.newTasks = [
    { key: "approval", type: "PRODUCT_APPROVAL", role: "REVIEWER", phase: 1, status: "TODO", dependsOnKey: null, inNewBatch: false },
  ];
  plan.stage = { from: "RESEARCH", to: "REVIEW" };
  return ok(plan);
}

function openApproval(p: ProductSnap): TaskSnap | undefined {
  return p.tasks.find((t) => t.type === "PRODUCT_APPROVAL" && isOpenStatus(t.status));
}

/** Reviewer approves for testing → Creative, with a fresh Phase-gated batch. */
export function planApproveProduct(p: ProductSnap): PlanResult {
  if (p.stage !== "REVIEW") return fail("This product isn't waiting for review.");
  const plan = emptyPlan();
  const approval = openApproval(p);
  if (approval) plan.changes.push({ kind: "complete", taskId: approval.id, from: approval.status });
  plan.newBatch = { number: nextBatchNumber(p), reason: null, dueAt: null };
  plan.newTasks = firstBatchBlueprint();
  plan.stage = { from: "REVIEW", to: "CREATIVE" };
  return ok(plan);
}

/** Reviewer says no: the product is closed (Killed, reason "Not approved"). */
export function planRejectProduct(p: ProductSnap): PlanResult {
  if (p.stage !== "REVIEW") return fail("This product isn't waiting for review.");
  const plan = emptyPlan();
  plan.changes = cancelOpen(p);
  plan.stage = { from: "REVIEW", to: "KILLED" };
  return ok(plan);
}

/** The maker un-ticks "ready" before it was reviewed. */
export function planWithdraw(p: ProductSnap, taskId: string): PlanResult {
  const task = findTask(p, taskId);
  if (!task) return fail("Task not found.");
  if (task.status !== "SUBMITTED") return fail("Only work waiting for review can be taken back.");
  const plan = emptyPlan();
  plan.changes.push({ kind: "withdraw", taskId, from: "SUBMITTED" });
  return ok(plan);
}

// ── Creative tasks ──────────────────────────────────────────────────────────

/** Assignee submits a link for review. Checklist completeness is checked by the caller. */
export function planSubmitTask(p: ProductSnap, taskId: string): PlanResult {
  const task = findTask(p, taskId);
  if (!task) return fail("Task not found.");
  if (!isReviewedType(task.type)) return fail("This task isn't submitted for review.");
  if (!(p.stage === "CREATIVE" || p.stage === "LIVE")) return fail("Creative work can't be submitted at this stage.");
  if (task.status === "LOCKED") return fail("This task is still locked.");
  if (task.status === "SUBMITTED") return fail("This task is already waiting for review.");
  if (!(task.status === "TODO" || task.status === "REVISION")) return fail("This task is closed.");
  const plan = emptyPlan();
  plan.changes.push({ kind: "submit", taskId, from: task.status });
  return ok(plan);
}

/**
 * Approve: unlocks dependent tasks; if this completes the current batch while
 * in CREATIVE, the product moves to READY_TO_LAUNCH and a Campaign Launch task
 * is created for the media buyer.
 */
export function planApprove(
  p: ProductSnap,
  taskId: string,
  opts: { followUp?: { kind: FollowUpKind; note: string | null } } = {},
): PlanResult {
  const task = findTask(p, taskId);
  if (!task) return fail("Task not found.");
  if (task.status !== "SUBMITTED") return fail("Only submitted work can be approved.");
  if (opts.followUp && !isReviewedType(task.type)) return fail("Follow-ups are only for creative work.");
  const plan = emptyPlan();
  plan.changes.push({ kind: "approve", taskId, from: "SUBMITTED" });
  for (const dep of p.tasks.filter((t) => t.dependsOnId === taskId && t.status === "LOCKED")) {
    plan.changes.push({ kind: "unlock", taskId: dep.id, from: "LOCKED" });
  }

  // "Approve, and also ask for a different angle / size": a new task for the
  // same person in the same batch. It keeps the batch open (no stage move yet).
  if (opts.followUp) {
    plan.newTasks.push({
      key: "followUp",
      type: task.type,
      role: task.role,
      phase: task.phase,
      status: "TODO",
      dependsOnKey: null,
      inNewBatch: false,
      batchId: task.batchId,
      assigneeId: task.assigneeId ?? undefined,
      followUp: { ofTaskId: task.id, kind: opts.followUp.kind, note: opts.followUp.note?.trim() || null },
    });
    return ok(plan);
  }

  const batch = latestBatch(p);
  if (p.stage === "CREATIVE" && batch && task.batchId === batch.id) {
    const after = statusAfter(p, plan.changes);
    const batchTasks = p.tasks.filter((t) => t.batchId === batch.id && after.get(t.id) !== "CANCELLED");
    if (batchTasks.length > 0 && batchTasks.every((t) => after.get(t.id) === "APPROVED")) {
      plan.stage = { from: "CREATIVE", to: "READY_TO_LAUNCH" };
      plan.newTasks.push({
        key: "launch",
        type: "CAMPAIGN_LAUNCH",
        role: "MEDIA_BUYER",
        phase: 1,
        status: "TODO",
        dependsOnKey: null,
        inNewBatch: false,
        assigneeId: p.mediaBuyerId ?? undefined,
      });
    }
  }
  return ok(plan);
}

export function planRequestRevision(p: ProductSnap, taskId: string, note: string): PlanResult {
  const task = findTask(p, taskId);
  if (!task) return fail("Task not found.");
  if (task.status !== "SUBMITTED") return fail("Only submitted work can be sent for revision.");
  if (!note.trim()) return fail("A revision note is required.");
  const plan = emptyPlan();
  plan.changes.push({ kind: "revision", taskId, from: "SUBMITTED", note: note.trim() });
  return ok(plan);
}

// ── Launch & live ───────────────────────────────────────────────────────────

export function planLaunch(p: ProductSnap): PlanResult {
  if (p.stage !== "READY_TO_LAUNCH") return fail("The product isn't ready to launch.");
  const launch = p.tasks.find((t) => t.type === "CAMPAIGN_LAUNCH" && (t.status === "TODO" || t.status === "REVISION"));
  if (!launch) return fail("There is no open Campaign Launch task.");
  const plan = emptyPlan();
  plan.changes.push({ kind: "complete", taskId: launch.id, from: launch.status });
  plan.stage = { from: "READY_TO_LAUNCH", to: "LIVE" };
  plan.campaign = { from: p.campaignStatus, to: "RUNNING" };
  return ok(plan);
}

export function planCampaignStatus(p: ProductSnap, to: CampaignStatus): PlanResult {
  if (p.stage !== "LIVE") return fail("The campaign can only change while the product is live.");
  if (!(CAMPAIGN_STATUSES as readonly CampaignStatus[]).includes(to)) return fail("Choose a valid campaign status.");
  if (p.campaignStatus === to) return fail("The campaign already has that status.");
  const plan = emptyPlan();
  plan.campaign = { from: p.campaignStatus, to };
  return ok(plan);
}

/** Creative fatigue: a new batch while LIVE. All tasks unlocked, no store listing, stage unchanged. */
export function planNewBatch(
  p: ProductSnap,
  input: { types: TaskType[]; dueAt: Date | null; reason: string | null; name?: string | null },
): PlanResult {
  if (p.stage !== "LIVE") return fail("New creative batches can only be requested while the product is live.");
  const types = [...new Set(input.types)];
  if (types.length === 0) return fail("Pick at least one format.");
  if (types.some((t) => !(CREATIVE_TYPES as readonly TaskType[]).includes(t))) {
    return fail("A new batch can only include creative formats.");
  }
  const plan = emptyPlan();
  if (input.name !== undefined && !input.name?.trim()) return fail("Give the batch a name.");
  plan.newBatch = { number: nextBatchNumber(p), name: input.name?.trim() || null, reason: input.reason?.trim() || null, dueAt: input.dueAt };
  // Square versions wait for the portrait / main version when both are requested.
  const parentOf: Partial<Record<TaskType, TaskType>> = { AD_IMAGE_SQUARE: "AD_IMAGE_VERTICAL", VIDEO_SQUARE: "VIDEO_MAIN" };
  plan.newTasks = CREATIVE_TYPES.filter((t) => types.includes(t)).map((type) => {
    const parent = parentOf[type];
    const dependsOnKey = parent && types.includes(parent) ? parent : null;
    return {
      key: type,
      type,
      role: TASK_TYPE_ROLE[type],
      phase: dependsOnKey ? 2 : 1,
      status: dependsOnKey ? ("LOCKED" as const) : ("TODO" as const),
      dependsOnKey,
      inNewBatch: true,
      dueAt: input.dueAt ?? undefined,
    };
  });
  return ok(plan);
}

/** Campaign ended normally. Open tasks are cancelled (Q6). */
export function planComplete(p: ProductSnap): PlanResult {
  if (p.stage !== "LIVE") return fail("Only a live product can be marked completed.");
  const plan = emptyPlan();
  plan.changes = cancelOpen(p);
  plan.stage = { from: "LIVE", to: "COMPLETED" };
  if (p.campaignStatus && p.campaignStatus !== "STOPPED") plan.campaign = { from: p.campaignStatus, to: "STOPPED" };
  return ok(plan);
}

// ── Exceptional actions ─────────────────────────────────────────────────────

/** Kill from any non-terminal stage. Open tasks are cancelled. */
export function planKill(p: ProductSnap): PlanResult {
  if (isTerminalStage(p.stage)) return fail("This product is already closed.");
  const plan = emptyPlan();
  plan.changes = cancelOpen(p);
  plan.stage = { from: p.stage, to: "KILLED" };
  if (p.campaignStatus && p.campaignStatus !== "NOT_LAUNCHED" && p.campaignStatus !== "STOPPED") {
    plan.campaign = { from: p.campaignStatus, to: "STOPPED" };
  }
  return ok(plan);
}

/** Which earlier stages a role may send a product back to (Q4, Q5). */
export function sendBackTargets(stage: ProductStage, role: Role): ProductStage[] {
  const admin = role === "ADMIN";
  const mediaBuyer = role === "MEDIA_BUYER";
  // Product review is a yes/no decision: approve for testing or not approved (no send-back).
  if (stage === "REVIEW" || role === "REVIEWER") return [];
  if (stage === "CREATIVE" && (admin || mediaBuyer)) return ["RESEARCH"];
  if (stage === "READY_TO_LAUNCH") {
    if (admin) return ["CREATIVE", "RESEARCH"];
    if (mediaBuyer) return ["CREATIVE"];
  }
  return [];
}

/** Tasks that can be picked for reopening when sending back to Creative. */
export function reopenableTasks(p: ProductSnap): TaskSnap[] {
  const batch = latestBatch(p);
  if (!batch) return [];
  return p.tasks.filter((t) => t.batchId === batch.id && isReviewedType(t.type) && t.status === "APPROVED");
}

export function planSendBack(
  p: ProductSnap,
  input: { target: ProductStage; actorRole: Role; note: string; reopenTaskIds: string[] },
): PlanResult {
  const note = input.note.trim();
  if (!note) return fail("A note explaining the send-back is required.");
  if (!sendBackTargets(p.stage, input.actorRole).includes(input.target)) {
    return fail("You can't send this product back to that stage.");
  }
  const plan = emptyPlan();
  plan.stage = { from: p.stage, to: input.target };

  if (input.target === "RESEARCH") {
    const research = researchTask(p);
    if (!research) return fail("This product has no research task to reopen.");
    plan.changes = cancelOpen(p, (t) => t.id === research.id);
    if (research.status !== "REVISION") {
      plan.changes.push({ kind: "reopen", taskId: research.id, from: research.status, note });
    }
    return ok(plan);
  }

  // target CREATIVE (from READY_TO_LAUNCH)
  const allowed = new Map(reopenableTasks(p).map((t) => [t.id, t]));
  const ids = [...new Set(input.reopenTaskIds)];
  if (ids.length === 0) return fail("Pick at least one task to reopen.");
  if (ids.some((id) => !allowed.has(id))) return fail("Only approved tasks from the current batch can be reopened.");

  plan.changes = cancelOpen(p, (t) => t.type !== "CAMPAIGN_LAUNCH");
  const reopening = new Set(ids);
  for (const id of ids) {
    const task = allowed.get(id)!;
    // Q3: a task whose own Phase 1 task is being reopened waits LOCKED again.
    const parentReopened = task.dependsOnId !== null && reopening.has(task.dependsOnId);
    plan.changes.push(
      parentReopened
        ? { kind: "relock", taskId: id, from: task.status, note }
        : { kind: "reopen", taskId: id, from: task.status, note },
    );
  }
  // Q3: non-approved dependents of reopened tasks go back to LOCKED.
  for (const id of ids) {
    for (const dep of p.tasks.filter((t) => t.dependsOnId === id)) {
      if (reopening.has(dep.id)) continue;
      if (dep.status === "TODO" || dep.status === "SUBMITTED" || dep.status === "REVISION") {
        plan.changes.push({ kind: "relock", taskId: dep.id, from: dep.status });
      }
    }
  }
  return ok(plan);
}

// ── Permissions on individual tasks ─────────────────────────────────────────

export type Actor = { id: string; role: Role };

/** The assignee (or an Admin) works on a task: ticks checklist items, submits. */
export function canWorkOnTask(actor: Actor, task: { assigneeId: string | null }): boolean {
  return actor.role === "ADMIN" || task.assigneeId === actor.id;
}

/** Reassignment rules. Returns an error message, or null when allowed. */
export function reassignError(
  actor: Actor,
  task: { status: TaskStatus; assigneeId: string | null; role: Role },
  target: { id: string; role: Role; active: boolean },
): string | null {
  if (!isOpenStatus(task.status)) return "Closed tasks can't be reassigned.";
  if (!target.active) return "That person is inactive.";
  if (target.id === task.assigneeId) return "That person already has this task.";
  if (actor.role === "ADMIN") {
    if (target.role !== task.role && target.role !== "ADMIN") return "Pick someone with the task's role.";
    return null;
  }
  if (task.assigneeId !== actor.id) return "Only the assignee or an Admin can reassign this task.";
  if (target.role !== task.role) return "You can only hand a task to someone with the same role.";
  return null;
}
