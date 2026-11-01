"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { approveTaskAction, requestRevisionAction } from "@/lib/server/actions/task";

export function ReviewActions({ taskId, label }: { taskId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-control border border-indigo-100 bg-indigo-50/50 p-3 sm:flex-row sm:items-center">
      <p className="flex-1 text-body text-indigo-900">Waiting for your review.</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setOpen(true)} disabled={pending} className="flex-1 sm:flex-none">
          <RotateCcwIcon /> Request revision
        </Button>
        <Button
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 sm:flex-none"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await approveTaskAction({ taskId });
              if (r.ok) {
                toast.success(r.message);
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          <CheckIcon /> Approve
        </Button>
      </div>
      <RevisionModal open={open} onOpenChange={setOpen} taskId={taskId} label={label} />
    </div>
  );
}

export function RevisionModal({
  open,
  onOpenChange,
  taskId,
  label,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskId: string;
  label: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="grid gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await requestRevisionAction({ taskId, note });
              if (!r.ok) {
                setError(r.fieldErrors?.note?.[0] ?? r.error);
                return;
              }
              toast.success(r.message);
              setNote("");
              setError(undefined);
              onOpenChange(false);
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Request a revision</DialogTitle>
            <DialogDescription>{label} goes back to the assignee with your note at the top.</DialogDescription>
          </DialogHeader>
          <Field id="rev-note" label="What needs to change? (required)" error={error}>
            <Textarea
              {...fieldA11y("rev-note", error)}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              autoFocus
              placeholder="e.g. The hook needs to show the problem in the first 2 seconds."
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending || note.trim().length < 3}>
              Send for revision
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
