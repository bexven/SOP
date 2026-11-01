import Link from "next/link";
import { DuePill, PriorityPill } from "@/components/common/pills";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { FOLLOW_UP_LABELS, TASK_TYPE_LABELS } from "@/lib/domain/labels";
import type { CreativeRow } from "@/lib/server/queries/creative";

export function CreativeCard({ t }: { t: CreativeRow }) {
  return (
    <Link href={`/products/${t.product.id}?task=${t.id}`} className="surface block rounded-panel p-3 transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--raised-shadow)]">
      <div className="flex items-start gap-2.5">
        <Thumbnail src={t.product.imageUrl} alt="" className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-medium text-slate-900">
            {TASK_TYPE_LABELS[t.type]}
            {t.requestKind ? <span className="text-indigo-700"> · {FOLLOW_UP_LABELS[t.requestKind]}</span> : null}
          </p>
          <p className="truncate text-meta font-normal text-slate-500">
            <span className="num">{t.product.ref}</span> · {t.product.name}
          </p>
        </div>
        {t.assignee ? <UserAvatar name={t.assignee.name} color={t.assignee.avatarColor} imageId={t.assignee.avatarAssetId} size="sm" /> : null}
      </div>
      {t.thumbs.length ? (
        <div className="mt-2.5 flex gap-1.5" aria-hidden>
          {t.thumbs.map((id) => (
            // eslint-disable-next-line @next/next/no-img-element -- protected asset
            <img key={id} src={`/api/assets/${id}`} alt="" loading="lazy" className="size-12 rounded-md object-cover ring-1 ring-slate-200" />
          ))}
        </div>
      ) : null}
      {t.status === "REVISION" && t.revisionNote ? <p className="mt-2 line-clamp-2 text-meta text-rose-700">“{t.revisionNote}”</p> : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <PriorityPill priority={t.product.priority} />
        <DuePill dueAt={t.dueAt} />
      </div>
    </Link>
  );
}
