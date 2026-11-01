"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleDashedIcon,
  CircleIcon,
  ClockIcon,
  LockIcon,
  LockOpenIcon,
  RotateCcwIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react";
import type { TaskStatus } from "@/generated/prisma/enums";
import { DuePill, TaskStatusPill } from "@/components/common/pills";
import { isReviewedType, TASK_TYPE_LABELS, TASK_TYPE_SHORT } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { canWorkOnTask } from "@/lib/domain/workflow";
import { formatDateTime } from "@/lib/format";
import type { ProductDetail, TaskDTO } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/components/product/product-view";
import { BriefPanel } from "./brief-panel";
import { ChecklistPanel } from "./checklist-panel";
import { ReassignMenu } from "./reassign-menu";
import { ReviewActions } from "./review-actions";
import { StepGuidePanel } from "./step-guide-panel";
import { SubmissionHistory } from "./submission-history";
import { SubmitForm } from "./submit-form";

const ICON: Record<TaskStatus, React.ComponentType<{ className?: string }>> = {
  LOCKED: LockIcon,
  TODO: CircleIcon,
  SUBMITTED: SendIcon,
  REVISION: RotateCcwIcon,
  APPROVED: CheckCircle2Icon,
  CANCELLED: XCircleIcon,
};

const ICON_TONE: Record<TaskStatus, string> = {
  LOCKED: "text-slate-400",
  TODO: "text-slate-400",
  SUBMITTED: "text-indigo-600",
  REVISION: "text-rose-600",
  APPROVED: "text-emerald-600",
  CANCELLED: "text-slate-400",
};

export function needsViewer(task: TaskDTO, viewer: Viewer): boolean {
  const mine = task.assignee?.id === viewer.id;
  if (mine && (task.status === "TODO" || task.status === "REVISION")) return true;
  return task.status === "SUBMITTED" && can(viewer.role, "task.review") && isReviewedType(task.type);
}

