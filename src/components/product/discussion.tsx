"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareIcon, PencilIcon, ReplyIcon } from "lucide-react";
import { toast } from "sonner";
import type { DiscussionPhase } from "@/generated/prisma/enums";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { splitMentions } from "@/lib/domain/mentions";
import { formatDateTime, formatRelative } from "@/lib/format";
import { addCommentAction, editCommentAction } from "@/lib/server/actions/comments";
import type { ProductDetail } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";
import type { Viewer } from "./product-view";

type CommentDTO = ProductDetail["comments"][number];
type Person = ProductDetail["people"][number];

export const PHASE_DISCUSSION_LABEL: Record<DiscussionPhase, string> = {
  REVIEW: "Product review",
  IMAGES: "Image creative",
  VIDEOS: "Video creative",
  ADS: "Meta ads",
  ORDERS: "Orders",
};

/** One phase's discussion. Comments never leak between phases. */
export function Discussion({
  product,
  viewer,
  phase,
  taskId,
  title,
}: {
  product: ProductDetail;
  viewer: Viewer;
  phase: DiscussionPhase;
  /** A creative task's own discussion (otherwise the phase's general one). */
  taskId?: string;
  title?: string;
}) {
  const mine = product.comments.filter((c) => c.phase === phase && (c.taskId ?? null) === (taskId ?? null));
  const top = mine.filter((c) => !c.parentId);
  const replies = (id: string) => mine.filter((c) => c.parentId === id);
  return (
    <section aria-labelledby={`discussion-${phase}`} className="grid gap-3">
      <h2 id={`discussion-${phase}`} className="text-section text-slate-900">
        {title ?? `Discussion · ${PHASE_DISCUSSION_LABEL[phase]}`} {mine.length ? <span className="num text-meta text-slate-500">{mine.length}</span> : null}
      </h2>
      <Composer productId={product.id} phase={phase} taskId={taskId} people={product.people} placeholder="Write a comment… use @ to mention someone" />
      {top.length === 0 ? (
        <p className="rounded-panel border border-dashed border-slate-200 px-4 py-5 text-center text-meta font-normal text-slate-500">
          <MessageSquareIcon className="mx-auto mb-1.5 size-4 text-slate-400" aria-hidden />
          {taskId ? "No comments on this task yet. Feedback and questions about this work go here." : `No comments in ${PHASE_DISCUSSION_LABEL[phase]} yet. Questions and decisions for this step go here.`}
        </p>
      ) : (
        <ol className="grid gap-3">
          {[...top].reverse().map((c) => (
            <li key={c.id} className="surface rounded-panel p-3 sm:p-4">
              <CommentItem comment={c} people={product.people} viewer={viewer} />
              <Thread parent={c} replies={replies(c.id)} product={product} viewer={viewer} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Thread({ parent, replies, product, viewer }: { parent: CommentDTO; replies: CommentDTO[]; product: ProductDetail; viewer: Viewer }) {
  const [replying, setReplying] = useState(false);
  return (
    <div className="mt-2 pl-10">
      {replies.length ? (
        <ol className="mb-2 grid gap-3 border-l border-slate-100 pl-3">
          {replies.map((r) => (
            <li key={r.id}>
              <CommentItem comment={r} people={product.people} viewer={viewer} small />
            </li>
          ))}
        </ol>
      ) : null}
      {replying ? (
        <Composer
          productId={product.id}
          parentId={parent.id}
          people={product.people}
          placeholder={`Reply to ${parent.author.name}…`}
          autoFocus
          onDone={() => setReplying(false)}
        />
      ) : (
        <Button variant="ghost" size="sm" className="-ml-2 text-slate-600" onClick={() => setReplying(true)}>
          <ReplyIcon /> Reply
        </Button>
      )}
    </div>
  );
}

function CommentBody({ body, people }: { body: string; people: Person[] }) {
  const parts = useMemo(() => splitMentions(body, people), [body, people]);
  return (
    <p className="text-body whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">
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

function CommentItem({ comment, people, viewer, small }: { comment: CommentDTO; people: Person[]; viewer: Viewer; small?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.body);
  const [pending, startTransition] = useTransition();
  const mine = comment.author.id === viewer.id;
  return (
    <article className="flex gap-2.5">
      <UserAvatar name={comment.author.name} color={comment.author.avatarColor} imageId={comment.author.avatarAssetId} size={small ? "sm" : "md"} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-body font-medium text-slate-900">{comment.author.name}</span>
          <time className="num text-meta font-normal text-slate-500" dateTime={comment.createdAt} title={formatDateTime(new Date(comment.createdAt))} suppressHydrationWarning>
            {formatRelative(new Date(comment.createdAt))}
          </time>
          {comment.editedAt ? <span className="text-meta font-normal text-slate-500">(edited)</span> : null}
          {mine && !editing ? (
            <button type="button" onClick={() => setEditing(true)} className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit comment">
              <PencilIcon className="size-3.5" />
            </button>
          ) : null}
        </div>
        {editing ? (
          <div className="mt-1 grid gap-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label="Edit comment" autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setText(comment.body); setEditing(false); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={pending || !text.trim()}
                onClick={() =>
                  startTransition(async () => {
                    const r = await editCommentAction({ commentId: comment.id, body: text });
                    if (r.ok) {
                      setEditing(false);
                      router.refresh();
                    } else toast.error(r.error);
                  })
                }
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-0.5">
            <CommentBody body={comment.body} people={people} />
          </div>
        )}
      </div>
    </article>
  );
}

/** Textarea with a lightweight @mention picker. */
function Composer({
  productId,
  phase = "REVIEW",
  taskId,
  parentId,
  people,
  placeholder,
  autoFocus,
  onDone,
}: {
  productId: string;
  phase?: DiscussionPhase;
  taskId?: string;
  parentId?: string;
  people: Person[];
  placeholder: string;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState<{ start: number; q: string } | null>(null);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const matches = query ? people.filter((p) => p.name.toLowerCase().startsWith(query.q.toLowerCase())).slice(0, 6) : [];

  function detect(value: string, caret: number) {
    const before = value.slice(0, caret);
    const m = /(^|\s)@([\p{L}\p{N} ]{0,24})$/u.exec(before);
    if (m && !m[2]!.includes("  ")) {
      setQuery({ start: caret - m[2]!.length - 1, q: m[2]! });
      setActive(0);
    } else setQuery(null);
  }

  function insert(p: Person) {
    if (!query) return;
    const caret = ref.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, query.start)}@${p.name} ${text.slice(caret)}`;
    setText(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = query.start + p.name.length + 2;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  function post() {
    startTransition(async () => {
      const r = await addCommentAction({ productId, body: text, parentId, phase, taskId });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message);
      setText("");
      onDone?.();
      router.refresh();
    });
  }

  return (
    <div className="surface relative rounded-panel p-2">
      <Textarea
        ref={ref}
        value={text}
        rows={parentId ? 2 : 3}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={parentId ? "Reply" : "Comment"}
        className="border-0 shadow-none focus-visible:ring-0"
        onChange={(e) => {
          setText(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (matches.length && query) {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insert(matches[active]!); return; }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setQuery(null); return; }
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) post();
        }}
      />
      {matches.length && query ? (
        <ul role="listbox" aria-label="Mention someone" className="glass-strong absolute left-3 z-20 mt-1 w-56 rounded-control p-1">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insert(p); }}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body", i === active ? "bg-slate-900/[0.06]" : "hover:bg-slate-900/[0.04]")}
              >
                <UserAvatar name={p.name} color={p.avatarColor} imageId={p.avatarAssetId} size="xs" /> {p.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <span className="hidden text-meta font-normal text-slate-500 sm:inline">⌘/Ctrl + Enter to post</span>
        <div className="ml-auto flex gap-2">
          {onDone ? (
            <Button variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
          ) : null}
          <Button size="sm" disabled={pending || !text.trim()} onClick={post}>
            {parentId ? "Reply" : "Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
