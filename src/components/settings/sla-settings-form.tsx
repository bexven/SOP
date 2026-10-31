"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TaskType } from "@/generated/prisma/enums";
import { RolePill } from "@/components/common/pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TASK_TYPE_LABELS, TASK_TYPE_ROLE } from "@/lib/domain/labels";
import { updateSlaAction } from "@/lib/server/actions/settings";
import { SettingsCard } from "./settings-card";

type Row = { taskType: TaskType; slaHours: number | null };

export function SlaSettingsForm({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial.map((r) => ({ ...r, value: r.slaHours?.toString() ?? "" })));
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await updateSlaAction({ sla: rows.map((x) => ({ taskType: x.taskType, slaHours: x.value })) });
      if (!r.ok) {
        toast.error(r.error === "Please check the highlighted fields." ? "Every SLA must be a whole number of hours (1 or more)." : r.error);
        return;
      }
      toast.success(r.message ?? "Saved");
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <SettingsCard
        title="Task SLAs"
        description="How long each task type has, in hours, counted from when the task unlocks. Sets the due date automatically; Admin can still change a single task's due date."
        footer={
          <Button type="submit" disabled={pending}>
            Save SLAs
          </Button>
        }
      >
        <ul className="divide-y divide-slate-100 rounded-control border border-slate-200/70">
          {rows.map((row, i) => {
            const id = `sla-${row.taskType}`;
            return (
              <li key={row.taskType} className="flex items-center gap-3 px-3 py-2.5">
                <label htmlFor={id} className="min-w-0 flex-1">
                  <span className="block truncate text-body text-slate-900">{TASK_TYPE_LABELS[row.taskType]}</span>
                  <RolePill role={TASK_TYPE_ROLE[row.taskType]} className="mt-1" />
                </label>
                <div className="relative w-28 shrink-0">
                  <Input
                    id={id}
                    value={row.value}
                    inputMode="numeric"
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setRows((rs) => rs.map((r, j) => (j === i ? { ...r, value } : r)));
                    }}
                    className="num pr-10 text-right"
                    placeholder="—"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-meta text-slate-500">
                    hrs
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </SettingsCard>
    </form>
  );
}
