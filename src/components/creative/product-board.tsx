"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ExternalLinkIcon,
  GripVerticalIcon,
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
import { DuePill } from "@/components/common/pills";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChecklistPanel } from "@/components/task/checklist-panel";
import { DueOverride } from "@/components/task/due-override";
import { ReassignMenu } from "@/components/task/reassign-menu";
import type { Viewer } from "@/components/product/product-view";
import { FOLLOW_UP_KINDS, FOLLOW_UP_LABELS, SUBMIT_PROMPT, TASK_TYPE_LABELS, TASK_TYPE_SHORT } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { canWorkOnTask } from "@/lib/domain/workflow";
import { formatDateTime } from "@/lib/format";
import { approveTaskAction, markReadyAction, requestRevisionAction } from "@/lib/server/actions/task";
import type { ProductDetail, TaskDTO } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";

type Col = "todo" | "review" | "revision" | "approved";

const COLS: { key: Col; title: string }[] = [
  { key: "todo", title: "To do" },
  { key: "review", title: "In review" },
  { key: "revision", title: "Needs changes" },
  { key: "approved", title: "Approved" },
];

export type BoardGroupDef = { key: string; title: string; hint: string; tasks: TaskDTO[] };

function colOf(t: TaskDTO): Col | null {
  switch (t.status) {
    case "LOCKED":
    case "TODO":
      return "todo";
    case "SUBMITTED":
      return "review";
    case "REVISION":
      return "revision";
    case "APPROVED":
      return "approved";
    default:
      return null;
  }
}

/** The column under the pointer wins; fall back to overlap for keyboard drags. */
const byPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Kanban board for one creative step (images or videos). Rows are the board
 * sections (e.g. Website product images, Meta ad images); columns are the
 * status. Drag a card to "In review" to mark it ready, a Senior drags it to
 * "Approved" or "Needs changes". Every drag has a button equivalent on the card.
 */
