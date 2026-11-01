"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
import { GripVerticalIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { markReadyAction } from "@/lib/server/actions/task";
import type { CreativeRow } from "@/lib/server/queries/creative";
import { cn } from "@/lib/utils";
import { CreativeCard } from "./creative-card";

type Col = "todo" | "revision" | "review";
const COLS: { key: Col; title: string; hint: string }[] = [
  { key: "todo", title: "To do", hint: "Drag to “In review” when it's ready — you'll add the links" },
  { key: "revision", title: "Needs changes", hint: "Fix it, then drag to “In review” again" },
  { key: "review", title: "In review", hint: "Drag back to take it back" },
];

/** The column under the pointer wins; fall back to overlap for keyboard drags. */
const byPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

function colOf(r: CreativeRow): Col | null {
  if (r.status === "TODO") return "todo";
  if (r.status === "REVISION") return "revision";
  if (r.status === "SUBMITTED") return "review";
  return null;
}

/** The maker's own tasks. Drag a card to "In review" to mark it ready (uses the lane's Drive folder). */
export function MyBoard({ rows }: { rows: CreativeRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  function onDragEnd(e: DragEndEvent) {
    const row = rows.find((r) => r.id === e.active.id);
    const to = e.over?.id as Col | undefined;
    if (!row || !to) return;
    const from = colOf(row);
    if (from === to) return;
    const ready = to === "review";
    if (!ready && from !== "review") return; // only "In review" changes anything
    if (ready) {
      // Sending for review needs the links: open the task on its board with the ready form open.
      router.push(`/products/${row.product.id}?task=${row.id}&ready=1`);
      return;
    }
    setBusy(row.id);
    startTransition(async () => {
      const r = await markReadyAction({ taskId: row.id, ready });
      setBusy(null);
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else {
        toast.error(r.error, {
          action: { label: "Open task", onClick: () => router.push(`/products/${row.product.id}?task=${row.id}`) },
        });
      }
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={byPointer} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
        {COLS.map((c) => (
          <Column key={c.key} col={c} rows={rows.filter((r) => colOf(r) === c.key)} busy={busy} />
        ))}
      </div>
    </DndContext>
  );
}

function Column({ col, rows, busy }: { col: (typeof COLS)[number]; rows: CreativeRow[]; busy: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div ref={setNodeRef} className={cn("rounded-panel p-2 transition-colors", isOver ? "bg-indigo-100/70 ring-2 ring-indigo-300" : "bg-slate-900/[0.025]")}>
      <h3 className="flex items-center justify-between px-1.5 pt-1 text-body font-semibold text-slate-800">
        {col.title} <span className="num text-meta text-slate-500">{rows.length}</span>
      </h3>
      <p className="px-1.5 pb-2.5 text-meta font-normal text-slate-500">{col.hint}</p>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {rows.map((r) => (
          <DraggableCard key={r.id} row={r} busy={busy === r.id} />
        ))}
      </ul>
      {rows.length === 0 ? <p className="px-2 py-5 text-center text-meta font-normal text-slate-500">Nothing here</p> : null}
    </div>
  );
}

function DraggableCard({ row, busy }: { row: CreativeRow; busy: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id });
  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn("relative", isDragging && "z-20 rotate-1 opacity-95 shadow-[var(--raised-shadow)]")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute right-2 bottom-2 z-10 flex size-7 cursor-grab touch-none items-center justify-center rounded-md bg-white/90 text-slate-500 ring-1 ring-slate-200 hover:text-slate-800 active:cursor-grabbing"
        aria-label={`Drag ${row.product.name} task`}
      >
        {busy ? <Loader2Icon className="size-4 animate-spin" /> : <GripVerticalIcon className="size-4" />}
      </button>
      <CreativeCard t={row} />
    </li>
  );
}
