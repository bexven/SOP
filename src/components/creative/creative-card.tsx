import Link from "next/link";
import { BrandPill, DuePill, PriorityPill } from "@/components/common/pills";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { FOLLOW_UP_LABELS, TASK_TYPE_LABELS } from "@/lib/domain/labels";
import type { CreativeRow } from "@/lib/server/queries/creative";

/** Compact ClickUp-style board card: task first, product under it, then due / priority / person. */
export function CreativeCard({ t }: { t: CreativeRow }) {
  return (
    <Link href={`/products/${t.product.id}?task=${t.id}`} className="group block rounded-control border border-[var(--line)] bg-white p-2.5 shadow-[0_1px_1px_rgb(15_23_42/0.03)] transition-[box-shadow,border-color] duration-150 hover:border-slate-300 hover:shadow-[var(--raised-shadow)] active:scale-[0.99]">
      <div className="flex items-start gap-2">
        <Thumbnail src={t.product.imageUrl} alt="" className="size-8 rounded-[6px]" />
        <div className="min-w-0 flex-1">
          <p className="text-body leading-5 font-medium text-slate-900 group-hover:text-primary">
            {TASK_TYPE_LABELS[t.type]}
            {t.requestKind ? <span className="font-normal text-indigo-700"> · {FOLLOW_UP_LABELS[t.requestKind]}</span> : null}
          </p>
          <p className="truncate text-meta font-normal text-slate-500">
            {t.product.name} · <span className="num">{t.product.ref}</span>
          </p>
        </div>
      </div>
      {t.status === "REVISION" && t.revisionNote ? <p className="mt-1.5 line-clamp-2 text-meta font-normal text-rose-700">“{t.revisionNote}”</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <BrandPill brand={t.product.brand} />
        {t.product.priority === "URGENT" || t.product.priority === "HIGH" ? <PriorityPill priority={t.product.priority} /> : null}
        <DuePill dueAt={t.dueAt} />
        <span className="ml-auto">
          {t.assignee ? (
            <UserAvatar name={t.assignee.name} color={t.assignee.avatarColor} imageId={t.assignee.avatarAssetId} size="xs" />
          ) : (
            <span className="block size-5 rounded-full border border-dashed border-slate-300" title="Nobody yet" />
          )}
        </span>
      </div>
    </Link>
  );
}