export function ProductBoard({
  product,
  viewer,
  groups,
  focusTaskId,
  openReadyId,
}: {
  product: ProductDetail;
  viewer: Viewer;
  groups: BoardGroupDef[];
  focusTaskId?: string;
  /** Open the "ready" form on this task (from the Creative page). */
  openReadyId?: string;
}) {
  const router = useRouter();
  const [readyFor, setReadyFor] = useState<string | null>(openReadyId ?? null);
  const [revisionFor, setRevisionFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const senior = can(viewer, "task.review");
  const all = groups.flatMap((g) => g.tasks);

  function run(taskId: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setBusy(taskId);
    startTransition(async () => {
      const r = await fn();
      setBusy(null);
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        router.refresh();
      } else toast.error(r.error ?? "Something went wrong");
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const task = all.find((t) => t.id === e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!task || !over) return;
    const to = over.split(":")[1] as Col;
    const from = colOf(task);
    if (!from || from === to) return;
    const mine = canWorkOnTask(viewer, { assigneeId: task.assignee?.id ?? null });
    if ((from === "todo" || from === "revision") && to === "review") {
      if (!mine) return void toast.error(`Only ${task.assignee?.name ?? "the assignee"} can send this for review.`);
      setReadyFor(task.id);
      return;
    }
    if (from === "review" && to === "todo") {
      if (!mine) return void toast.error("Only the person who sent it can take it back.");
      return run(task.id, () => markReadyAction({ taskId: task.id, ready: false }));
    }
    if (from === "review" && (to === "approved" || to === "revision")) {
      if (!senior) return void toast.error("Only a Senior can approve or ask for changes.");
      if (to === "approved") return run(task.id, () => approveTaskAction({ taskId: task.id }));
      setRevisionFor(task.id);
      return;
    }
    toast.info(
      to === "approved" || to === "revision"
        ? "Send it for review first — a Senior approves it from “In review”."
        : "That move isn't possible.",
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={byPointer} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`grp-${g.key}`}>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
              <h3 id={`grp-${g.key}`} className="text-section text-slate-900">
                {g.title}
              </h3>
              <span className="text-meta font-normal text-slate-500">{g.hint}</span>
            </div>
            <div className="relative overflow-x-auto pb-1">
              <div className="grid min-w-[52rem] grid-cols-4 gap-2.5">
                {COLS.map((c) => (
                  <Column key={c.key} id={`${g.key}:${c.key}`} title={c.title} count={g.tasks.filter((t) => colOf(t) === c.key).length}>
                    {g.tasks
                      .filter((t) => colOf(t) === c.key)
                      .map((t) => (
                        <TaskTile
                          key={t.id}
                          task={t}
                          product={product}
                          viewer={viewer}
                          busy={busy === t.id}
                          focus={t.id === focusTaskId}
                          readyOpen={readyFor === t.id}
                          onReadyOpen={(o) => setReadyFor(o ? t.id : null)}
                          revisionOpen={revisionFor === t.id}
                          onRevisionOpen={(o) => setRevisionFor(o ? t.id : null)}
                          parentLabel={t.dependsOnId ? TASK_TYPE_SHORT[all.find((x) => x.id === t.dependsOnId)?.type ?? t.type] : null}
                        />
                      ))}
                  </Column>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </DndContext>
  );
}

function Column({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-28 flex-col gap-2 rounded-panel p-2 transition-[background-color,box-shadow] duration-150",
        isOver ? "bg-accent ring-2 ring-primary/40" : "bg-slate-900/[0.03]",
      )}
    >
      <h4 className="flex items-center justify-between px-1.5 pt-0.5 text-meta font-semibold text-slate-700">
        {title} <span className="num font-medium text-slate-500">{count}</span>
      </h4>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">{children}</ul>
      {count === 0 ? <p className="px-2 py-3 text-center text-meta font-normal text-slate-500">—</p> : null}
    </div>
  );
}

function TaskTile({
  task,
  product,
  viewer,
  busy,
  focus,
  readyOpen,
  onReadyOpen,
  revisionOpen,
  onRevisionOpen,
  parentLabel,
}: {
  task: TaskDTO;
  product: ProductDetail;
  viewer: Viewer;
  busy: boolean;
  focus: boolean;
  readyOpen: boolean;
  onReadyOpen: (open: boolean) => void;
  revisionOpen: boolean;
  onRevisionOpen: (open: boolean) => void;
  parentLabel: string | null;
}) {
  const router = useRouter();
  const ref = useRef<HTMLLIElement | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = task.status === "LOCKED";
  const mine = canWorkOnTask(viewer, { assigneeId: task.assignee?.id ?? null });
  const senior = can(viewer, "task.review");
  const workable = mine && (task.status === "TODO" || task.status === "REVISION");
  const draggable = !locked && task.status !== "APPROVED" && (mine || senior);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !draggable });
  const latest = task.submissions[0];
  const prompt = SUBMIT_PROMPT[task.type];
  const [showChecklist, setShowChecklist] = useState(false);

  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus]);

  function act(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        after?.();
        router.refresh();
      } else toast.error(r.error ?? "Something went wrong");
    });
  }

  const missingChecklist = task.checklist.filter((c) => c.required && !c.checked).length;

  return (
    <li
      ref={(n) => {
        ref.current = n;
        setNodeRef(n);
      }}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "relative list-none rounded-control border bg-white p-2.5 shadow-[0_1px_2px_rgb(15_23_42/0.05)] transition-[box-shadow,transform] duration-150",
        locked ? "border-dashed border-slate-300 bg-slate-50" : "border-slate-200/90 hover:shadow-[var(--raised-shadow)]",
        task.status === "REVISION" && "border-rose-200",
        focus && "ring-2 ring-primary/50",
        isDragging && "z-30 rotate-1 shadow-[var(--raised-shadow)]",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-body leading-snug font-medium", locked ? "text-slate-600" : "text-slate-900")}>
            {locked ? <LockIcon className="mr-1 inline size-3.5 -translate-y-px text-slate-400" aria-label="Locked" /> : null}
            {TASK_TYPE_LABELS[task.type]}
          </p>
          {task.requestKind ? (
            <p className="text-meta text-primary">
              {FOLLOW_UP_LABELS[task.requestKind]}
              {task.requestNote ? <span className="font-normal text-slate-600"> · “{task.requestNote}”</span> : null}
            </p>
          ) : null}
        </div>
        <ReassignMenu
          taskId={task.id}
          assignee={task.assignee}
          people={product.people}
          taskRole={task.role}
          canReassign={!locked && task.status !== "APPROVED" && (viewer.role === "ADMIN" || can(viewer, "task.reassignAny") || task.assignee?.id === viewer.id)}
          viewerIsAdmin={viewer.role === "ADMIN" || can(viewer, "task.reassignAny")}
        />
        {draggable ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="-mr-1 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
            aria-label={`Drag ${TASK_TYPE_SHORT[task.type]}`}
          >
            {busy || pending ? <Loader2Icon className="size-4 animate-spin" /> : <GripVerticalIcon className="size-4" />}
          </button>
        ) : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {task.status !== "APPROVED" && !locked ? <DuePill dueAt={task.dueAt} /> : null}
        {viewer.role === "ADMIN" && !locked && task.status !== "APPROVED" ? <DueOverride taskId={task.id} dueAt={task.dueAt} /> : null}
      </div>

      {locked ? (
        <p className="mt-1.5 text-meta font-normal text-slate-600">Unlocks when {parentLabel ? parentLabel.toLowerCase() : "the step before"} {parentLabel?.endsWith("s") ? "are" : "is"} approved.</p>
      ) : null}

      {task.status === "REVISION" && task.revisionNote ? (
        <p className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-meta text-rose-800">
          <RotateCcwIcon className="mr-1 inline size-3 -translate-y-px" />“{task.revisionNote}”
        </p>
      ) : null}

      {latest && latest.links.length && (task.status === "SUBMITTED" || task.status === "APPROVED") ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Links">
          {latest.links.map((l, i) => (
            <li key={l + i}>
              <Button asChild size="sm" variant={i === 0 ? "default" : "brandSoft"} className="h-7 max-w-[13rem] px-2.5">
                <a href={l} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon /> <span className="truncate">{latest.links.length > 1 ? `${i + 1}. ` : ""}{host(l)}</span>
                </a>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {task.status === "APPROVED" ? (
        <p className="mt-2 flex items-center gap-1 text-meta text-emerald-800">
          <CheckCircle2Icon className="size-3.5" /> Approved{task.approvedBy ? ` by ${task.approvedBy}` : ""}
          {task.approvedAt ? <span className="num font-normal text-slate-500"> · {formatDateTime(new Date(task.approvedAt))}</span> : null}
        </p>
      ) : null}

      {/* Maker: tick ready → add the link(s) → send */}
      {workable && prompt ? (
        <ReadyForm
          key={readyOpen ? "open" : "closed"}
          task={task}
          open={readyOpen}
          onOpenChange={onReadyOpen}
          blocked={missingChecklist ? `Tick ${missingChecklist} checklist item${missingChecklist === 1 ? "" : "s"} first` : null}
          onSend={(links) => act(() => markReadyAction({ taskId: task.id, ready: true, links }), () => onReadyOpen(false))}
          pending={pending}
          initial={latest?.links ?? []}
        />
      ) : null}
      {!mine && (task.status === "TODO" || task.status === "REVISION") ? (
        <p className="mt-2 text-meta font-normal text-slate-500">Waiting for {task.assignee?.name ?? "someone to be assigned"}</p>
      ) : null}

      {task.checklist.length && !locked && task.status !== "APPROVED" ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowChecklist((s) => !s)}
            aria-expanded={showChecklist}
            className="flex items-center gap-1 text-meta text-slate-600 hover:text-slate-900"
          >
            <ChevronDownIcon className={cn("size-3.5 transition-transform", showChecklist && "rotate-180")} />
            Checklist <span className="num">{task.checklist.filter((c) => c.checked).length}/{task.checklist.length}</span>
          </button>
          {showChecklist ? <ChecklistPanel items={task.checklist} editable={workable} className="mt-1.5" /> : null}
        </div>
      ) : null}

      {task.status === "SUBMITTED" ? (
        <div className="mt-2.5 grid gap-2 border-t border-slate-100 pt-2.5">
          {senior ? (
            revisionOpen ? (
              <RevisionForm
                pending={pending}
                onCancel={() => onRevisionOpen(false)}
                onSend={(note) => act(() => requestRevisionAction({ taskId: task.id, note }), () => onRevisionOpen(false))}
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" disabled={pending} onClick={() => act(() => approveTaskAction({ taskId: task.id }))}>
                  <CheckCircle2Icon /> Approve
                </Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => onRevisionOpen(true)}>
                  <RotateCcwIcon /> Needs changes
                </Button>
                <FollowUpMenu pending={pending} onPick={(kind) => act(() => approveTaskAction({ taskId: task.id, followUp: { kind } }))} />
              </div>
            )
          ) : (
            <p className="text-meta font-normal text-slate-600">
              <SendIcon className="mr-1 inline size-3 -translate-y-px text-primary" /> Waiting for a Senior to review
            </p>
          )}
          {mine ? (
            <Button size="sm" variant="ghost" className="w-fit" disabled={pending} onClick={() => act(() => markReadyAction({ taskId: task.id, ready: false }))}>
              <Undo2Icon /> Take back
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ReadyForm({
  task,
  open,
  onOpenChange,
  onSend,
  pending,
  blocked,
  initial,
}: {
  task: TaskDTO;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSend: (links: string[]) => void;
  pending: boolean;
  blocked: string | null;
  initial: string[];
}) {
  const prompt = SUBMIT_PROMPT[task.type]!;
  const [links, setLinks] = useState<string[]>(initial.length ? initial : [""]);
  const firstRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (open) firstRef.current?.focus();
  }, [open]);
  const clean = links.map((l) => l.trim()).filter(Boolean);
  const invalid = clean.some((l) => !/^https?:\/\/\S+\.\S+/.test(l));
  const id = `ready-${task.id}`;

  return (
    <div className="mt-2.5 grid gap-2 border-t border-slate-100 pt-2.5">
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-body font-medium text-slate-900">
        <Checkbox id={id} checked={open} onCheckedChange={(v) => onOpenChange(v === true)} />
        {prompt.ready}
      </label>
      {open ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!clean.length || invalid || blocked) return;
            onSend(clean);
          }}
        >
          <p className="text-meta text-slate-700">{prompt.field}</p>
          {links.map((l, i) => (
            <div key={i} className="flex gap-1.5">
              <Input
                ref={i === 0 ? firstRef : undefined}
                value={l}
                onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={prompt.placeholder}
                inputMode="url"
                aria-label={`${prompt.field} ${i + 1}`}
                className="h-8"
              />
              {links.length > 1 ? (
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove link ${i + 1}`} onClick={() => setLinks(links.filter((_, j) => j !== i))}>
                  <XIcon />
                </Button>
              ) : null}
            </div>
          ))}
          {prompt.many && links.length < 20 ? (
            <Button type="button" variant="brandSoft" size="sm" className="h-7 w-fit" onClick={() => setLinks([...links, ""])}>
              <PlusIcon /> Add another link
            </Button>
          ) : null}
          {invalid ? <p className="text-meta text-rose-700">Each link must be a full https:// address.</p> : null}
          {blocked ? <p className="text-meta text-amber-800">{blocked}</p> : null}
          <Button type="submit" size="sm" className="w-fit" disabled={pending || !clean.length || invalid || Boolean(blocked)}>
            {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Send for review
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function RevisionForm({ pending, onCancel, onSend }: { pending: boolean; onCancel: () => void; onSend: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (note.trim().length >= 3) onSend(note.trim());
      }}
    >
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What needs to change?" aria-label="What needs to change" autoFocus />
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" variant="destructive" disabled={pending || note.trim().length < 3}>
          <RotateCcwIcon /> Ask for changes
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FollowUpMenu({ pending, onPick }: { pending: boolean; onPick: (kind: FollowUpKind) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" disabled={pending} aria-label="Approve and ask for more">
          <PlusIcon /> Approve + ask for…
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Approve, and ask for a new version</DropdownMenuLabel>
        {FOLLOW_UP_KINDS.map((k) => (
          <DropdownMenuItem key={k} onSelect={() => onPick(k)}>
            {FOLLOW_UP_LABELS[k]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
