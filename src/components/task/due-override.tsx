"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClockIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { overrideTaskDueAction } from "@/lib/server/actions/exceptions";

/** ISO instant → Dhaka date "YYYY-MM-DD" and time "HH:mm". */
function toDhaka(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "18:00" };
  const local = new Date(new Date(iso).getTime() + 6 * 3_600_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/** Admin-only due date editor: a date and a time, in Dhaka time. */
export function DueOverride({ taskId, dueAt }: { taskId: string; dueAt: string | null }) {
  const router = useRouter();
  const initial = toDhaka(dueAt);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [pending, startTransition] = useTransition();
  const changed = date !== initial.date || time !== initial.time;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={`due-${taskId}`} className="flex items-center gap-1.5 text-meta text-slate-700">
        <CalendarClockIcon className="size-3.5 text-slate-500" /> Change due date <span className="font-normal text-slate-500">(Dhaka time)</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input id={`due-${taskId}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="num h-8 w-40" />
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="num h-8 w-28" aria-label="Due time" />
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !changed || !date}
          onClick={() =>
            startTransition(async () => {
              const r = await overrideTaskDueAction({ taskId, dueAt: `${date}T${time || "18:00"}:00+06:00` });
              if (r.ok) {
                toast.success(r.message);
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          {pending ? <Loader2Icon className="animate-spin" /> : null} Save
        </Button>
      </div>
    </div>
  );
}
