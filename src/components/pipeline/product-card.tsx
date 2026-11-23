import Link from "next/link";
import { BrandPill, DuePill, MarginBadge, PriorityPill } from "@/components/common/pills";
import { MiniStepper } from "@/components/common/stepper";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { KILL_REASON_LABELS } from "@/lib/domain/labels";
import type { ProductRow } from "@/lib/server/queries/products";

export function PipelineCard({ p }: { p: ProductRow }) {
  return (
    <Link
      href={`/products/${p.id}`}
      scroll={false}
      className="group block rounded-control border border-[var(--line)] bg-white p-2.5 shadow-[0_1px_1px_rgb(15_23_42/0.03)] transition-[box-shadow,border-color] duration-150 ease-out hover:border-slate-300 hover:shadow-[var(--raised-shadow)] active:scale-[0.99]"
    >
      <div className="flex items-start gap-2.5">
        <Thumbnail src={p.imageUrl} alt="" className="size-8 rounded-[6px]" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-body leading-5 font-medium text-slate-900 group-hover:text-primary">{p.name}</p>
          <p className="num text-meta text-slate-500">{p.ref}</p>
        </div>
      </div>
      <MiniStepper stepper={p.stepper} className="mt-2" />
      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <BrandPill brand={p.brand} />
        <PriorityPill priority={p.priority} />
        <MarginBadge pct={p.marginPct} band={p.marginBand} />
        {p.stage === "KILLED" && p.killReason ? <span className="text-meta text-rose-700">{KILL_REASON_LABELS[p.killReason]}</span> : null}
      </div>
      {p.assignees.length || p.nextDueAt ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex -space-x-1.5">
            {p.assignees.slice(0, 4).map((a) => (
              <UserAvatar key={a.id} name={a.name} color={a.avatarColor} imageId={a.avatarAssetId} size="xs" className="ring-2 ring-white" />
            ))}
          </div>
          <DuePill dueAt={p.nextDueAt} />
        </div>
      ) : null}
    </Link>
  );
}