export function TaskCard({
  task,
  product,
  viewer,
  extra,
}: {
  task: TaskDTO;
  product: ProductDetail;
  viewer: Viewer;
  /** Extra body content (e.g. the campaign launch panel). */
  extra?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(() => needsViewer(task, viewer));

  // Unlock moment: when this card's status flips LOCKED → TODO while on screen,
  // the padlock animates open and the card fades from muted to active.
  const [prevStatus, setPrevStatus] = useState(task.status);
  const [justUnlocked, setJustUnlocked] = useState(false);
  if (prevStatus !== task.status) {
    setPrevStatus(task.status);
    if (prevStatus === "LOCKED" && task.status === "TODO") setJustUnlocked(true);
  }

  const reviewed = isReviewedType(task.type);
  const locked = task.status === "LOCKED";
  const closed = task.status === "CANCELLED";
  const canWork = canWorkOnTask(viewer, { assigneeId: task.assignee?.id ?? null });
  const workable = task.status === "TODO" || task.status === "REVISION";
  const canReview = task.status === "SUBMITTED" && reviewed && can(viewer.role, "task.review");
  const open_ = task.status !== "APPROVED" && task.status !== "CANCELLED";
  const canReassign = open_ && (viewer.role === "ADMIN" || task.assignee?.id === viewer.id);
  const parent = task.dependsOnId ? product.tasks.find((t) => t.id === task.dependsOnId) : null;
  const missing = task.checklist.filter((c) => c.required && !c.checked).length;
  const Icon = justUnlocked ? LockOpenIcon : ICON[task.status];
  const bodyId = `task-body-${task.id}`;

  return (
    <motion.article
      layout={reduce ? false : "position"}
      initial={false}
      animate={{ opacity: locked || closed ? 0.72 : 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "surface overflow-hidden rounded-panel transition-shadow duration-200",
        task.status === "REVISION" && "border-rose-300 ring-1 ring-rose-200",
        locked && "bg-slate-50/80 shadow-none",
        justUnlocked && "ring-2 ring-emerald-300/70",
      )}
      aria-label={`${TASK_TYPE_LABELS[task.type]} — ${task.status.toLowerCase()}`}
    >
      <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={justUnlocked ? "unlocked" : task.status}
              initial={reduce ? false : { scale: 0.6, rotate: justUnlocked ? -20 : 0, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={reduce ? undefined : { scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              onAnimationComplete={() => {
                if (justUnlocked) setTimeout(() => setJustUnlocked(false), 1400);
              }}
              className="flex shrink-0"
            >
              <Icon className={cn("size-[18px]", justUnlocked ? "text-emerald-600" : ICON_TONE[task.status])} />
            </motion.span>
          </AnimatePresence>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-body font-medium", locked || closed ? "text-slate-600" : "text-slate-900")}>
              {TASK_TYPE_LABELS[task.type]}
            </span>
            <span className="block truncate text-meta font-normal text-slate-500">
              {locked && parent
                ? `Unlocks when ${TASK_TYPE_SHORT[parent.type]} is approved`
                : task.status === "APPROVED" && task.approvedAt
                  ? `${reviewed ? "Approved" : "Done"}${task.approvedBy ? ` by ${task.approvedBy}` : ""} · ${formatDateTime(new Date(task.approvedAt))}`
                  : task.status === "SUBMITTED" && task.submittedAt
                    ? `Submitted ${formatDateTime(new Date(task.submittedAt))}`
                    : task.assignee
                      ? task.assignee.name
                      : "Unassigned"}
            </span>
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            {open_ && !locked ? <DuePill dueAt={task.dueAt} /> : null}
            <TaskStatusPill status={task.status} label={!reviewed && task.status === "APPROVED" ? "Done" : undefined} />
          </span>
          <ChevronDownIcon className={cn("size-4 shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-180")} />
        </button>
        <ReassignMenu
          taskId={task.id}
          assignee={task.assignee}
          people={product.people}
          taskRole={task.role}
          canReassign={canReassign}
          viewerIsAdmin={viewer.role === "ADMIN"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 sm:hidden">
        <TaskStatusPill status={task.status} label={!reviewed && task.status === "APPROVED" ? "Done" : undefined} />
        {open_ && !locked ? <DuePill dueAt={task.dueAt} /> : null}
      </div>

      {task.revisionNote && (task.status === "REVISION" || task.status === "LOCKED") ? (
        <div className="mx-3 mb-3 flex gap-2 rounded-control bg-rose-50 px-3 py-2 text-body text-rose-800 sm:mx-4" role="note">
          <RotateCcwIcon className="mt-0.5 size-4 shrink-0" />
          <p className="whitespace-pre-line">
            <span className="font-semibold">Revision needed: </span>
            {task.revisionNote}
          </p>
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={bodyId}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 border-t border-slate-100 bg-slate-50/40 px-3 py-3 sm:px-4">
              {locked ? (
                <p className="flex items-center gap-2 text-body text-slate-600">
                  <ClockIcon className="size-4 text-slate-400" />
                  {parent
                    ? `This task unlocks as soon as ${TASK_TYPE_LABELS[parent.type]} is approved.`
                    : "This task is waiting for earlier work."}
                </p>
              ) : null}
              {reviewed ? <BriefPanel brief={product.creativeBrief} updatedAt={product.creativeBriefUpdatedAt} /> : null}
              {!closed ? (
                <ChecklistPanel items={task.checklist} editable={canWork && workable} />
              ) : (
                <p className="flex items-center gap-2 text-body text-slate-500">
                  <CircleDashedIcon className="size-4" /> Cancelled — no further work needed.
                </p>
              )}
              <StepGuidePanel guide={product.guides[task.type]} />
              {extra}
              {reviewed && canWork && workable ? (
                <SubmitForm
                  taskId={task.id}
                  isStore={task.type === "STORE_LISTING"}
                  checklistMissing={missing}
                  resubmission={task.submissions.length > 0}
                  defaultUrl={task.submissions[0]?.url}
                />
              ) : null}
              {canReview ? <ReviewActions taskId={task.id} label={TASK_TYPE_LABELS[task.type]} /> : null}
              <SubmissionHistory submissions={task.submissions} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
