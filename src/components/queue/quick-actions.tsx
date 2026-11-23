"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, RotateCcwIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/generated/prisma/enums";
import { ReassignMenu } from "@/components/task/reassign-menu";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { canSeeBrand } from "@/lib/domain/permissions";
import { approveTaskAction, requestRevisionAction } from "@/lib/server/actions/task";

type Result = { ok: true; message?: string } | { ok: false; error: string };

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Done");
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });
  return { pending, act };
}

/** Senior on Home: approve, or ask for changes with a short note — without opening the task. */
export function ReviewQuickActions({ taskId, label }: { taskId: string; label: string }) {
  const { pending, act } = useAct();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  return (
    <span className="flex items-center gap-1">
      <Button size="sm" variant="outline" className="h-7 px-2 text-meta text-emerald-800 hover:bg-emerald-50" disabled={pending} onClick={() => act(() => approveTaskAction({ taskId }))} aria-label={`Approve ${label}`}>
        <CheckIcon /> Approve
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-meta" disabled={pending} aria-label={`Ask for changes on ${label}`}>
            <RotateCcwIcon /> Changes
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3">
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (note.trim().length >= 3) act(() => requestRevisionAction({ taskId, note: note.trim() }), () => setOpen(false));
            }}
          >
            <label htmlFor={`chg-${taskId}`} className="text-meta text-slate-700">
              What needs to change?
            </label>
            <Textarea id={`chg-${taskId}`} value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus placeholder="e.g. Brighter background, bigger logo" />
            <Button type="submit" size="sm" variant="destructive" className="w-fit" disabled={pending || note.trim().length < 3}>
              <RotateCcwIcon /> Send back for changes
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </span>
  );
}

/** Maker on Home: jump straight to the "ready" form (links are added there). */
export function ReadyQuickAction({ productId, taskId, label }: { productId: string; taskId: string; label: string }) {
  return (
    <Button asChild size="sm" variant="outline" className="h-7 px-2 text-meta">
      <Link href={`/products/${productId}?task=${taskId}&ready=1`} aria-label={`Send ${label} for review`}>
        <SendIcon /> Send for review
      </Link>
    </Button>
  );
}

type Person = { id: string; name: string; avatarColor: string; avatarAssetId: string | null; role: Role; isMaster: boolean; brandAccess: string[] };

/** Unassigned work on Home: pick a person right in the row (eligible job role, and only people who can see the brand). */
export function AssignQuickAction({
  taskId,
  taskRole,
  brand,
  people,
  viewerIsAdmin,
}: {
  taskId: string;
  taskRole: Role;
  brand: { id: string; restricted: boolean } | null;
  people: Person[];
  viewerIsAdmin: boolean;
}) {
  const eligible = people.filter((p) => canSeeBrand(p, brand));
  return (
    <span className="inline-flex items-center gap-1.5 text-meta text-slate-600">
      <ReassignMenu taskId={taskId} assignee={null} people={eligible} taskRole={taskRole} canReassign viewerIsAdmin={viewerIsAdmin} />
      Assign
    </span>
  );
}
