"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLinkIcon, LinkIcon, PlusIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { ManualTaskStatus, Priority } from "@/generated/prisma/enums";
import { Field, fieldA11y } from "@/components/common/field";
import { MentionComposer } from "@/components/common/mention-composer";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/domain/labels";
import { canEditManualTask, MANUAL_STATUS_LABELS, MANUAL_STATUSES, manualTaskRef } from "@/lib/domain/manual-tasks";
import { splitMentions } from "@/lib/domain/mentions";
import { formatDateTime, formatRelative } from "@/lib/format";
import {
  addManualCommentAction,
  createManualTaskAction,
  deleteManualTaskAction,
  moveManualTaskAction,
  updateManualTaskAction,
} from "@/lib/server/actions/manual-tasks";
import type { ManualBoard, ManualTaskDTO } from "@/lib/server/queries/manual-tasks";

const NONE = "none";

/** ISO instant → "YYYY-MM-DDTHH:mm" in Dhaka (for datetime-local). */
function toDhakaLocal(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 6 * 3_600_000).toISOString().slice(0, 16);
}
/** "YYYY-MM-DDTHH:mm" in Dhaka → ISO instant. */
function fromDhakaLocal(v: string): string | null {
  return v ? new Date(`${v}:00+06:00`).toISOString() : null;
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type Viewer = { id: string; role: string };

export function ManualTaskDialog({
  open,
  onOpenChange,
  task,
  board,
  viewer,
  startStatus = "TODO",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** null = a new task. */
  task: ManualTaskDTO | null;
  board: ManualBoard;
  viewer: Viewer;
  startStatus?: ManualTaskStatus;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:data-[state=open]:slide-in-from-bottom-8"
        aria-describedby={undefined}
      >
        {open ? <Body key={task?.id ?? "new"} task={task} board={board} viewer={viewer} startStatus={startStatus} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({ task, board, viewer, startStatus, onDone }: { task: ManualTaskDTO | null; board: ManualBoard; viewer: Viewer; startStatus: ManualTaskStatus; onDone: () => void }) {
  const router = useRouter();
  const editable = !task || canEditManualTask(viewer, task);
  const canDelete = task && (viewer.role === "ADMIN" || task.createdById === viewer.id);
  const [v, setV] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: (task?.priority ?? "MEDIUM") as Priority,
    due: toDhakaLocal(task?.dueAt ?? null),
    assigneeId: task?.assigneeId ?? "",
    productId: task?.product?.id ?? "",
    links: task?.links ?? [],
    status: (task?.status ?? startStatus) as ManualTaskStatus,
  });
  const [newLink, setNewLink] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const err = (k: string) => errors[k]?.[0];
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  function addLink() {
    const url = newLink.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Paste a full link starting with https://");
      return;
    }
    set("links", [...v.links, url]);
    setNewLink("");
  }

  function save() {
    startTransition(async () => {
      const fields = {
        title: v.title,
        description: v.description,
        priority: v.priority,
        dueAt: fromDhakaLocal(v.due),
        assigneeId: v.assigneeId,
        productId: v.productId,
        links: newLink.trim() ? [...v.links, newLink.trim()] : v.links,
      };
      const r = task ? await updateManualTaskAction({ manualTaskId: task.id, ...fields }) : await createManualTaskAction({ ...fields, status: v.status });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      if (task && v.status !== task.status) {
        const m = await moveManualTaskAction({ manualTaskId: task.id, status: v.status });
        if (!m.ok) toast.error(m.error);
      }
      toast.success(r.message ?? "Saved");
      onDone();
      router.refresh();
    });
  }

  return (
    <>
      <div className="border-b border-slate-100 py-4 pr-12 pl-5">
        <div className="min-w-0">
          <p className="num text-meta text-slate-500">{task ? manualTaskRef(task.number) : "New task"}</p>
          <DialogTitle className="text-section text-slate-900">{task ? task.title : "Add a task"}</DialogTitle>
          {task ? (
            <DialogDescription className="text-meta font-normal text-slate-500">
              Added by {task.createdBy.name} · {formatRelative(new Date(task.createdAt))}
            </DialogDescription>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-5 overflow-y-auto px-5 py-4">
        <div className="grid gap-3">
          <Field id="mt-title" label="Title *" error={err("title")}>
            <Input {...fieldA11y("mt-title", err("title"))} value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={140} disabled={!editable} autoFocus={!task} />
          </Field>
          <Field id="mt-desc" label="Details" error={err("description")}>
            <Textarea {...fieldA11y("mt-desc", err("description"))} value={v.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="What needs doing, and what does done look like?" disabled={!editable} />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field id="mt-status" label="Status">
              <Select value={v.status} onValueChange={(s) => set("status", s as ManualTaskStatus)} disabled={!editable}>
                <SelectTrigger id="mt-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {MANUAL_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="mt-priority" label="Urgency">
              <Select value={v.priority} onValueChange={(p) => set("priority", p as Priority)} disabled={!editable}>
                <SelectTrigger id="mt-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="mt-due" label="Due (Dhaka time)" error={err("dueAt")} className="col-span-2">
              <Input {...fieldA11y("mt-due", err("dueAt"))} type="datetime-local" value={v.due} onChange={(e) => set("due", e.target.value)} className="num" disabled={!editable} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="mt-assignee" label="Assigned to">
              <Select value={v.assigneeId || NONE} onValueChange={(id) => set("assigneeId", id === NONE ? "" : id)} disabled={!editable}>
                <SelectTrigger id="mt-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nobody yet</SelectItem>
                  {board.people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.id === viewer.id ? " (me)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="mt-product" label="Product (optional)">
              <Select value={v.productId || NONE} onValueChange={(id) => set("productId", id === NONE ? "" : id)} disabled={!editable}>
                <SelectTrigger id="mt-product">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not about a product</SelectItem>
                  {board.products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <section aria-labelledby="mt-links-h" className="grid gap-2">
            <h3 id="mt-links-h" className="text-meta text-slate-700">
              Files &amp; links
            </h3>
            {v.links.length ? (
              <ul className="grid gap-1.5">
                {v.links.map((l, i) => (
                  <li key={`${l}-${i}`} className="flex items-center gap-2 rounded-control bg-slate-50 px-2.5 py-1.5">
                    <LinkIcon className="size-3.5 shrink-0 text-slate-500" aria-hidden />
                    <a href={l} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-body text-primary underline-offset-2 hover:underline">
                      {host(l)}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    <ExternalLinkIcon className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                    {editable ? (
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove link ${host(l)}`} onClick={() => set("links", v.links.filter((_, j) => j !== i))}>
                        <XIcon />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-meta font-normal text-slate-500">No files yet. Paste a Google Drive, Docs or any link.</p>
            )}
            {editable ? (
              <div className="flex gap-2">
                <Input
                  aria-label="Add a link"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLink();
                    }
                  }}
                  placeholder="https://drive.google.com/…"
                  inputMode="url"
                />
                <Button variant="outline" onClick={addLink}>
                  <PlusIcon /> Add
                </Button>
              </div>
            ) : null}
            {err("links") ? <p className="text-meta text-rose-700">{err("links")}</p> : null}
          </section>
        </div>

        {task ? <Comments task={task} board={board} /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
        {canDelete ? (
          <Button
            variant="ghost"
            className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete ${manualTaskRef(task.number)} “${task.title}”? This can't be undone.`)) return;
              startTransition(async () => {
                const r = await deleteManualTaskAction({ manualTaskId: task.id });
                if (r.ok) {
                  toast.success(r.message ?? "Deleted");
                  onDone();
                  router.refresh();
                } else toast.error(r.error);
              });
            }}
          >
            <Trash2Icon /> Delete
          </Button>
        ) : null}
        {!editable ? <p className="text-meta font-normal text-slate-500">Only the creator, the assignee or an Admin can change this task. You can still comment.</p> : null}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={onDone} disabled={pending}>
            {editable ? "Cancel" : "Close"}
          </Button>
          {editable ? (
            <Button onClick={save} disabled={pending || v.title.trim().length < 2}>
              <SaveIcon /> {task ? "Save" : "Add task"}
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Comments({ task, board }: { task: ManualTaskDTO; board: ManualBoard }) {
  const router = useRouter();
  return (
    <section aria-labelledby="mt-comments-h" className="grid gap-3 border-t border-slate-100 pt-4">
      <h3 id="mt-comments-h" className="text-section text-slate-900">
        Comments {task.comments.length ? <span className="num text-meta text-slate-500">{task.comments.length}</span> : null}
      </h3>
      {task.comments.length === 0 ? <p className="text-meta font-normal text-slate-500">No comments yet. Questions, updates and decisions about this task go here.</p> : null}
      <ol className="grid gap-3">
        {task.comments.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <UserAvatar name={c.author.name} color={c.author.avatarColor} imageId={c.author.avatarAssetId} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-meta">
                <span className="font-semibold text-slate-900">{c.author.name}</span>{" "}
                <time className="font-normal text-slate-500" dateTime={c.createdAt} title={formatDateTime(new Date(c.createdAt))}>
                  {formatRelative(new Date(c.createdAt))}
                </time>
              </p>
              <CommentBody body={c.body} people={board.people} />
            </div>
          </li>
        ))}
      </ol>
      <MentionComposer
        people={board.people}
        placeholder="Write a comment… use @ to mention someone"
        onSubmit={async (body) => {
          const r = await addManualCommentAction({ manualTaskId: task.id, body });
          if (!r.ok) {
            toast.error(r.error);
            return false;
          }
          router.refresh();
          return true;
        }}
      />
    </section>
  );
}

function CommentBody({ body, people }: { body: string; people: ManualBoard["people"] }) {
  const parts = useMemo(() => splitMentions(body, people), [body, people]);
  return (
    <p className="text-body whitespace-pre-wrap [overflow-wrap:anywhere] text-slate-800">
      {parts.map((p, i) =>
        p.mentionId ? (
          <span key={i} className="rounded bg-indigo-50 px-0.5 font-medium text-indigo-700">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}
