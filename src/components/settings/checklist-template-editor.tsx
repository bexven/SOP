"use client";

import { useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArchiveRestoreIcon, CheckIcon, GripVerticalIcon, ListChecksIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { TaskType } from "@/generated/prisma/enums";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reorder } from "@/lib/domain/checklist";
import { TASK_TYPE_LABELS } from "@/lib/domain/labels";
import {
  addTemplateItemAction,
  reorderTemplateAction,
  setTemplateItemActiveAction,
  updateTemplateItemAction,
} from "@/lib/server/actions/templates";
import type { TemplateGroup } from "@/lib/server/queries/templates";
import { cn } from "@/lib/utils";
import { TaskTypePicker } from "./task-type-picker";

type Item = TemplateGroup["items"][number];

export function ChecklistTemplateEditor({ groups }: { groups: TemplateGroup[] }) {
  const [type, setType] = useState<TaskType>("RESEARCH");
  const group = groups.find((g) => g.taskType === type)!;
  const counts = Object.fromEntries(groups.map((g) => [g.taskType, g.items.filter((i) => i.active).length]));
  return (
    <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
      <TaskTypePicker value={type} onChange={setType} counts={counts} />
      <TemplateList key={type} taskType={type} items={group.items} />
    </div>
  );
}

function TemplateList({ taskType, items }: { taskType: TaskType; items: Item[] }) {
  const [active, setActive] = useState(items.filter((i) => i.active));
  const inactive = items.filter((i) => !i.active);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Keep local order in sync when the server sends new data (adjust state during render).
  const serverKey = items.map((i) => `${i.id}:${i.active}:${i.order}:${i.label}:${i.required}`).join("|");
  const [seenKey, setSeenKey] = useState(serverKey);
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setActive(items.filter((i) => i.active));
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const next = reorder(active, String(e.active.id), String(e.over.id));
    setActive(next);
    startTransition(async () => {
      const r = await reorderTemplateAction({ taskType, ids: next.map((i) => i.id) });
      if (!r.ok) {
        toast.error(r.error);
        setActive(items.filter((i) => i.active));
      }
    });
  }

  return (
    <section className="grid content-start gap-4" aria-labelledby="tmpl-heading">
      <div className="surface rounded-panel">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 id="tmpl-heading" className="text-section text-slate-900">
              {TASK_TYPE_LABELS[taskType]}
            </h2>
            <p className="text-meta font-normal text-slate-500">
              Copied into each new task when it&apos;s created. Changes here never alter existing tasks. Drag to reorder.
            </p>
          </div>
        </div>
        {active.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ListChecksIcon}
              title="No checklist yet"
              description="Add the steps people must confirm before they can submit this task."
              className="border-dashed shadow-none"
            />
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={active.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-slate-100">
                {active.map((item) => (
                  <SortableRow key={item.id} item={item} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        <AddRow taskType={taskType} />
      </div>

      {inactive.length ? (
        <div className="surface rounded-panel">
          <h3 className="border-b border-slate-100 px-4 py-2.5 text-meta text-slate-600">Deactivated ({inactive.length})</h3>
          <ul className="divide-y divide-slate-100">
            {inactive.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 text-body text-slate-500 line-through decoration-slate-300">{item.label}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await setTemplateItemActiveAction({ id: item.id, active: true });
                      if (r.ok) toast.success(r.message);
                      else toast.error(r.error);
                    })
                  }
                >
                  <ArchiveRestoreIcon /> Reactivate
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function SortableRow({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [pending, startTransition] = useTransition();

  function save(next: { label?: string; required?: boolean }) {
    startTransition(async () => {
      const r = await updateTemplateItemAction({
        id: item.id,
        label: next.label ?? item.label,
        required: next.required ?? item.required,
      });
      if (r.ok) {
        setEditing(false);
        toast.success(r.message);
      } else toast.error(r.error);
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 bg-white px-2 py-2 sm:px-3", isDragging && "raised relative z-10 rounded-control ring-1 ring-indigo-200")}
    >
      <button
        type="button"
        className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
        aria-label={`Reorder "${item.label}"`}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      {editing ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save({ label });
          }}
        >
          <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus aria-label="Checklist item" />
          <Button type="submit" size="icon-sm" aria-label="Save" disabled={pending}>
            <CheckIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Cancel"
            onClick={() => {
              setLabel(item.label);
              setEditing(false);
            }}
          >
            <XIcon />
          </Button>
        </form>
      ) : (
        <>
          <span className="min-w-0 flex-1 text-body text-slate-800">{item.label}</span>
          <button
            type="button"
            onClick={() => save({ required: !item.required })}
            disabled={pending}
            aria-pressed={item.required}
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-meta ring-1 ring-inset transition-colors",
              item.required ? "bg-indigo-50 text-indigo-700 ring-indigo-100" : "bg-slate-50 text-slate-600 ring-slate-200",
            )}
            title="Toggle required / optional"
          >
            {item.required ? "Required" : "Optional"}
          </button>
          <Button variant="ghost" size="icon-sm" aria-label={`Edit "${item.label}"`} onClick={() => setEditing(true)}>
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Deactivate "${item.label}"`}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await setTemplateItemActiveAction({ id: item.id, active: false });
                if (r.ok) toast.success(r.message);
                else toast.error(r.error);
              })
            }
          >
            <XIcon />
          </Button>
        </>
      )}
    </li>
  );
}

function AddRow({ taskType }: { taskType: TaskType }) {
  const [label, setLabel] = useState("");
  const [required, setRequired] = useState(true);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 p-3 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await addTemplateItemAction({ taskType, label, required });
          if (r.ok) {
            setLabel("");
            toast.success(r.message);
          } else toast.error(r.fieldErrors?.label?.[0] ?? r.error);
        });
      }}
    >
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add a checklist item…" aria-label="New checklist item" />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setRequired((r) => !r)}
          aria-pressed={required}
          className={cn(
            "h-9 shrink-0 rounded-control px-3 text-meta ring-1 ring-inset",
            required ? "bg-indigo-50 text-indigo-700 ring-indigo-100" : "bg-white text-slate-600 ring-slate-200",
          )}
        >
          {required ? "Required" : "Optional"}
        </button>
        <Button type="submit" disabled={pending || label.trim().length < 2}>
          <PlusIcon /> Add
        </Button>
      </div>
    </form>
  );
}
