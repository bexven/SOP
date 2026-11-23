"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDownIcon, KanbanSquareIcon, LinkIcon, ListIcon, MessageSquareIcon, PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import type { ManualTaskStatus } from "@/generated/prisma/enums";
import { DuePill, PriorityPill } from "@/components/common/pills";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canEditManualTask, MANUAL_STATUS_LABELS, MANUAL_STATUSES, manualTaskRef } from "@/lib/domain/manual-tasks";
import { moveManualTaskAction } from "@/lib/server/actions/manual-tasks";
import type { ManualBoard as Board, ManualTaskDTO } from "@/lib/server/queries/manual-tasks";
import { cn } from "@/lib/utils";
import { ManualTaskDialog } from "./manual-task-dialog";

type Columns = Record<ManualTaskStatus, ManualTaskDTO[]>;
type Scope = "all" | "mine" | "created";

/** ClickUp-style status tags (solid colour, white small caps). */
const COLUMN_TONE: Record<ManualTaskStatus, string> = {
  TODO: "bg-slate-500",
  IN_PROGRESS: "bg-sky-700",
  IN_REVIEW: "bg-violet-600",
  DONE: "bg-emerald-700",
};

function StatusTag({ status }: { status: ManualTaskStatus }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center rounded-[5px] px-2 text-[11px] font-semibold tracking-[0.03em] text-white uppercase", COLUMN_TONE[status])}>
      {MANUAL_STATUS_LABELS[status]}
    </span>
  );
}

function group(tasks: ManualTaskDTO[]): Columns {
  const cols: Columns = { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] };
  for (const t of tasks) cols[t.status].push(t);
  return cols;
}

function findColumn(cols: Columns, id: string): ManualTaskStatus | null {
  if ((MANUAL_STATUSES as readonly string[]).includes(id)) return id as ManualTaskStatus;
  return MANUAL_STATUSES.find((s) => cols[s].some((t) => t.id === id)) ?? null;
}

