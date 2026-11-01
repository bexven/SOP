"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClockIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { overrideTaskDueAction } from "@/lib/server/actions/exceptions";

/** Converts an ISO instant to a Dhaka "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
function toDhakaLocal(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 6 * 3_600_000).toISOString().slice(0, 16);
}

/** Admin-only due date editor (inputs are in Dhaka time). */
export function DueOverride({ taskId, dueAt }: { taskId: string; dueAt: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(toDhakaLocal(dueAt));
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-control border border-dashed border-slate-300 bg-white p-3 sm:flex-row sm:items-center">
      <label htmlFor={`due-${taskId}`} className="flex items-center gap-2 text-meta text-slate-700">
        <CalendarClockIcon className="size-3.5 text-slate-500" /> Due (Dhaka time) · Admin
      </label>
      <Input id={`due-${taskId}`} type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="num sm:w-auto" />
      <Button
        size="sm"
        variant="outline"
        disabled={pending || value === toDhakaLocal(dueAt)}
        onClick={() =>
          startTransition(async () => {
            const r = await overrideTaskDueAction({ taskId, dueAt: value ? `${value}:00+06:00` : null });
            if (r.ok) {
              toast.success(r.message);
              router.refresh();
            } else toast.error(r.error);
          })
        }
      >
        Save due date
      </Button>
    </div>
  );
}
