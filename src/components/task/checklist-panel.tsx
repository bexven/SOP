"use client";

import { useOptimistic, useTransition } from "react";
import { ListChecksIcon } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from "@/lib/format";
import { toggleChecklistItemAction } from "@/lib/server/actions/product";
import { cn } from "@/lib/utils";

export type ChecklistItemDTO = {
  id: string;
  label: string;
  required: boolean;
  checked: boolean;
  checkedBy: string | null;
  checkedAt: string | null;
};

export function ChecklistPanel({
  items,
  editable,
  className,
}: {
  items: ChecklistItemDTO[];
  editable: boolean;
  className?: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(items, (state, change: { id: string; checked: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, checked: change.checked } : i)),
  );
  const [, startTransition] = useTransition();
  const done = optimistic.filter((i) => i.checked).length;
  const missing = optimistic.filter((i) => i.required && !i.checked).length;

  function toggle(id: string, checked: boolean) {
    startTransition(async () => {
      setOptimistic({ id, checked });
      const r = await toggleChecklistItemAction({ itemId: id, checked });
      if (!r.ok) toast.error(r.error);
    });
  }

  if (items.length === 0) {
    return (
      <div className={cn("rounded-control border border-dashed border-slate-200 px-3 py-3 text-meta font-normal text-slate-500", className)}>
        No SOP checklist for this task type yet. An Admin can add one in Settings → Checklists.
      </div>
    );
  }

  return (
    <div className={cn("rounded-control border border-slate-200/80 bg-white", className)}>
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <span className="flex items-center gap-2 text-meta text-slate-700">
          <ListChecksIcon className="size-3.5 text-slate-500" /> SOP checklist
        </span>
        <span className={cn("num text-meta", missing === 0 ? "text-emerald-700" : "text-slate-500")}>
          {done}/{optimistic.length}
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {optimistic.map((item) => (
          <li key={item.id}>
            <label
              className={cn(
                "flex items-start gap-3 px-3 py-2.5",
                editable ? "cursor-pointer hover:bg-slate-50/70" : "cursor-default",
              )}
            >
              <Checkbox
                checked={item.checked}
                disabled={!editable}
                onCheckedChange={(v) => toggle(item.id, v === true)}
                className="mt-px"
              />
              <span className="min-w-0 flex-1">
                <span className={cn("text-body", item.checked ? "text-slate-500 line-through decoration-slate-300" : "text-slate-800")}>
                  {item.label}
                </span>
                {item.required ? null : <span className="ml-1.5 text-meta text-slate-500">optional</span>}
                {item.checked && item.checkedBy && item.checkedAt ? (
                  <span className="block text-meta font-normal text-slate-500">
                    {item.checkedBy} · <span className="num">{formatDateTime(new Date(item.checkedAt))}</span>
                  </span>
                ) : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
