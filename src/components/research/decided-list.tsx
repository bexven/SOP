import Link from "next/link";
import { BrandPill, DuePill, MarginBadge, StagePill } from "@/components/common/pills";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { formatBdt, formatRelative } from "@/lib/format";
import type { ResearchBoard } from "@/lib/server/queries/research";

type Pending = ResearchBoard["pending"][number];
type Approved = ResearchBoard["approved"][number];
type NotApproved = ResearchBoard["notApproved"][number];

function Row({
  item,
  meta,
  note,
  right,
}: {
  item: Pending | Approved | NotApproved;
  meta: React.ReactNode;
  note?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <li>
      <Link href={`/products/${item.id}`} className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-slate-50/80 sm:px-4">
        <Thumbnail src={item.imageUrl} alt="" className="size-11" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <BrandPill brand={item.brand} />
            <span className="truncate text-body font-medium text-slate-900">{item.name}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta font-normal text-slate-500">
            <span className="num">{item.ref}</span>
            {item.sellingPriceBdt ? <span className="num text-slate-700">Sells at {formatBdt(item.sellingPriceBdt)}</span> : null}
            {meta}
          </span>
          {note ? <span className="mt-1 block truncate text-meta font-normal text-slate-600">“{note}”</span> : null}
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <MarginBadge pct={item.marginPct} band={item.marginBand} />
          {right}
        </span>
      </Link>
    </li>
  );
}

const LIST = "surface divide-y divide-slate-100 overflow-hidden rounded-panel";

export function PendingList({ items, canApprove }: { items: Pending[]; canApprove: boolean }) {
  return (
    <ul className={LIST}>
      {items.map((p) => (
        <Row
          key={p.id}
          item={p}
          meta={
            <>
              <span suppressHydrationWarning>
                Submitted by {p.submittedBy.name} · {formatRelative(new Date(p.since))}
              </span>
              <span className="font-medium text-indigo-800">{canApprove ? "Open to approve or drop" : `Waiting for ${p.reviewer?.name ?? "the reviewer"}`}</span>
            </>
          }
          right={
            <>
              <DuePill dueAt={p.dueAt} />
              {p.reviewer ? <UserAvatar name={p.reviewer.name} color={p.reviewer.avatarColor} imageId={p.reviewer.avatarAssetId} size="sm" /> : null}
            </>
          }
        />
      ))}
    </ul>
  );
}

export function ApprovedList({ items }: { items: Approved[] }) {
  return (
    <ul className={LIST}>
      {items.map((p) => (
        <Row
          key={p.id}
          item={p}
          meta={
            <span suppressHydrationWarning>
              {p.decidedBy ? `Approved by ${p.decidedBy}` : "Approved"} · {formatRelative(new Date(p.at))}
            </span>
          }
          note={p.decisionNote}
          right={<StagePill stage={p.stage} />}
        />
      ))}
    </ul>
  );
}

export function NotApprovedList({ items }: { items: NotApproved[] }) {
  return (
    <ul className={LIST}>
      {items.map((p) => (
        <Row
          key={p.id}
          item={p}
          meta={
            <span suppressHydrationWarning className="text-rose-700">
              {p.decidedBy ? `Dropped by ${p.decidedBy}` : "Dropped"} · {formatRelative(new Date(p.at))}
            </span>
          }
          note={p.decisionNote ?? p.killNote}
        />
      ))}
    </ul>
  );
}
