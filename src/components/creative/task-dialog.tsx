"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  Loader2Icon,
  LockIcon,
  PlusIcon,
  RotateCcwIcon,
  SendIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { FollowUpKind } from "@/generated/prisma/enums";
import { DuePill, TaskStatusPill } from "@/components/common/pills";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChecklistPanel } from "@/components/task/checklist-panel";
import { DueOverride } from "@/components/task/due-override";
import { ReassignMenu } from "@/components/task/reassign-menu";
import { Discussion } from "@/components/product/discussion";
import type { Viewer } from "@/components/product/product-view";
import { brandThemeStyle } from "@/lib/brand-color";
import { FOLLOW_UP_KINDS, FOLLOW_UP_LABELS, laneOf, SUBMIT_PROMPT, TASK_TYPE_LABELS } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { canWorkOnTask } from "@/lib/domain/workflow";
import { formatDateTime } from "@/lib/format";
import { approveTaskAction, markReadyAction, requestRevisionAction } from "@/lib/server/actions/task";
import type { ProductDetail, TaskDTO } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";

type Result = { ok: boolean; message?: string; error?: string };

/**
 * Everything about one creative task in one place: the work (links), the
 * Senior's decision (Approve / Needs changes), and the task's own discussion.
 */
export function TaskDialog({
  task,
  product,
  viewer,
  parentLabel,
  batchLabel,
  open,
  onOpenChange,
  startReady,
}: {
  task: TaskDTO | null;
  product: ProductDetail;
  viewer: Viewer;
  parentLabel: string | null;
  batchLabel: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Open with the "ready" form already ticked (from the Creative page). */
  startReady?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl gap-0 p-0 sm:max-h-[calc(100dvh-3rem)]"
        style={brandThemeStyle(product.brand?.color)}
        aria-describedby={undefined}
      >
        {task ? (
          <TaskBody
            key={task.id + task.status}
            task={task}
            product={product}
            viewer={viewer}
            parentLabel={parentLabel}
            batchLabel={batchLabel}
            startReady={startReady}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskBody({
  task,
  product,
  viewer,
  parentLabel,
  batchLabel,
  startReady,
  onDone,
}: {
  task: TaskDTO;
  product: ProductDetail;
  viewer: Viewer;
  parentLabel: string | null;
  batchLabel: string;
  startReady?: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const mine = canWorkOnTask(viewer, { assigneeId: task.assignee?.id ?? null });
  const senior = can(viewer, "task.review");
  const workable = mine && (task.status === "TODO" || task.status === "REVISION");
  const locked = task.status === "LOCKED";
  const latest = task.submissions[0];
  const lane = laneOf(task.type);
  const missingChecklist = task.checklist.filter((c) => c.required && !c.checked).length;

  function act(fn: () => Promise<Result>, close = false) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        router.refresh();
        if (close) onDone();
      } else toast.error(r.error ?? "Something went wrong");
    });
  }

  return (
    <div className="grid max-h-[inherit] min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <header className="grid gap-2 border-b border-slate-900/[0.06] px-5 pt-5 pb-4 pr-12 sm:px-6">
        <p className="text-meta font-normal text-slate-500">
          {lane === "videos" ? "Video creative" : "Image creative"} · {batchLabel}
        </p>
        <DialogTitle className="text-[18px] leading-tight font-semibold text-slate-900">
          {TASK_TYPE_LABELS[task.type]}
          {task.requestKind ? <span className="text-primary"> · {FOLLOW_UP_LABELS[task.requestKind]}</span> : null}
        </DialogTitle>
        <DialogDescription className="sr-only">Work, review and discussion for this task.</DialogDescription>
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusPill status={task.status} />
          {!locked && task.status !== "APPROVED" ? <DuePill dueAt={task.dueAt} /> : null}
          <span className="flex items-center gap-1.5 text-meta text-slate-600">
            <ReassignMenu
              taskId={task.id}
              assignee={task.assignee}
              people={product.people}
              taskRole={task.role}
              canReassign={!locked && task.status !== "APPROVED" && (viewer.role === "ADMIN" || can(viewer, "task.reassignAny") || task.assignee?.id === viewer.id)}
              viewerIsAdmin={viewer.role === "ADMIN" || can(viewer, "task.reassignAny")}
            />
            {task.assignee?.name ?? "Unassigned"}
          </span>
        </div>
      </header>

      <div className="grid min-h-0 overflow-y-auto md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:overflow-hidden">
        <div className="grid content-start gap-4 px-5 py-5 sm:px-6 md:overflow-y-auto">
          {locked ? (
            <Notice tone="slate" icon={LockIcon}>
              Unlocks when {parentLabel ? parentLabel.toLowerCase() : "the step before"} {parentLabel?.endsWith("s") ? "are" : "is"} approved by a Senior.
            </Notice>
          ) : null}
          {task.requestNote ? <Notice tone="indigo" icon={PlusIcon}>Asked for: “{task.requestNote}”</Notice> : null}
          {task.status === "REVISION" && task.revisionNote ? (
            <Notice tone="rose" icon={RotateCcwIcon}>
              <span className="font-semibold">Needs changes:</span> “{task.revisionNote}”
            </Notice>
          ) : null}

          {latest?.links.length ? (
            <section aria-label="Submitted links" className="grid gap-2">
              <h3 className="text-meta text-slate-700">
                {task.status === "REVISION" ? "Last version" : "Submitted"}
                <span className="font-normal text-slate-500">
                  {" "}
                  · {latest.submittedBy?.name ?? "—"} · <span className="num">{formatDateTime(new Date(latest.createdAt))}</span>
                </span>
              </h3>
              <ul className="grid gap-1.5">
                {latest.links.map((l, i) => (
                  <li key={l + i}>
                    <a
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2.5 rounded-control bg-white px-3 py-2 text-body text-slate-800 ring-1 ring-slate-200 transition-[box-shadow,background-color] duration-150 hover:bg-accent hover:ring-primary/30"
                    >
                      <span className="num flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-white">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{l.replace(/^https?:\/\/(www\.)?/, "")}</span>
                      <ExternalLinkIcon className="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-primary" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {task.status === "APPROVED" ? (
            <Notice tone="emerald" icon={CheckCircle2Icon}>
              Approved{task.approvedBy ? ` by ${task.approvedBy}` : ""}
              {task.approvedAt ? <span className="num"> · {formatDateTime(new Date(task.approvedAt))}</span> : null}
            </Notice>
          ) : null}

          {workable ? (
            <ReadyForm
              task={task}
              startOpen={Boolean(startReady)}
              blocked={missingChecklist ? `Tick ${missingChecklist} checklist item${missingChecklist === 1 ? "" : "s"} first` : null}
              initial={latest?.links ?? []}
              pending={pending}
              onSend={(links) => act(() => markReadyAction({ taskId: task.id, ready: true, links }))}
            />
          ) : null}
          {!mine && (task.status === "TODO" || task.status === "REVISION") ? (
            <p className="text-body text-slate-600">Waiting for {task.assignee?.name ?? "someone to be assigned"} to send this for review.</p>
          ) : null}

          {task.status === "SUBMITTED" ? (
            senior ? (
              <ReviewBox pending={pending} onApprove={(followUp) => act(() => approveTaskAction({ taskId: task.id, followUp }))} onRevision={(note) => act(() => requestRevisionAction({ taskId: task.id, note }))} />
            ) : (
              <Notice tone="indigo" icon={SendIcon}>
                In review — waiting for a Senior to approve or ask for changes.
              </Notice>
            )
          ) : null}
          {task.status === "SUBMITTED" && mine ? (
            <Button variant="ghost" size="sm" className="w-fit" disabled={pending} onClick={() => act(() => markReadyAction({ taskId: task.id, ready: false }))}>
              <Undo2Icon /> Take it back to edit
            </Button>
          ) : null}

          {task.checklist.length && !locked ? (
            <ChecklistPanel items={task.checklist} editable={workable} />
          ) : null}

          {viewer.role === "ADMIN" && !locked && task.status !== "APPROVED" ? <DueOverride taskId={task.id} dueAt={task.dueAt} /> : null}
        </div>

        <aside className="border-t border-slate-900/[0.06] bg-slate-50/60 px-5 py-5 sm:px-6 md:overflow-y-auto md:border-t-0 md:border-l">
          <Discussion product={product} viewer={viewer} phase={lane === "videos" ? "VIDEOS" : "IMAGES"} taskId={task.id} title="Discussion" />
        </aside>
      </div>
    </div>
  );
}

const NOTICE_TONE = {
  slate: "bg-slate-100 text-slate-700",
  indigo: "bg-indigo-50 text-indigo-900",
  rose: "bg-rose-50 text-rose-800",
  emerald: "bg-emerald-50 text-emerald-800",
} as const;

function Notice({ tone, icon: Icon, children }: { tone: keyof typeof NOTICE_TONE; icon: typeof LockIcon; children: React.ReactNode }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-control px-3 py-2.5 text-body", NOTICE_TONE[tone])}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function ReadyForm({
  task,
  startOpen,
  blocked,
  initial,
  pending,
  onSend,
}: {
  task: TaskDTO;
  startOpen: boolean;
  blocked: string | null;
  initial: string[];
  pending: boolean;
  onSend: (links: string[]) => void;
}) {
  const reduce = useReducedMotion();
  const prompt = SUBMIT_PROMPT[task.type];
  const [open, setOpen] = useState(startOpen);
  const [links, setLinks] = useState<string[]>(initial.length ? initial : [""]);
  const first = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);
  if (!prompt) return null;
  const clean = links.map((l) => l.trim()).filter(Boolean);
  const invalid = clean.some((l) => !/^https?:\/\/\S+\.\S+/.test(l));
  const id = `ready-${task.id}`;

  return (
    <section className="grid gap-3 rounded-control border border-slate-200 bg-white p-3.5" aria-label="Send for review">
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-body font-medium text-slate-900">
        <Checkbox id={id} checked={open} onCheckedChange={(v) => setOpen(v === true)} />
        {prompt.ready}
      </label>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.form
            key="form"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-2 overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              if (clean.length && !invalid && !blocked) onSend(clean);
            }}
          >
            <p className="text-meta text-slate-700">{prompt.field}</p>
            {links.map((l, i) => (
              <div key={i} className="flex gap-1.5">
                <Input
                  ref={i === 0 ? first : undefined}
                  value={l}
                  onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={prompt.placeholder}
                  inputMode="url"
                  aria-label={`${prompt.field} ${i + 1}`}
                />
                {links.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove link ${i + 1}`} onClick={() => setLinks(links.filter((_, j) => j !== i))}>
                    <XIcon />
                  </Button>
                ) : null}
              </div>
            ))}
            {prompt.many && links.length < 20 ? (
              <Button type="button" variant="brandSoft" size="sm" className="w-fit" onClick={() => setLinks([...links, ""])}>
                <PlusIcon /> Add another link
              </Button>
            ) : null}
            {invalid ? <p className="text-meta text-rose-700">Each link must be a full https:// address.</p> : null}
            {blocked ? <p className="text-meta text-amber-800">{blocked}</p> : null}
            <Button type="submit" className="w-fit" disabled={pending || !clean.length || invalid || Boolean(blocked)}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Send for review
            </Button>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function ReviewBox({
  pending,
  onApprove,
  onRevision,
}: {
  pending: boolean;
  onApprove: (followUp?: { kind: FollowUpKind }) => void;
  onRevision: (note: string) => void;
}) {
  const [mode, setMode] = useState<"choose" | "changes">("choose");
  const [note, setNote] = useState("");
  return (
    <section className="grid gap-3 rounded-control border border-primary/25 bg-accent/60 p-3.5" aria-label="Review">
      <h3 className="text-body font-semibold text-slate-900">Your review</h3>
      {mode === "choose" ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={pending} onClick={() => onApprove()}>
              {pending ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />} Approve
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setMode("changes")}>
              <RotateCcwIcon /> Needs changes
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-meta font-normal text-slate-600">
            Approve and also ask for:
            {FOLLOW_UP_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                disabled={pending}
                onClick={() => onApprove({ kind: k })}
                className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-700 ring-1 ring-slate-200 transition-[background-color,box-shadow,transform] duration-150 hover:bg-slate-50 hover:ring-slate-300 active:scale-95"
              >
                {FOLLOW_UP_LABELS[k]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim().length >= 3) onRevision(note.trim());
          }}
        >
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What needs to change?" aria-label="What needs to change" autoFocus />
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" disabled={pending || note.trim().length < 3}>
              <RotateCcwIcon /> Send back for changes
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("choose")}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

