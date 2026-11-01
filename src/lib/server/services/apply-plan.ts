import "server-only";
import type { EventType, TaskType } from "@/generated/prisma/enums";
import { snapshotChecklist } from "@/lib/domain/checklist";
import { dueAtFrom } from "@/lib/domain/due";
import { STAGE_LABELS, TASK_TYPE_LABELS, TASK_TYPE_SHORT } from "@/lib/domain/labels";
import { CHANGE_TARGET, type Plan, type TaskChange } from "@/lib/domain/workflow";
import type { Tx } from "../db";
import { ActionError } from "../action";
import { autoAssign } from "./assign";
import { activeAdminIds, logEvents, notify, type EventInput, type NotificationInput } from "./events";

export const CONFLICT_MESSAGE = "Someone else changed this just now. Refresh and try again.";

const CHANGE_EVENT: Partial<Record<TaskChange["kind"], EventType>> = {
  unlock: "TASK_UNLOCKED",
  submit: "TASK_SUBMITTED",
  approve: "TASK_APPROVED",
  revision: "TASK_REVISION_REQUESTED",
  cancel: "TASK_CANCELLED",
  relock: "TASK_RELOCKED",
  reopen: "TASK_REOPENED",
};

export type ApplyContext = {
  actorId: string;
  product: { id: string; name: string; creativeBrief: string | null };
  now: Date;
};

export type ApplyResult = {
  createdTasks: { id: string; type: TaskType; assigneeId: string | null; assigneeName: string | null }[];
  unlocked: { id: string; type: TaskType; assigneeName: string | null }[];
};

async function slaMap(tx: Tx): Promise<Map<TaskType, number>> {
  const rows = await tx.taskTypeConfig.findMany({ select: { taskType: true, slaHours: true } });
  return new Map(rows.map((r) => [r.taskType, r.slaHours]));
}

/**
 * Applies a domain Plan inside the caller's transaction. Every status change
 * is a guarded update (`where status = from`), so a concurrent change makes
 * the whole transaction fail instead of corrupting state.
 */
