"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, ExternalLinkIcon, FolderIcon, ImagePlusIcon, LockIcon, Loader2Icon, RotateCcwIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FOLLOW_UP_LABELS, TASK_TYPE_LABELS, TASK_TYPE_SHORT } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { canWorkOnTask } from "@/lib/domain/workflow";
import { markReadyAction, setBatchFolderAction } from "@/lib/server/actions/task";
import type { ProductDetail, TaskDTO } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/components/product/product-view";
import { ImageUploader } from "./image-uploader";

type Batch = ProductDetail["batches"][number];

/**
 * One Drive folder for the whole lane (pasted once), then a checklist:
 * "Website image ready? Landscape ready? …". Ticking sends that format for review.
 */
export function LaneFolderPanel({
  batch,
  lane,
  tasks,
  viewer,
}: {
  batch: Batch;
  lane: "images" | "videos";
  tasks: TaskDTO[];
  viewer: Viewer;
}) {
  const router = useRouter();
  const saved = (lane === "images" ? batch.imageFolderUrl : batch.videoFolderUrl) ?? "";
  const [url, setUrl] = useState(saved);
  const [editing, setEditing] = useState(!saved);
  const [pending, startTransition] = useTransition();
  const canEditFolder =
    viewer.role === "ADMIN" || can(viewer.role, "task.review") || tasks.some((t) => t.assignee?.id === viewer.id);
  const rows = tasks.filter((t) => t.status !== "CANCELLED");

  return (
    <section className="surface grid gap-3 rounded-panel p-3 sm:p-4" aria-label={`${lane === "images" ? "Image" : "Video"} folder and checklist`}>
      <div className="grid gap-2">
        <p className="flex items-center gap-2 text-meta text-slate-700">
          <FolderIcon className="size-4 text-slate-500" /> Google Drive folder for {lane === "images" ? "all images" : "all videos"} in this batch
        </p>
        {editing && canEditFolder ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const r = await setBatchFolderAction({ batchId: batch.id, lane, url });
                if (r.ok) {
                  toast.success(r.message);
                  setEditing(false);
                  router.refresh();
                } else toast.error(r.fieldErrors?.url?.[0] ?? r.error);
              });
            }}
          >
            <Input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="https://drive.google.com/drive/folders/…" aria-label="Google Drive folder link" />
            <div className="flex gap-2">
              {saved ? (
                <Button type="button" variant="outline" onClick={() => { setUrl(saved); setEditing(false); }}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={pending || !url.trim()}>
                Save folder
              </Button>
            </div>
          </form>
        ) : saved ? (
          <div className="flex flex-wrap items-center gap-2">
            <a href={saved} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 rounded-control bg-slate-50 px-3 py-2 text-body font-medium text-indigo-700 ring-1 ring-slate-200 hover:underline">
              <span className="truncate">{saved.replace(/^https?:\/\//, "")}</span>
              <ExternalLinkIcon className="size-3.5 shrink-0" />
            </a>
            {canEditFolder ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Change
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-meta font-normal text-slate-500">No folder yet. The {lane === "images" ? "image designer" : "video editor"} adds it once.</p>
        )}
      </div>

      <ul className="grid gap-1.5" aria-label="Ready for review">
        {rows.map((t) => (
          <FormatRow key={t.id} task={t} viewer={viewer} hasFolder={Boolean(saved)} />
        ))}
      </ul>
    </section>
  );
}

function FormatRow({ task, viewer, hasFolder }: { task: TaskDTO; viewer: Viewer; hasFolder: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [storeUrl, setStoreUrl] = useState(task.type === "STORE_LISTING" ? (task.submissions[0]?.items.find((i) => i.kind === "LINK")?.url ?? "") : "");
  const [previews, setPreviews] = useState<string[]>([]);
  const [showPreviews, setShowPreviews] = useState(false);
  const store = task.type === "STORE_LISTING";
  const canWork = canWorkOnTask(viewer, { assigneeId: task.assignee?.id ?? null });
  const locked = task.status === "LOCKED";
  const approved = task.status === "APPROVED";
  const submitted = task.status === "SUBMITTED";
  const checked = submitted || approved;
  const missingChecklist = task.checklist.filter((c) => c.required && !c.checked).length;
  const blockedReason = locked
    ? "Unlocks after step 1 is approved"
    : !store && !hasFolder
      ? "Add the Drive folder first"
      : store && !storeUrl.trim()
        ? "Add the store page URL"
        : missingChecklist
          ? `Tick ${missingChecklist} checklist item${missingChecklist === 1 ? "" : "s"} on the task below`
          : null;
  const disabled = pending || approved || locked || !canWork || (!checked && Boolean(blockedReason));
  const label = `${TASK_TYPE_LABELS[task.type]}${task.requestKind ? ` · ${FOLLOW_UP_LABELS[task.requestKind]}` : ""}`;

  function toggle(ready: boolean) {
    startTransition(async () => {
      const r = await markReadyAction({ taskId: task.id, ready, storeUrl, images: previews });
      if (r.ok) {
        toast.success(r.message);
        setPreviews([]);
        setShowPreviews(false);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <li className={cn("grid gap-2 rounded-control border px-3 py-2.5", task.status === "REVISION" ? "border-rose-200 bg-rose-50/40" : "border-slate-200/80 bg-white", locked && "bg-slate-50")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className={cn("flex min-w-0 flex-1 items-center gap-3", disabled && "cursor-not-allowed")}>
          {pending ? (
            <Loader2Icon className="size-[18px] animate-spin text-slate-500" />
          ) : locked ? (
            <LockIcon className="size-[18px] text-slate-400" />
          ) : (
            <Checkbox checked={checked} disabled={disabled} onCheckedChange={(v) => toggle(v === true)} aria-label={`${label} ready for review`} />
          )}
          <span className="min-w-0">
            <span className={cn("block text-body font-medium", locked ? "text-slate-600" : "text-slate-900")}>
              {TASK_TYPE_SHORT[task.type]} ready?
              {task.requestKind ? <span className="text-indigo-700"> · {FOLLOW_UP_LABELS[task.requestKind]}</span> : null}
            </span>
            <span className="block text-meta font-normal text-slate-500">
              {approved ? (
                <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2Icon className="size-3.5" /> Approved</span>
              ) : submitted ? (
                <span className="inline-flex items-center gap-1 text-indigo-700"><SendIcon className="size-3.5" /> In review{canWork ? " — untick to take it back" : ""}</span>
              ) : task.status === "REVISION" ? (
                <span className="inline-flex items-center gap-1 text-rose-700"><RotateCcwIcon className="size-3.5" /> Needs changes — fix, then tick again</span>
              ) : (
                (blockedReason ?? (canWork ? "Tick when it's in the folder" : `Waiting for ${task.assignee?.name ?? "someone"}`))
              )}
            </span>
          </span>
        </label>
        {store && canWork && !approved && !submitted && !locked ? (
          <Input value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} inputMode="url" placeholder="https://yourstore.com/products/…" aria-label="Live store product URL" className="sm:w-80" />
        ) : null}
        {!store && canWork && !approved && !submitted && !locked ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreviews((s) => !s)} aria-expanded={showPreviews}>
            <ImagePlusIcon /> Preview images {previews.length ? `(${previews.length})` : "(optional)"}
          </Button>
        ) : null}
      </div>
      {showPreviews ? <ImageUploader value={previews} onChange={setPreviews} /> : null}
    </li>
  );
}
