import Link from "next/link";
import { BrandPill, DuePill, StagePill, TaskStatusPill } from "@/components/common/pills";
import { MiniStepper } from "@/components/common/stepper";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { TASK_TYPE_SHORT } from "@/lib/domain/labels";
import type { ProductRow } from "@/lib/server/queries/products";
import { cn } from "@/lib/utils";

/** Admin dashboard: every running product, what it's waiting on and who has it. */
export function ProductsInProgress({ rows }: { rows: ProductRow[] }) {
  return (
    <section aria-labelledby="pip" className="mb-8">
      <h2 id="pip" className="mb-2 text-section text-slate-900">
        Products in progress <span className="num text-meta text-slate-500">{rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="surface rounded-panel px-4 py-6 text-center text-body text-slate-600">No products are running right now.</p>
      ) : (
        <ul className="surface divide-y divide-slate-100 overflow-hidden rounded-panel">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/products/${p.id}`} className={cn("grid gap-2 px-3 py-3 transition-colors hover:bg-slate-50/80 sm:px-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto] lg:items-center lg:gap-4", p.overdue && "bg-rose-50/30")}>
                <span className="flex min-w-0 items-center gap-3">
                  <Thumbnail src={p.imageUrl} alt="" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <BrandPill brand={p.brand} />
                      <span className="truncate text-body font-medium text-slate-900">{p.name}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <StagePill stage={p.stage} />
                      <MiniStepper stepper={p.stepper} />
                    </span>
                  </span>
                </span>
                <span className="flex min-w-0 flex-wrap gap-1.5" aria-label="Waiting on">
                  {p.waiting.length === 0 ? (
                    <span className="text-meta font-normal text-slate-500">Nothing open</span>
                  ) : (
                    p.waiting.slice(0, 4).map((w) => (
                      <span key={w.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 py-0.5 pr-1 pl-0.5 ring-1 ring-slate-200">
                        {w.assignee ? <UserAvatar name={w.assignee.name} color={w.assignee.avatarColor} imageId={w.assignee.avatarAssetId} size="xs" /> : <span className="size-5 rounded-full border border-dashed border-slate-300" />}
                        <span className="text-meta text-slate-700">{TASK_TYPE_SHORT[w.type]}</span>
                        <TaskStatusPill status={w.status} />
                      </span>
                    ))
                  )}
                  {p.waiting.length > 4 ? <span className="text-meta text-slate-500">+{p.waiting.length - 4} more</span> : null}
                </span>
                <span className="justify-self-start lg:justify-self-end">
                  <DuePill dueAt={p.nextDueAt} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