export async function applyPlan(tx: Tx, plan: Plan, ctx: ApplyContext): Promise<ApplyResult> {
  const { actorId, product, now } = ctx;
  const sla = await slaMap(tx);
  const events: EventInput[] = [];
  const notes: NotificationInput[] = [];
  const result: ApplyResult = { createdTasks: [], unlocked: [] };

  // ── Task changes ──
  if (plan.changes.length) {
    const tasks = await tx.task.findMany({
      where: { id: { in: plan.changes.map((c) => c.taskId) } },
      select: { id: true, type: true, assigneeId: true, assignee: { select: { name: true } } },
    });
    const byId = new Map(tasks.map((t) => [t.id, t]));

    for (const change of plan.changes) {
      const task = byId.get(change.taskId);
      if (!task) throw new ActionError(CONFLICT_MESSAGE);
      const data: Record<string, unknown> = { status: CHANGE_TARGET[change.kind] };
      switch (change.kind) {
        case "unlock":
          data.unlockedAt = now;
          data.dueAt = dueAtFrom(now, sla.get(task.type));
          break;
        case "submit":
          data.submittedAt = now;
          data.revisionNote = null;
          break;
        case "approve":
        case "complete":
          data.approvedAt = now;
          data.approvedById = actorId;
          data.revisionNote = null;
          break;
        case "revision":
          data.revisionNote = change.note;
          break;
        case "relock":
          data.unlockedAt = null;
          data.dueAt = null;
          if (change.note) data.revisionNote = change.note;
          break;
        case "reopen":
          data.revisionNote = change.note;
          data.unlockedAt = now;
          data.dueAt = dueAtFrom(now, sla.get(task.type));
          data.approvedAt = null;
          data.approvedById = null;
          break;
        case "cancel":
          break;
      }
      const updated = await tx.task.updateMany({ where: { id: change.taskId, status: change.from }, data });
      if (updated.count !== 1) throw new ActionError(CONFLICT_MESSAGE);

      const eventType = CHANGE_EVENT[change.kind];
      if (eventType) {
        events.push({
          type: eventType,
          actorId,
          productId: product.id,
          taskId: task.id,
          data: "note" in change && change.note ? { note: change.note } : undefined,
        });
      }

      const label = TASK_TYPE_LABELS[task.type];
      const common = { userId: task.assigneeId, productId: product.id, taskId: task.id };
      if (change.kind === "unlock") {
        result.unlocked.push({ id: task.id, type: task.type, assigneeName: task.assignee?.name ?? null });
        notes.push({ ...common, type: "TASK_ASSIGNED", message: `${label} is unlocked for ${product.name}` });
      } else if (change.kind === "approve") {
        notes.push({ ...common, type: "TASK_APPROVED", message: `${label} approved for ${product.name}` });
      } else if (change.kind === "revision") {
        notes.push({ ...common, type: "REVISION_REQUESTED", message: `Revision requested on ${label} for ${product.name}` });
      } else if (change.kind === "reopen") {
        notes.push({ ...common, type: "SENT_BACK", message: `${label} was sent back on ${product.name}: ${change.note}` });
      }
    }
  }

  // ── New batch ──
  let batchId: string | null = null;
  if (plan.newBatch) {
    const batch = await tx.creativeBatch.create({
      data: {
        productId: product.id,
        number: plan.newBatch.number,
        reason: plan.newBatch.reason,
        dueAt: plan.newBatch.dueAt,
        briefSnapshot: product.creativeBrief,
        requestedById: actorId,
      },
    });
    batchId = batch.id;
  }

  // ── New tasks ──
  if (plan.newTasks.length) {
    // Explicit assignees must still be active; otherwise fall back to auto-assignment.
    const explicitIds = plan.newTasks.map((t) => t.assigneeId).filter((id): id is string => Boolean(id));
    const activeExplicit = new Set(
      (await tx.user.findMany({ where: { id: { in: explicitIds }, active: true }, select: { id: true } })).map((u) => u.id),
    );
    const needsAuto = plan.newTasks.filter((t) => !(t.assigneeId && activeExplicit.has(t.assigneeId)));
    const picks = await autoAssign(tx, needsAuto.map((t) => t.role), now);
    const autoByKey = new Map(needsAuto.map((t, i) => [t.key, picks[i] ?? null]));

    const templates = await tx.checklistTemplateItem.findMany({
      where: { taskType: { in: [...new Set(plan.newTasks.map((t) => t.type))] }, active: true },
    });
    const names = new Map(
      (await tx.user.findMany({ select: { id: true, name: true } })).map((u) => [u.id, u.name]),
    );
    const keyToId = new Map<string, string>();
    const admins = await activeAdminIds(tx);

    for (const nt of plan.newTasks) {
      const assigneeId =
        nt.assigneeId && activeExplicit.has(nt.assigneeId) ? nt.assigneeId : (autoByKey.get(nt.key) ?? null);
      const unlocked = nt.status === "TODO";
      const dueAt = unlocked ? (nt.dueAt !== undefined && nt.dueAt !== null ? nt.dueAt : dueAtFrom(now, sla.get(nt.type))) : null;
      const checklist = snapshotChecklist(templates.filter((t) => t.taskType === nt.type));
      const task = await tx.task.create({
        data: {
          productId: product.id,
          batchId: nt.inNewBatch ? batchId : (nt.batchId ?? null),
          followUpOfId: nt.followUp?.ofTaskId ?? null,
          requestKind: nt.followUp?.kind ?? null,
          requestNote: nt.followUp?.note ?? null,
          type: nt.type,
          role: nt.role,
          phase: nt.phase,
          status: nt.status,
          dependsOnId: nt.dependsOnKey ? (keyToId.get(nt.dependsOnKey) ?? null) : null,
          assigneeId,
          assignedAt: assigneeId ? now : null,
          unlockedAt: unlocked ? now : null,
          dueAt,
          checklist: { create: checklist },
        },
      });
      keyToId.set(nt.key, task.id);
      const assigneeName = assigneeId ? (names.get(assigneeId) ?? null) : null;
      result.createdTasks.push({ id: task.id, type: nt.type, assigneeId, assigneeName });
      events.push({
        type: "TASK_CREATED",
        actorId,
        productId: product.id,
        taskId: task.id,
        data: { assignee: assigneeName, locked: !unlocked },
      });
      if (!assigneeId) {
        for (const adminId of admins) {
          notes.push({
            userId: adminId,
            type: "TASK_UNASSIGNED",
            productId: product.id,
            taskId: task.id,
            message: `Nobody is available for ${TASK_TYPE_SHORT[nt.type]} on ${product.name} — please assign it`,
          });
        }
      } else if (unlocked) {
        notes.push({
          userId: assigneeId,
          type: "TASK_ASSIGNED",
          productId: product.id,
          taskId: task.id,
          message: nt.followUp
            ? `Follow-up on ${TASK_TYPE_LABELS[nt.type]} for ${product.name}${nt.followUp.note ? `: ${nt.followUp.note}` : ""}`
            : `New task: ${TASK_TYPE_LABELS[nt.type]} for ${product.name}`,
        });
      }
    }
  }

  // ── Stage ──
  if (plan.stage) {
    const updated = await tx.product.updateMany({
      where: { id: product.id, stage: plan.stage.from },
      data: { stage: plan.stage.to, stageEnteredAt: now },
    });
    if (updated.count !== 1) throw new ActionError(CONFLICT_MESSAGE);
    await tx.stageTransition.create({
      data: { productId: product.id, fromStage: plan.stage.from, toStage: plan.stage.to, actorId, at: now },
    });
    events.push({
      type: "STAGE_CHANGED",
      actorId,
      productId: product.id,
      data: { from: plan.stage.from, to: plan.stage.to, label: STAGE_LABELS[plan.stage.to] },
    });
  }

  // ── Campaign ──
  if (plan.campaign) {
    await tx.campaign.upsert({
      where: { productId: product.id },
      create: { productId: product.id, status: plan.campaign.to },
      update: { status: plan.campaign.to },
    });
    events.push({
      type: "CAMPAIGN_STATUS_CHANGED",
      actorId,
      productId: product.id,
      data: { from: plan.campaign.from, to: plan.campaign.to },
    });
  }

  await logEvents(tx, events);
  await notify(tx, actorId, notes);
  return result;
}
