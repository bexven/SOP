import Link from "next/link";
import { CheckCircle2Icon, RotateCcwIcon } from "lucide-react";
import { DuePill, MarginBadge, PriorityPill } from "@/components/common/pills";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { formatRelative } from "@/lib/format";
import type { ResearchDraft } from "@/lib/server/queries/research";
import { cn } from "@/lib/utils";

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const complete = total > 0 && done >= total;
  return (
    <span className={cn("inline-flex items-center gap-1 text-meta", complete ? "text-emerald-700" : "text-slate-600")}>
      {complete ? <CheckCircle2Icon className="size-3.5" /> : null}
      <span className="num">
        {done}/{total}
      </span>{" "}
      {label}
    </span>
  );
}

export function ResearchList({ items, showOwner }: { items: ResearchDraft[]; showOwner?: boolean }) {
  return (
    <ul className="surface divide-y divide-slate-100 overflow-hidden rounded-panel">
      {items.map((d) => (
        <li key={d.id}>
          <Link href={`/products/${d.id}`} className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-slate-50/80 sm:px-4">
            <Thumbnail src={d.imageUrl} alt="" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-medium text-slate-900">{d.name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="num text-meta text-slate-500">{d.ref}</span>
                <Progress done={d.fieldsDone} total={d.fieldsTotal} label="details" />
                <Progress done={d.checklistDone} total={d.checklistTotal} label="checklist" />
                <span className="text-meta font-normal text-slate-500" suppressHydrationWarning>
                  edited {formatRelative(new Date(d.updatedAt))}
                </span>
              </span>
              {d.sentBack && d.revisionNote ? (
                <span className="mt-1 flex items-center gap-1.5 truncate text-meta text-rose-700">
                  <RotateCcwIcon className="size-3.5 shrink-0" /> “{d.revisionNote}”
                </span>
              ) : null}
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <MarginBadge pct={d.marginPct} band={d.marginBand} />
              <PriorityPill priority={d.priority} />
              <DuePill dueAt={d.dueAt} />
            </span>
            {showOwner && d.assignee ? (
              <UserAvatar name={d.assignee.name} color={d.assignee.avatarColor} imageId={d.assignee.avatarAssetId} size="sm" />
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
