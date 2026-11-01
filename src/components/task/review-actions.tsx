"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import type { FollowUpKind } from "@/generated/prisma/enums";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FOLLOW_UP_KINDS, FOLLOW_UP_LABELS } from "@/lib/domain/labels";
import { approveTaskAction, requestRevisionAction } from "@/lib/server/actions/task";
import { cn } from "@/lib/utils";

export function ReviewActions({ taskId, label, assignee }: { taskId: string; label: string; assignee: string | null }) {
  const [revising, setRevising] = useState(false);
  const [approving, setApproving] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-control border border-indigo-100 bg-indigo-50/50 p-3 sm:flex-row sm:items-center">
      <p className="flex-1 text-body text-indigo-950">
        <span className="font-semibold">Your review.</span> Like or dislike each item above, comment if needed, then decide.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setRevising(true)} className="flex-1 sm:flex-none">
          <RotateCcwIcon /> Ask for changes
        </Button>
        <Button className="flex-1 bg-emerald-700 hover:bg-emerald-800 sm:flex-none" onClick={() => setApproving(true)}>
          <CheckIcon /> Approve
        </Button>
      </div>
      <RevisionModal open={revising} onOpenChange={setRevising} taskId={taskId} label={label} />
      <ApproveDialog open={approving} onOpenChange={setApproving} taskId={taskId} label={label} assignee={assignee} />
    </div>
  );
}

/** Approve, optionally also asking for a different angle / size (creates a follow-up task). */
function ApproveDialog({
  open,
  onOpenChange,
  taskId,
  label,
  assignee,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskId: string;
  label: string;
  assignee: string | null;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<FollowUpKind | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve {label}</DialogTitle>
          <DialogDescription>Approving unlocks the next steps. You can also ask {assignee ?? "the designer"} for something more.</DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-meta text-slate-700">Also ask for (optional)</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {[null, ...FOLLOW_UP_KINDS].map((k) => (
              <button
                key={k ?? "none"}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-body ring-1 ring-inset transition-colors",
                  kind === k ? "bg-primary text-white ring-primary" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {k ? FOLLOW_UP_LABELS[k] : "Nothing more"}
              </button>
            ))}
          </div>
        </fieldset>
        {kind ? (
          <Field id={`fu-${taskId}`} label="What exactly do you need?">
            <Textarea
              id={`fu-${taskId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={kind === "DIFFERENT_SIZE" ? "e.g. 1080×1350 for feed" : "e.g. Show it folded, from the side"}
            />
          </Field>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-700 hover:bg-emerald-800"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await approveTaskAction({ taskId, followUp: kind ? { kind, note } : null });
                if (!r.ok) {
                  toast.error(r.error);
                  return;
                }
                toast.success(r.message);
                onOpenChange(false);
                setKind(null);
                setNote("");
                router.refresh();
              })
            }
          >
            <CheckIcon /> {kind ? `Approve & ask for ${FOLLOW_UP_LABELS[kind].toLowerCase()}` : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RevisionModal({ open, onOpenChange, taskId, label }: { open: boolean; onOpenChange: (o: boolean) => void; taskId: string; label: string }) {
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
            <DialogTitle>Ask for changes</DialogTitle>
            <DialogDescription>{label} goes back with your note at the top. Your 👍/👎 and comments on each image stay visible.</DialogDescription>
          </DialogHeader>
          <Field id="rev-note" label="What needs to change? (required)" error={error}>
            <Textarea {...fieldA11y("rev-note", error)} value={note} onChange={(e) => setNote(e.target.value)} rows={4} autoFocus placeholder="e.g. Use a plain white background, product bigger in frame." />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending || note.trim().length < 3}>
              Send back for changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
