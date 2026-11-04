"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCheckIcon,
  CornerUpLeftIcon,
  MoreHorizontalIcon,
  PencilLineIcon,
  BanIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import type { KillReason, ProductStage, TaskType } from "@/generated/prisma/enums";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CREATIVE_TYPES,
  KILL_REASON_LABELS,
  KILL_REASONS,
  STAGE_LABELS,
  TASK_TYPE_LABELS,
} from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { isTerminalStage, sendBackTargets } from "@/lib/domain/workflow";
import { completeProductAction, requestBatchAction } from "@/lib/server/actions/campaign";
import { deleteProductAction, killProductAction, sendBackAction } from "@/lib/server/actions/exceptions";
import type { ProductDetail } from "@/lib/server/queries/product";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OverrideDialog } from "./override-dialog";
import type { Viewer } from "./product-view";

type DialogKey = "batch" | "complete" | "kill" | "delete" | "sendBack" | "override" | null;

export function ProductActions({ product, viewer }: { product: ProductDetail; viewer: Viewer }) {
  const [dialog, setDialog] = useState<DialogKey>(null);
  const live = product.stage === "LIVE";
  const terminal = isTerminalStage(product.stage);
  const canCampaign = can(viewer, "campaign.manage");
  const canBatch = can(viewer, "batch.request");
  const canKill = can(viewer, "product.kill") && !terminal;
  const targets = can(viewer, "product.sendBack") ? sendBackTargets(product.stage, viewer.role) : [];
  const canOverride = can(viewer, "product.override");
  const canDelete = viewer.role === "ADMIN" && product.stage === "KILLED";

  const menuItems = [
    live && canBatch ? { key: "batch" as const, label: "Request new creative batch", icon: SparklesIcon } : null,
    live && canCampaign ? { key: "complete" as const, label: "Mark completed", icon: CheckCheckIcon } : null,
    targets.length ? { key: "sendBack" as const, label: "Send back…", icon: CornerUpLeftIcon } : null,
    canOverride ? { key: "override" as const, label: "Admin override…", icon: PencilLineIcon } : null,
  ].filter(Boolean) as { key: DialogKey; label: string; icon: React.ComponentType }[];

  if (menuItems.length === 0 && !canKill && !canDelete) return null;

  return (
    <>
      {live && canBatch ? (
        <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={() => setDialog("batch")}>
          <SparklesIcon /> New batch
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="Product actions">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Product actions</DropdownMenuLabel>
          {menuItems.map((m) => (
            <DropdownMenuItem key={m.key} onSelect={() => setDialog(m.key)}>
              <m.icon /> {m.label}
            </DropdownMenuItem>
          ))}
          {canKill ? (
            <>
              {menuItems.length ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("kill")}>
                <BanIcon /> Drop product…
              </DropdownMenuItem>
            </>
          ) : null}
          {canDelete ? (
            <>
              {menuItems.length ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                <Trash2Icon /> Delete for good…
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <NewBatchDialog open={dialog === "batch"} onClose={() => setDialog(null)} product={product} />
      <CompleteDialog open={dialog === "complete"} onClose={() => setDialog(null)} product={product} />
      <KillDialog open={dialog === "kill"} onClose={() => setDialog(null)} product={product} canDelete={viewer.role === "ADMIN"} />
      {canDelete ? <DeleteDialog open={dialog === "delete"} onClose={() => setDialog(null)} product={product} /> : null}
      <SendBackDialog open={dialog === "sendBack"} onClose={() => setDialog(null)} product={product} targets={targets} />
      {canOverride ? <OverrideDialog open={dialog === "override"} onClose={() => setDialog(null)} product={product} /> : null}
    </>
  );
}

type DialogProps = { open: boolean; onClose: () => void; product: ProductDetail };

/** Shared wrapper: runs an action, toasts, refreshes, closes. */
function useRun(onClose: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string[]> }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Done");
        setErrors({});
        onClose();
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error ?? "Something went wrong");
      }
    });
  }
  return { pending, errors, run };
}

