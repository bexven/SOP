"use client";

import type { TaskType } from "@/generated/prisma/enums";
import { TASK_TYPE_LABELS, TASK_TYPE_ROLE, TASK_TYPES } from "@/lib/domain/labels";
import { RolePill } from "@/components/common/pill";
import { cn } from "@/lib/utils";

/** Left-hand list of task types (stacks above the editor on mobile). */
export function TaskTypePicker({
  value,
  onChange,
  counts,
}: {
  value: TaskType;
  onChange: (t: TaskType) => void;
  counts?: Partial<Record<TaskType, number>>;
}) {
  return (
    <nav aria-label="Task types" className="surface h-fit overflow-hidden rounded-panel">
      <ul className="divide-y divide-slate-100">
        {TASK_TYPES.map((t) => (
          <li key={t}>
            <button
              type="button"
              onClick={() => onChange(t)}
              aria-current={value === t ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors",
                value === t ? "bg-indigo-50/70" : "hover:bg-slate-50",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-body", value === t ? "font-medium text-slate-900" : "text-slate-700")}>
                  {TASK_TYPE_LABELS[t]}
                </span>
                <RolePill role={TASK_TYPE_ROLE[t]} className="mt-1" />
              </span>
              {counts ? <span className="num text-meta text-slate-500">{counts[t] ?? 0}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
