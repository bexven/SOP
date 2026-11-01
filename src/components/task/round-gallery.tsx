"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLinkIcon, MessageSquareIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { toast } from "sonner";
import type { Reaction } from "@/generated/prisma/enums";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatRelative } from "@/lib/format";
import { assetUrl } from "@/lib/image-upload";
import { commentOnItemAction, reactToItemAction } from "@/lib/server/actions/task";
import type { TaskDTO } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";

type Item = TaskDTO["submissions"][number]["items"][number];

/** One submission round: images as a grid, links as a list. Reviewers 👍/👎 each item; everyone can comment. */
export function RoundGallery({ items, canReact, compact }: { items: Item[]; canReact: boolean; compact?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const images = items.filter((i) => i.kind === "IMAGE");
  const links = items.filter((i) => i.kind === "LINK");
  const open = items.find((i) => i.id === openId) ?? null;
  return (
    <div className="grid gap-2">
      {images.length ? (
        <ul className={cn("grid gap-2", compact ? "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
          {images.map((it, i) => (
            <li key={it.id} className="group relative">
              <button
                type="button"
                onClick={() => setOpenId(it.id)}
                className={cn(
                  "block aspect-square w-full overflow-hidden rounded-[10px] bg-slate-100 ring-1 transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  it.reaction === "LIKED" ? "ring-2 ring-emerald-500" : it.reaction === "DISLIKED" ? "ring-2 ring-rose-500" : "ring-slate-200",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- protected asset */}
                <img src={assetUrl(it.assetId!)} alt={`Image ${i + 1}`} loading="lazy" className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
                <span className="sr-only">Open image {i + 1}</span>
              </button>
              {!compact ? (
                <div className="mt-1 flex items-center justify-between gap-1">
                  <ReactionButtons item={it} canReact={canReact} />
                  <button type="button" onClick={() => setOpenId(it.id)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-meta text-slate-600 hover:bg-slate-100">
                    <MessageSquareIcon className="size-3.5" />
                    <span className="num">{it.comments.length}</span>
                    <span className="sr-only">comments</span>
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {links.length ? (
        <ul className="grid gap-1.5">
          {links.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center gap-2 rounded-control border border-slate-200/80 bg-white px-3 py-2">
              <a href={it.url!} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-body font-medium text-indigo-700 hover:underline">
                <span className="truncate">{it.label ?? it.url!.replace(/^https?:\/\//, "")}</span>
                <ExternalLinkIcon className="size-3.5 shrink-0" />
              </a>
              {!compact ? (
                <>
                  <ReactionButtons item={it} canReact={canReact} />
                  <button type="button" onClick={() => setOpenId(it.id)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-meta text-slate-600 hover:bg-slate-100">
                    <MessageSquareIcon className="size-3.5" /> <span className="num">{it.comments.length}</span>
                    <span className="sr-only">comments</span>
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ItemDialog item={open} canReact={canReact} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ReactionButtons({ item, canReact }: { item: Item; canReact: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const set = (reaction: Reaction | null) =>
    startTransition(async () => {
      const r = await reactToItemAction({ itemId: item.id, reaction });
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
  if (!canReact) {
    if (!item.reaction) return <span />;
    return (
      <span className={cn("inline-flex items-center gap-1 text-meta", item.reaction === "LIKED" ? "text-emerald-700" : "text-rose-700")}>
        {item.reaction === "LIKED" ? <ThumbsUpIcon className="size-3.5" /> : <ThumbsDownIcon className="size-3.5" />}
        {item.reaction === "LIKED" ? "Liked" : "Not liked"}
        {item.reactedBy ? ` · ${item.reactedBy}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        disabled={pending}
        aria-pressed={item.reaction === "LIKED"}
        onClick={() => set(item.reaction === "LIKED" ? null : "LIKED")}
        className={cn("inline-flex size-8 items-center justify-center rounded-md transition-colors", item.reaction === "LIKED" ? "bg-emerald-100 text-emerald-700" : "text-slate-500 hover:bg-slate-100 hover:text-emerald-700")}
      >
        <ThumbsUpIcon className="size-4" />
        <span className="sr-only">Like</span>
      </button>
      <button
        type="button"
        disabled={pending}
        aria-pressed={item.reaction === "DISLIKED"}
        onClick={() => set(item.reaction === "DISLIKED" ? null : "DISLIKED")}
        className={cn("inline-flex size-8 items-center justify-center rounded-md transition-colors", item.reaction === "DISLIKED" ? "bg-rose-100 text-rose-700" : "text-slate-500 hover:bg-slate-100 hover:text-rose-700")}
      >
        <ThumbsDownIcon className="size-4" />
        <span className="sr-only">Don&apos;t like</span>
      </button>
    </span>
  );
}

function ItemDialog({ item, canReact, onClose }: { item: Item | null; canReact: boolean; onClose: () => void }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl gap-4 p-4 sm:p-5">
        <DialogTitle>{item?.kind === "IMAGE" ? "Image" : "Link"} feedback</DialogTitle>
        {item ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-control bg-slate-900/[0.04]">
              {item.kind === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element -- protected asset
                <img src={assetUrl(item.assetId!)} alt="Submitted image" className="max-h-[65vh] w-auto object-contain" />
              ) : (
                <a href={item.url!} target="_blank" rel="noopener noreferrer" className="p-6 text-center font-medium break-all text-indigo-700 underline">
                  {item.url}
                </a>
              )}
            </div>
            <div className="flex min-h-0 flex-col gap-3">
              <ReactionButtons item={item} canReact={canReact} />
              <ol className="grid max-h-72 gap-2.5 overflow-y-auto">
                {item.comments.length === 0 ? <li className="text-meta font-normal text-slate-500">No comments yet.</li> : null}
                {item.comments.map((c) => (
                  <li key={c.id} className="flex gap-2">
                    <UserAvatar name={c.author.name} color={c.author.avatarColor} imageId={c.author.avatarAssetId} size="sm" />
                    <div className="min-w-0">
                      <p className="text-meta">
                        <span className="font-medium text-slate-900">{c.author.name}</span>{" "}
                        <span className="font-normal text-slate-500" suppressHydrationWarning>
                          {formatRelative(new Date(c.createdAt))}
                        </span>
                      </p>
                      <p className="text-body whitespace-pre-wrap text-slate-800">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Comment on this image…" aria-label="Comment on this item" />
              <Button
                disabled={pending || !body.trim()}
                onClick={() =>
                  startTransition(async () => {
                    const r = await commentOnItemAction({ itemId: item.id, body });
                    if (r.ok) {
                      setBody("");
                      router.refresh();
                    } else toast.error(r.error);
                  })
                }
              >
                Add comment
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
