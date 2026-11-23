"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HourglassIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { requestMoreTimeAction } from "@/lib/server/actions/task";

const dhakaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);

/** The maker asks for a later due date with a reason; the media buyer and Admins are told and set it. */
export function MoreTimeButton({ taskId, dueAt }: { taskId: string; dueAt: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const base = dueAt && new Date(dueAt) > new Date() ? new Date(dueAt) : new Date();
  const [until, setUntil] = useState(dhakaDay(new Date(base.getTime() + 86_400_000)));
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="w-fit text-slate-600">
          <HourglassIcon /> Ask for more time
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <form
          className="grid gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await requestMoreTimeAction({ taskId, until, reason });
              if (r.ok) {
                toast.success(r.message ?? "Sent");
                setOpen(false);
                setReason("");
                router.refresh();
              } else toast.error(r.error);
            });
          }}
        >
          <p className="text-meta font-normal text-slate-600">Your media buyer and the Admins get your request and set the new due date.</p>
          <label className="grid gap-1 text-meta text-slate-700">
            New due date
            <Input type="date" value={until} min={dhakaDay(new Date())} onChange={(e) => setUntil(e.target.value)} className="num" required />
          </label>
          <label className="grid gap-1 text-meta text-slate-700">
            Why do you need more time?
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Waiting for product photos from the supplier" required />
          </label>
          <Button type="submit" size="sm" className="w-fit" disabled={pending || reason.trim().length < 3 || !until}>
            <SendIcon /> Send request
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