export function ManualBoard({ board, viewer, openTaskId, startNew }: { board: Board; viewer: { id: string; role: string; permissions?: readonly string[] }; openTaskId?: string; startNew?: boolean }) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("all");
  const [view, setView] = useState<"board" | "list">("board");
  const [person, setPerson] = useState("anyone");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(openTaskId ?? null);
  const [creating, setCreating] = useState<ManualTaskStatus | null>(startNew ? "TODO" : null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return board.tasks.filter((t) => {
      if (scope === "mine" && t.assigneeId !== viewer.id) return false;
      if (scope === "created" && t.createdById !== viewer.id) return false;
      if (person !== "anyone" && (person === "nobody" ? t.assigneeId !== null : t.assigneeId !== person)) return false;
      if (needle && !`${manualTaskRef(t.number)} ${t.title} ${t.description ?? ""} ${t.product?.name ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [board.tasks, scope, person, q, viewer.id]);

  // While dragging (and until the move is saved) the board shows a local copy; otherwise the server's data.
  const [dragCols, setDragCols] = useState<Columns | null>(null);
  const serverCols = useMemo(() => group(visible), [visible]);
  const cols = dragCols ?? serverCols;
  const setCols = (fn: (prev: Columns) => Columns) => setDragCols((prev) => fn(prev ?? serverCols));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = useMemo(() => new Map(board.tasks.map((t) => [t.id, t])), [board.tasks]);
  const active = activeId ? byId.get(activeId) : undefined;
  const openTask = openId ? (byId.get(openId) ?? null) : null;

  function setUrl(taskId: string | null) {
    const url = taskId ? `/tasks?task=${taskId}` : "/tasks";
    window.history.replaceState(null, "", url);
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setDragCols(serverCols);
  }

  function onDragOver(e: DragOverEvent) {
    const { active: a, over } = e;
    if (!over) return;
    const from = findColumn(cols, String(a.id));
    const to = findColumn(cols, String(over.id));
    if (!from || !to || from === to) return;
    setCols((prev) => {
      const moving = prev[from].find((t) => t.id === a.id);
      if (!moving) return prev;
      const target = prev[to];
      const overIndex = target.findIndex((t) => t.id === over.id);
      const index = overIndex >= 0 ? overIndex : target.length;
      return {
        ...prev,
        [from]: prev[from].filter((t) => t.id !== a.id),
        [to]: [...target.slice(0, index), { ...moving, status: to }, ...target.slice(index)],
      };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const original = byId.get(id);
    setActiveId(null);
    if (!original || !e.over) {
      setDragCols(null);
      return;
    }
    const to = findColumn(cols, id);
    if (!to) return;
    let list = cols[to];
    const overIndex = list.findIndex((t) => t.id === e.over!.id);
    const index = list.findIndex((t) => t.id === id);
    if (overIndex >= 0 && overIndex !== index) {
      list = arrayMove(list, index, overIndex);
      const moved = list;
      setCols((prev) => ({ ...prev, [to]: moved }));
    }
    const at = list.findIndex((t) => t.id === id);
    const beforeId = list[at - 1]?.id ?? null;
    const afterId = list[at + 1]?.id ?? null;
    // Dropped back where it started: nothing to save.
    if (original.status === to && serverCols[to].findIndex((t) => t.id === id) === at) {
      setDragCols(null);
      return;
    }
    startTransition(async () => {
      const r = await moveManualTaskAction({ manualTaskId: id, status: to, beforeId, afterId });
      if (!r.ok) toast.error(r.error);
      else if (original.status !== to) toast.success(r.message);
      router.refresh();
      setDragCols(null);
    });
  }

  const counts = { mine: board.tasks.filter((t) => t.assigneeId === viewer.id && t.status !== "DONE").length };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="View" className="inline-flex rounded-control border border-[var(--line)] bg-white p-0.5">
            {(
              [
                ["board", "Board", KanbanSquareIcon],
                ["list", "List", ListIcon],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={view === k}
                onClick={() => setView(k)}
                className={cn("inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-meta transition-colors", view === k ? "bg-accent text-accent-foreground" : "text-slate-600 hover:bg-hover")}
              >
                <Icon className="size-3.5" aria-hidden /> {label}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Show" className="inline-flex rounded-control bg-slate-900/[0.04] p-0.5">
            {(
              [
                ["all", "All tasks"],
                ["mine", `Assigned to me${counts.mine ? ` · ${counts.mine}` : ""}`],
                ["created", "I created"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={scope === k}
                onClick={() => setScope(k)}
                className={cn(
                  "rounded-[8px] px-3 py-1.5 text-meta transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  scope === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Select value={person} onValueChange={setPerson}>
            <SelectTrigger className="h-9 w-44" aria-label="Filter by person">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anyone">Anyone</SelectItem>
              <SelectItem value="nobody">Not assigned</SelectItem>
              {board.people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className="h-9 w-48 pl-8" />
          </div>
        </div>
        <Button onClick={() => setCreating("TODO")}>
          <PlusIcon /> New task
        </Button>
      </div>

      <p className="sr-only" aria-live="polite">
        Drag a card to another column to change its status, or open it and pick a status. With a keyboard: focus a card, press space, use the arrow keys, then space again.
      </p>

      {view === "list" ? (
        <TaskList
          cols={cols}
          onOpen={(id) => {
            setOpenId(id);
            setUrl(id);
          }}
          onAdd={(st) => setCreating(st)}
        />
      ) : null}

      <div hidden={view === "list"}>
      <DndContext id="manual-board" sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => {
          setActiveId(null);
          setDragCols(null);
        }}>
        <div className="no-scrollbar relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {MANUAL_STATUSES.map((s) => (
            <Column
              key={s}
              status={s}
              tasks={cols[s]}
              viewer={viewer}
              onOpen={(id) => {
                setOpenId(id);
                setUrl(id);
              }}
              onAdd={() => setCreating(s)}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>{active ? <Card task={active} dragging /> : null}</DragOverlay>
      </DndContext>
      </div>

      <ManualTaskDialog
        open={Boolean(openTask)}
        onOpenChange={(o) => {
          if (!o) {
            setOpenId(null);
            setUrl(null);
          }
        }}
        task={openTask}
        board={board}
        viewer={viewer}
      />
      <ManualTaskDialog open={creating !== null} onOpenChange={(o) => !o && setCreating(null)} task={null} board={board} viewer={viewer} startStatus={creating ?? "TODO"} />
    </div>
  );
}

function Column({
  status,
  tasks,
  viewer,
  onOpen,
  onAdd,
}: {
  status: ManualTaskStatus;
  tasks: ManualTaskDTO[];
  viewer: { id: string; role: string; permissions?: readonly string[] };
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const sorted = tasks;
  return (
    <section
      aria-labelledby={`col-${status}`}
      className={cn(
        "flex w-[82vw] max-w-sm shrink-0 snap-start flex-col rounded-panel bg-[#f7f8f9] p-1.5 transition-colors duration-150 sm:w-72 lg:w-auto lg:max-w-none",
        isOver && "bg-primary/[0.07] ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center justify-between px-1.5 pt-1 pb-2">
        <h2 id={`col-${status}`} className="flex items-center gap-2 text-meta">
          <StatusTag status={status} />
          <span className="num font-normal text-slate-500">{tasks.length}</span>
        </h2>
        <Button variant="ghost" size="icon-sm" aria-label={`Add a task to ${MANUAL_STATUS_LABELS[status]}`} onClick={onAdd}>
          <PlusIcon />
        </Button>
      </div>
      <SortableContext items={sorted.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {/* Not a <ul>: each card is a draggable button, which a list item can't be. */}
        <div ref={setNodeRef} className="grid min-h-24 content-start gap-2">
          {sorted.map((t) => (
            <SortableCard key={t.id} task={t} canDrag={canEditManualTask(viewer, t)} onOpen={() => onOpen(t.id)} />
          ))}
          {sorted.length === 0 ? (
            <p className="rounded-control border border-dashed border-slate-300/80 px-3 py-4 text-center text-meta font-normal text-slate-500">
              {status === "TODO" ? "Nothing to do. Add a task with +." : "Drag a card here."}
            </p>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ task, canDrag, onOpen }: { task: ManualTaskDTO; canDrag: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !canDrag });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "[&>*]:bg-slate-100 [&>*]:shadow-none")}
      {...attributes}
      {...listeners}
      aria-roledescription={canDrag ? "draggable task" : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !e.defaultPrevented) onOpen();
      }}
    >
      <Card task={task} />
    </div>
  );
}

function Card({ task: t, dragging }: { task: ManualTaskDTO; dragging?: boolean }) {
  const overdueDone = t.status === "DONE";
  return (
    <div
      className={cn(
        "grid cursor-pointer gap-1.5 rounded-control border border-[var(--line)] bg-white p-2.5 text-left shadow-[0_1px_1px_rgb(15_23_42/0.03)] transition-[box-shadow,border-color] duration-150 ease-out hover:border-slate-300 hover:shadow-[var(--raised-shadow)]",
        dragging && "rotate-[1.5deg] shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-body font-medium [overflow-wrap:anywhere] text-slate-900", overdueDone && "text-slate-600 line-through decoration-slate-300")}>{t.title}</p>
        {t.assignee ? (
          <span title={t.assignee.name}>
            <UserAvatar name={t.assignee.name} color={t.assignee.avatarColor} imageId={t.assignee.avatarAssetId} size="xs" />
            <span className="sr-only">Assigned to {t.assignee.name}</span>
          </span>
        ) : null}
      </div>
      {t.product ? <p className="truncate text-meta font-normal text-slate-600">{t.product.name}</p> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="num text-[11px] text-slate-500">{manualTaskRef(t.number)}</span>
        {t.priority !== "MEDIUM" ? <PriorityPill priority={t.priority} /> : null}
        {t.status !== "DONE" ? <DuePill dueAt={t.dueAt} /> : null}
        {t.comments.length ? (
          <span className="inline-flex items-center gap-1 text-meta text-slate-500">
            <MessageSquareIcon className="size-3.5" aria-hidden />
            <span className="num">{t.comments.length}</span>
            <span className="sr-only">comments</span>
          </span>
        ) : null}
        {t.links.length ? (
          <span className="inline-flex items-center gap-1 text-meta text-slate-500">
            <LinkIcon className="size-3.5" aria-hidden />
            <span className="num">{t.links.length}</span>
            <span className="sr-only">links</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}


const LIST_COLS = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_6.5rem_7.5rem_2rem]";

/** List view: one collapsible group per status, dense rows; click a row to open the task. */
function TaskList({ cols, onOpen, onAdd }: { cols: Columns; onOpen: (id: string) => void; onAdd: (s: ManualTaskStatus) => void }) {
  return (
    <div>
      {MANUAL_STATUSES.map((s) => (
        <details key={s} open={s !== "DONE"} className="group/list">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-1.5 select-none [&::-webkit-details-marker]:hidden">
            <ChevronDownIcon className="size-4 -rotate-90 text-slate-500 transition-transform duration-150 group-open/list:rotate-0 motion-reduce:transition-none" aria-hidden />
            <StatusTag status={s} />
            <span className="num text-meta text-slate-500">{cols[s].length}</span>
          </summary>
          <div className="mt-1 mb-5 overflow-hidden rounded-panel border border-[var(--line)] bg-white">
            <div className={cn("hidden border-b border-[var(--line)] bg-[#fafbfc] px-3 py-1.5 text-[11px] font-medium tracking-[0.02em] text-slate-500 uppercase md:grid", LIST_COLS)}>
              <span>Task</span>
              <span>Product</span>
              <span>Priority</span>
              <span>Due</span>
              <span className="sr-only">Person</span>
            </div>
            <ul className="divide-y divide-[var(--line)]">
              {cols[s].map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(t.id)}
                    className={cn("group/row grid min-h-11 w-full items-center gap-x-3 gap-y-1 px-3 py-2 text-left text-body transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset", LIST_COLS)}
                  >
                    <span className="min-w-0">
                      <span className={cn("block truncate font-medium text-slate-900 group-hover/row:text-primary", s === "DONE" && "text-slate-600 line-through decoration-slate-300")}>{t.title}</span>
                      <span className="flex items-center gap-2 text-meta font-normal text-slate-500">
                        <span className="num">{manualTaskRef(t.number)}</span>
                        {t.comments.length ? (
                          <span className="inline-flex items-center gap-1">
                            <MessageSquareIcon className="size-3" aria-hidden /> <span className="num">{t.comments.length}</span>
                            <span className="sr-only">comments</span>
                          </span>
                        ) : null}
                        <span className="truncate md:hidden">{t.product?.name}</span>
                      </span>
                    </span>
                    <span className="hidden truncate text-slate-700 md:block">{t.product?.name ?? <span className="text-slate-400">—</span>}</span>
                    <span className="flex flex-wrap items-center gap-2 md:contents">
                      <PriorityPill priority={t.priority} />
                      <span>{s !== "DONE" ? <DuePill dueAt={t.dueAt} /> : null}</span>
                      <span className="max-md:ml-auto">
                        {t.assignee ? <UserAvatar name={t.assignee.name} color={t.assignee.avatarColor} imageId={t.assignee.avatarAssetId} size="xs" /> : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => onAdd(s)} className="flex h-9 w-full items-center gap-2 px-3 text-meta font-normal text-slate-500 transition-colors hover:bg-hover hover:text-slate-800">
                  <PlusIcon className="size-3.5" aria-hidden /> Add task
                </button>
              </li>
            </ul>
          </div>
        </details>
      ))}
    </div>
  );
}