function defaultDueDate(): string {
  const d = new Date(Date.now() + 3 * 86_400_000 + 6 * 3_600_000);
  return d.toISOString().slice(0, 10);
}

function NewBatchDialog({ open, onClose, product }: DialogProps) {
  const [name, setName] = useState("");
  const [types, setTypes] = useState<TaskType[]>([]);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [reason, setReason] = useState("");
  const [brief, setBrief] = useState(product.creativeBrief ?? "");
  const { pending, errors, run } = useRun(() => {
    setTypes([]);
    setReason("");
    setName("");
    onClose();
  });
  const next = product.batches.reduce((m, b) => Math.max(m, b.number), 0) + 1;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New creative batch #{next}</DialogTitle>
          <DialogDescription>For creative fatigue or a new angle. The campaign keeps running and the product stays live.</DialogDescription>
        </DialogHeader>
        <Field id="nb-name" label="Batch name *" hint="Shown on the boards, e.g. “Eid offer angles”" error={errors.name?.[0]}>
          <Input {...fieldA11y("nb-name", errors.name?.[0], true)} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Winter UGC angles" autoFocus />
        </Field>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-meta text-slate-700">Formats needed *</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {CREATIVE_TYPES.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2.5 rounded-control border border-slate-200 bg-white px-3 py-2 text-body hover:bg-slate-50">
                <Checkbox
                  checked={types.includes(t)}
                  onCheckedChange={(v) => setTypes((cur) => (v === true ? [...cur, t] : cur.filter((x) => x !== t)))}
                />
                {TASK_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
          {errors.types?.[0] ? <p className="text-meta text-rose-700">{errors.types[0]}</p> : null}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="nb-due" label="Due date *" hint="End of day, Dhaka time" error={errors.dueDate?.[0]}>
            <Input {...fieldA11y("nb-due", errors.dueDate?.[0], true)} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="num" />
          </Field>
          <Field id="nb-reason" label="Reason (optional)">
            <Input id="nb-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. CTR dropping" />
          </Field>
        </div>
        <Field id="nb-brief" label="Update the creative brief">
          <Textarea id="nb-brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={5} className="font-mono text-[13px]" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || types.length === 0 || !dueDate || name.trim().length < 2}
            onClick={() => run(() => requestBatchAction({ productId: product.id, name, types, dueDate, reason, brief }))}
          >
            <SparklesIcon /> Request batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteDialog({ open, onClose, product }: DialogProps) {
  const openTasks = product.tasks.filter((t) => ["LOCKED", "TODO", "SUBMITTED", "REVISION"].includes(t.status)).length;
  const { pending, run } = useRun(onClose);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {product.name} completed?</DialogTitle>
          <DialogDescription>
            Use this when the campaign has ended normally. The campaign is marked stopped
            {openTasks ? ` and ${openTasks} open task${openTasks === 1 ? " is" : "s are"} cancelled` : ""}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => run(() => completeProductAction({ productId: product.id }))}>
            <CheckCheckIcon /> Mark completed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KillDialog({ open, onClose, product, canDelete }: DialogProps & { canDelete: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState<KillReason | "">("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function drop(thenDelete: boolean) {
    startTransition(async () => {
      const r = await killProductAction({ productId: product.id, reason, note });
      if (!r.ok) {
        toast.error(r.error ?? "Something went wrong");
        return;
      }
      if (thenDelete) {
        const d = await deleteProductAction({ productId: product.id });
        if (!d.ok) {
          toast.error(d.error ?? "Dropped, but it couldn't be deleted");
          onClose();
          router.refresh();
          return;
        }
        toast.success(d.message ?? "Deleted");
        onClose();
        router.replace("/products");
        router.refresh();
        return;
      }
      toast.success(r.message ?? "Dropped");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Drop {product.name}?</DialogTitle>
          <DialogDescription>Open tasks are cancelled and it moves to Dropped.</DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-meta text-slate-700">Why? (optional)</legend>
          <div role="radiogroup" aria-label="Why it's dropped" className="flex flex-wrap gap-1.5">
            {KILL_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(reason === r ? "" : r)}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1.5 text-meta ring-1 transition-colors duration-150 ring-inset focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  reason === r ? "bg-rose-700 text-white ring-rose-700" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {KILL_REASON_LABELS[r]}
              </button>
            ))}
          </div>
        </fieldset>
        <Textarea aria-label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (optional)" />
        <DialogFooter className="gap-2 sm:justify-between">
          {canDelete ? (
            <Button variant="ghost" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" disabled={pending} onClick={() => drop(true)}>
              <Trash2Icon /> Drop &amp; delete for good
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => drop(false)}>
              <BanIcon /> Drop
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ open, onClose, product }: DialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {product.name} for good?</DialogTitle>
          <DialogDescription>It disappears with its tasks, comments, orders and campaigns. This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            autoFocus
            onClick={() =>
              startTransition(async () => {
                const r = await deleteProductAction({ productId: product.id });
                if (r.ok) {
                  toast.success(r.message ?? "Deleted");
                  onClose();
                  router.replace("/products");
                  router.refresh();
                } else toast.error(r.error ?? "Something went wrong");
              })
            }
          >
            <Trash2Icon /> Delete for good
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendBackDialog({ open, onClose, product, targets }: DialogProps & { targets: ProductStage[] }) {
  const [target, setTarget] = useState<ProductStage | "">(targets.length === 1 ? targets[0]! : "");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const { pending, errors, run } = useRun(onClose);
  const latest = product.batches.reduce<ProductDetail["batches"][number] | null>((m, b) => (!m || b.number > m.number ? b : m), null);
  const reopenable = product.tasks.filter(
    (t) => latest && t.batchId === latest.id && t.status === "APPROVED" && (CREATIVE_TYPES as readonly string[]).concat("STORE_LISTING").includes(t.type),
  );
  const disabled = pending || !target || note.trim().length < 3 || (target === "CREATIVE" && picked.length === 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send back</DialogTitle>
          <DialogDescription>
            {target === "RESEARCH"
              ? "Open creative work is cancelled and research reopens. Resubmitting starts a fresh creative batch."
              : target === "CREATIVE"
                ? "The chosen tasks reopen for revision and the launch task is cancelled."
                : "Choose where this product goes back to."}
          </DialogDescription>
        </DialogHeader>
        <Field id="sb-target" label="Send back to *">
          <Select value={target} onValueChange={(v) => setTarget(v as ProductStage)}>
            <SelectTrigger id="sb-target">
              <SelectValue placeholder="Choose a stage" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((t) => (
                <SelectItem key={t} value={t}>
                  {STAGE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {target === "CREATIVE" ? (
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-meta text-slate-700">Tasks to reopen *</legend>
            {reopenable.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2.5 rounded-control border border-slate-200 bg-white px-3 py-2 text-body hover:bg-slate-50">
                <Checkbox
                  checked={picked.includes(t.id)}
                  onCheckedChange={(v) => setPicked((cur) => (v === true ? [...cur, t.id] : cur.filter((x) => x !== t.id)))}
                />
                <span className="flex-1">{TASK_TYPE_LABELS[t.type]}</span>
                <span className="text-meta text-slate-500">{t.assignee?.name}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <Field id="sb-note" label="Note for the team *" error={errors.note?.[0]}>
          <Textarea {...fieldA11y("sb-note", errors.note?.[0])} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={disabled}
            onClick={() => run(() => sendBackAction({ productId: product.id, target: target as ProductStage, note, reopenTaskIds: picked }))}
          >
            <CornerUpLeftIcon /> Send back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
