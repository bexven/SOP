"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ExternalLinkIcon, GlobeIcon, Loader2Icon, LockIcon, MessageSquareIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { DuePill } from "@/components/common/pills";
import { PersonChip, UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { BriefCard } from "@/components/product/brief-card";
import { ResourcesCard } from "./resources-card";
import type { Viewer } from "@/components/product/product-view";
import { boardGroupOf, FOLLOW_UP_LABELS, laneOf, TASK_TYPE_LABELS, TASK_TYPE_SHORT } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { isTerminalStage } from "@/lib/domain/workflow";
import { formatDate } from "@/lib/format";
import { setWebsiteLinkAction } from "@/lib/server/actions/task";
import type { ProductDetail, TaskDTO } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";
import { TaskDialog } from "./task-dialog";

type Col = "todo" | "review" | "revision" | "approved";
const COLS: { key: Col; title: string; dot: string; empty: string }[] = [
  { key: "todo", title: "To do", dot: "bg-slate-400", empty: "Nothing to start" },
  { key: "review", title: "In review", dot: "bg-indigo-500", empty: "Nothing waiting for a Senior" },
  { key: "revision", title: "Needs changes", dot: "bg-rose-500", empty: "No changes asked" },
  { key: "approved", title: "Approved", dot: "bg-emerald-500", empty: "Nothing approved yet" },
];
const STRIPE: Record<Col, string> = { todo: "before:bg-slate-300", review: "before:bg-indigo-500", revision: "before:bg-rose-500", approved: "before:bg-emerald-500" };
const GROUP_LABEL = { website: "Website images", metaAds: "Meta ads", videos: "Video" } as const;

function colOf(t: TaskDTO): Col | null {
  if (t.status === "LOCKED" || t.status === "TODO") return "todo";
  if (t.status === "SUBMITTED") return "review";
  if (t.status === "REVISION") return "revision";
  if (t.status === "APPROVED") return "approved";
  return null;
}

/** Step order inside a batch: website → portrait → square; main → square; follow-ups after their original. */
function ordered(tasks: TaskDTO[]): TaskDTO[] {
  const rank = (t: TaskDTO) => (boardGroupOf(t.type) === "website" ? 0 : 1) * 10 + t.phase;
  const roots = tasks.filter((t) => !t.followUpOfId || !tasks.some((x) => x.id === t.followUpOfId)).sort((a, b) => rank(a) - rank(b));
  const out: TaskDTO[] = [];
  const visit = (t: TaskDTO) => {
    out.push(t);
    tasks.filter((x) => x.followUpOfId === t.id).forEach(visit);
  };
  roots.forEach(visit);
  return out;
}

type Batch = ProductDetail["batches"][number];
const batchTitle = (b: Batch) => b.name || (b.number === 1 ? "First creatives" : `Batch #${b.number}`);

/**
 * Image or video creative for one product: brief on top, then one board per
 * batch (pick the batch). Click a card to open the task: links, Approve /
 * Needs changes and the task's own discussion.
 */
export function CreativePhase({
  product,
  viewer,
  lane,
  focusTaskId,
  openReady,
}: {
  product: ProductDetail;
  viewer: Viewer;
  lane: "images" | "videos";
  focusTaskId?: string;
  openReady?: boolean;
}) {
  const laneTasks = product.tasks.filter((t) => laneOf(t.type) === lane && t.status !== "CANCELLED");
  const batches = [...product.batches].sort((a, b) => b.number - a.number).filter((b) => laneTasks.some((t) => t.batchId === b.id));
  const focus = laneTasks.find((t) => t.id === focusTaskId);
  const [batchId, setBatchId] = useState<string | undefined>(focus?.batchId ?? batches[0]?.id);
  const [openId, setOpenId] = useState<string | null>(focus?.id ?? null);
  const [startReady, setStartReady] = useState(Boolean(openReady && focus));
  const batch = batches.find((b) => b.id === batchId) ?? batches[0];
  const tasks = batch ? ordered(laneTasks.filter((t) => t.batchId === batch.id)) : [];
  const openTask = laneTasks.find((t) => t.id === openId) ?? null;
  const approved = tasks.filter((t) => t.status === "APPROVED").length;
  const canEditBrief = can(viewer, "brief.edit") && !isTerminalStage(product.stage);
  const commentCount = (id: string) => product.comments.filter((c) => c.taskId === id).length;
  const parentOf = (t: TaskDTO) => (t.dependsOnId ? laneTasks.find((x) => x.id === t.dependsOnId) ?? product.tasks.find((x) => x.id === t.dependsOnId) : undefined);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <BriefCard productId={product.id} brief={product.creativeBrief} updatedAt={product.creativeBriefUpdatedAt} canEdit={canEditBrief} />
      {lane === "images" ? <WebsiteLinkCard product={product} viewer={viewer} /> : null}
      <ResourcesCard product={product} viewer={viewer} lane={lane} />

      {!batch ? (
        <p className="surface rounded-panel px-4 py-8 text-center text-body text-slate-600">
          No {lane === "images" ? "image" : "video"} tasks yet. They are created when the product is approved for testing, or when the media buyer requests a new batch.
        </p>
      ) : (
        <section aria-label="Creative board" className="surface grid gap-4 rounded-panel p-3 sm:p-4">
          {batches.length > 1 ? (
            <div role="tablist" aria-label="Batches" className="no-scrollbar relative -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {batches.map((b) => {
                const active = b.id === batch.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setBatchId(b.id)}
                    className={cn(
                      "relative inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-meta whitespace-nowrap transition-colors duration-200",
                      active ? "text-white" : "text-slate-700 hover:bg-slate-900/[0.05] hover:text-slate-900",
                    )}
                  >
                    {active ? (
                      <motion.span layoutId={`batch-pill-${lane}`} className="absolute inset-0 rounded-full bg-primary shadow-sm" transition={{ type: "spring", bounce: 0.18, duration: 0.4 }} />
                    ) : null}
                    <span className="num relative">#{b.number}</span>
                    <span className="relative font-semibold">{batchTitle(b)}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-section text-slate-900">
                <span className="num text-slate-500">#{batch.number}</span> {batchTitle(batch)}
              </h2>
              <span className="flex flex-wrap items-center gap-1.5 text-meta font-normal text-slate-500">
                {batch.number > 1 ? (
                  <>
                    requested by <PersonChip person={batch.requestedBy} />
                  </>
                ) : null}
                <span className="num">{formatDate(new Date(batch.createdAt))}</span>
                {batch.dueAt ? <DuePill dueAt={batch.dueAt} /> : null}
              </span>
            </div>
            <Progress approved={approved} total={tasks.length} />
          </div>
          {batch.reason ? <p className="-mt-2 px-1 text-meta font-normal text-slate-600">“{batch.reason}”</p> : null}

          <LayoutGroup id={`board-${lane}`}>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-4">
              {COLS.map((c) => {
                const items = tasks.filter((t) => colOf(t) === c.key);
                return (
                  <div key={c.key} className={cn("flex flex-col gap-2 rounded-control bg-slate-900/[0.025] p-2 md:min-h-32", items.length === 0 && "py-1.5 md:py-2")}>
                    <h3 className="flex items-center gap-2 px-1.5 pt-0.5 text-meta font-semibold text-slate-700">
                      <span className={cn("size-2 rounded-full", c.dot)} aria-hidden />
                      {c.title}
                      <span className="num ml-auto font-medium text-slate-500">{items.length}</span>
                    </h3>
                    <ul className="grid gap-2">
                      {items.map((t) => (
                        <TaskCardButton
                          key={t.id}
                          task={t}
                          col={c.key}
                          comments={commentCount(t.id)}
                          parentShort={parentOf(t) ? TASK_TYPE_SHORT[parentOf(t)!.type] : null}
                          onOpen={() => {
                            setStartReady(false);
                            setOpenId(t.id);
                          }}
                        />
                      ))}
                    </ul>
                    {items.length === 0 ? <p className="hidden px-2 py-4 text-center text-meta font-normal text-slate-500 md:block">{c.empty}</p> : null}
                  </div>
                );
              })}
            </div>
          </LayoutGroup>
        </section>
      )}

      <TaskDialog
        task={openTask}
        product={product}
        viewer={viewer}
        open={Boolean(openTask)}
        onOpenChange={(o) => {
          if (!o) {
            setOpenId(null);
            setStartReady(false);
          }
        }}
        startReady={startReady}
        parentLabel={openTask && parentOf(openTask) ? TASK_TYPE_SHORT[parentOf(openTask)!.type] : null}
        batchLabel={openTask ? batchTitle(product.batches.find((b) => b.id === openTask.batchId) ?? batch!) : ""}
      />
    </div>
  );
}

function Progress({ approved, total }: { approved: number; total: number }) {
  const pct = total ? Math.round((approved / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5" aria-label={`${approved} of ${total} approved`}>
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200/80" aria-hidden>
        <motion.div className="h-full rounded-full bg-emerald-500" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <span className="num text-meta text-slate-600">
        {approved}/{total} approved
      </span>
    </div>
  );
}

function TaskCardButton({
  task,
  col,
  comments,
  parentShort,
  onOpen,
}: {
  task: TaskDTO;
  col: Col;
  comments: number;
  parentShort: string | null;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  const locked = task.status === "LOCKED";
  const group = boardGroupOf(task.type);
  return (
    <motion.li layout={!reduce} layoutId={reduce ? undefined : task.id} transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group relative w-full overflow-hidden rounded-control border bg-white p-3 pl-3.5 text-left shadow-[0_1px_2px_rgb(15_23_42/0.05)] outline-none",
          "before:absolute before:inset-y-0 before:left-0 before:w-1",
          "transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[var(--raised-shadow)] active:translate-y-0 active:scale-[0.985]",
          "focus-visible:ring-2 focus-visible:ring-ring/50",
          STRIPE[col],
          locked ? "border-dashed border-slate-300 bg-slate-50 before:bg-slate-200" : "border-slate-200/90",
        )}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          {locked ? <LockIcon className="size-3" aria-hidden /> : null}
          {group ? GROUP_LABEL[group] : "Creative"}
        </span>
        <span className={cn("mt-0.5 block text-body leading-snug font-medium", locked ? "text-slate-600" : "text-slate-900 group-hover:text-primary")}>
          {TASK_TYPE_LABELS[task.type].replace(/^Meta ad images · /, "")}
          {task.requestKind ? <span className="text-primary"> · {FOLLOW_UP_LABELS[task.requestKind]}</span> : null}
        </span>
        {locked ? (
          <span className="mt-1 block text-meta font-normal text-slate-500">After {parentShort?.toLowerCase() ?? "the step before"} {parentShort?.endsWith("s") ? "are" : "is"} approved</span>
        ) : task.status === "REVISION" && task.revisionNote ? (
          <span className="mt-1 line-clamp-2 block text-meta text-rose-700">“{task.revisionNote}”</span>
        ) : null}
        <span className="mt-2.5 flex items-center gap-2">
          {task.assignee ? (
            <UserAvatar name={task.assignee.name} color={task.assignee.avatarColor} imageId={task.assignee.avatarAssetId} size="xs" />
          ) : (
            <span className="size-5 rounded-full border border-dashed border-slate-300" aria-hidden />
          )}
          <span className="truncate text-meta text-slate-600">{task.assignee?.name ?? "Unassigned"}</span>
          <span className="ml-auto flex items-center gap-1.5">
            {comments ? (
              <span className="inline-flex items-center gap-0.5 text-meta text-slate-500" aria-label={`${comments} comments`}>
                <MessageSquareIcon className="size-3.5" /> <span className="num">{comments}</span>
              </span>
            ) : null}
            {!locked && task.status !== "APPROVED" ? <DuePill dueAt={task.dueAt} /> : null}
          </span>
        </span>
      </button>
    </motion.li>
  );
}

/** "Is the product added on the website?" — tick, paste the link, save. */
function WebsiteLinkCard({ product, viewer }: { product: ProductDetail; viewer: Viewer }) {
  const router = useRouter();
  const [added, setAdded] = useState(Boolean(product.websiteUrl));
  const [url, setUrl] = useState(product.websiteUrl ?? "");
  const [pending, startTransition] = useTransition();
  const designer = product.tasks.some((t) => t.type === "WEBSITE_IMAGE" && t.assignee?.id === viewer.id);
  const canEdit = designer || can(viewer, "task.review");
  const dirty = added !== Boolean(product.websiteUrl) || (added && url.trim() !== (product.websiteUrl ?? ""));
  const valid = !added || /^https?:\/\/\S+\.\S+/.test(url.trim());

  return (
    <section aria-label="Product on the website" className="surface flex flex-col gap-3 rounded-panel p-4 sm:flex-row sm:items-center">
      <span className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-control bg-accent text-accent-foreground">
          <GlobeIcon className="size-4" />
        </span>
        <label className={cn("flex items-center gap-2.5 text-body font-medium text-slate-900", canEdit ? "cursor-pointer" : "cursor-default")}>
          <Checkbox checked={added} disabled={!canEdit || pending} onCheckedChange={(v) => setAdded(v === true)} aria-label="Is the product added on the website?" />
          Is the product added on the website?
        </label>
      </span>
      {added ? (
        canEdit ? (
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              startTransition(async () => {
                const r = await setWebsiteLinkAction({ productId: product.id, added, url: url.trim() });
                if (r.ok) {
                  toast.success(r.message);
                  router.refresh();
                } else toast.error(r.error);
              });
            }}
          >
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourstore.com/products/…" inputMode="url" aria-label="Product link on the website" aria-invalid={!valid || undefined} />
            {product.websiteUrl && !dirty ? (
              <Button asChild variant="brandSoft" className="shrink-0">
                <a href={product.websiteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon /> Open
                </a>
              </Button>
            ) : (
              <Button type="submit" className="shrink-0" disabled={pending || !dirty || !valid || !url.trim()}>
                {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save link
              </Button>
            )}
          </form>
        ) : product.websiteUrl ? (
          <Button asChild size="sm" className="w-fit">
            <a href={product.websiteUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon /> {product.websiteUrl.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          </Button>
        ) : null
      ) : (
        <span className="text-meta font-normal text-slate-500 sm:ml-auto">
          {product.websiteUrl === null ? "Not on the website yet." : ""}
          {canEdit && product.websiteUrl ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setWebsiteLinkAction({ productId: product.id, added: false, url: "" });
                  if (r.ok) {
                    toast.success(r.message);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              Save: not on the website
            </Button>
          ) : null}
        </span>
      )}
    </section>
  );
}
