import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { BrandPill, DuePill, StagePill, TaskStatusPill } from "@/components/common/pills";
import { MiniStepper } from "@/components/common/stepper";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { TASK_TYPE_SHORT } from "@/lib/domain/labels";
import type { ProductRow } from "@/lib/server/queries/products";
import { cn } from "@/lib/utils";

export const PIP_FILTERS = [
  { key: "all", label: "All" },
  { key: "review", label: "Waiting for review" },
  { key: "revision", label: "Needs changes" },
  { key: "overdue", label: "Overdue" },
] as const;
export type PipFilter = (typeof PIP_FILTERS)[number]["key"];

export function filterRows(rows: ProductRow[], f: PipFilter): ProductRow[] {
  if (f === "review") return rows.filter((p) => p.waiting.some((w) => w.status === "SUBMITTED"));
  if (f === "revision") return rows.filter((p) => p.waiting.some((w) => w.status === "REVISION"));
  if (f === "overdue") return rows.filter((p) => p.overdue);
  return rows;
}

/** Where the product's current work lives on its page. */
function phaseHref(p: ProductRow) {
  const phase =
    p.stage === "RESEARCH" || p.stage === "REVIEW"
      ? "review"
      : p.stage === "CREATIVE"
        ? p.stepper.index === 3
          ? "videos"
          : "images"
        : p.stepper.index === 5
          ? "orders"
          : "ads";
  return `/products/${p.id}?phase=${phase}`;
}

/** Admin dashboard: every running product, what it's waiting on and who has it — each chip opens that task. */
export function ProductsInProgress({ rows, filter, counts }: { rows: ProductRow[]; filter: PipFilter; counts: Record<PipFilter, number> }) {
  const shown = filterRows(rows, filter);
  return (
    <section aria-labelledby="pip" className="mb-8 scroll-mt-24" id="products-in-progress">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="pip" className="text-section text-slate-900">
          Products in progress <span className="num text-meta text-slate-500">{rows.length}</span>
        </h2>
        <nav aria-label="Filter products" className="relative flex max-w-full gap-1 overflow-x-auto">
          {PIP_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/dashboard#products-in-progress" : `/dashboard?show=${f.key}#products-in-progress`}
              scroll={false}
              aria-current={filter === f.key ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-meta whitespace-nowrap ring-1 transition-colors ring-inset",
                filter === f.key ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300",
              )}
            >
              {f.label} <span className="num">{counts[f.key]}</span>
            </Link>
          ))}
        </nav>
      </div>
      {shown.length === 0 ? (
        <p className="surface rounded-panel px-4 py-6 text-center text-body text-slate-600">
          {rows.length === 0 ? "No products are running right now. New ones start on the Research page." : "No products match this filter."}
        </p>
      ) : (
        <ul className="surface divide-y divide-slate-100 overflow-hidden rounded-panel">
          {shown.map((p) => (
            <li
              key={p.id}
              className={cn(
                "grid gap-2.5 px-3 py-3 transition-colors hover:bg-slate-50/70 sm:px-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto] lg:items-center lg:gap-4",
                p.overdue && "bg-rose-50/40",
              )}
            >
              <Link href={phaseHref(p)} className="group flex min-w-0 items-center gap-3 rounded-control outline-offset-4">
                <Thumbnail src={p.imageUrl} alt="" />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <BrandPill brand={p.brand} />
                    <span className="truncate text-body font-medium text-slate-900 group-hover:underline group-hover:underline-offset-2">{p.name}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <StagePill stage={p.stage} />
                    <MiniStepper stepper={p.stepper} />
                    <span className="text-meta font-normal text-slate-500">{p.stepper.steps[p.stepper.index]?.label}</span>
                  </span>
                </span>
              </Link>
              <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label={`Waiting on, ${p.name}`}>
                {p.waiting.length === 0 ? (
                  <li className="text-meta font-normal text-slate-500">Nothing open</li>
                ) : (
                  p.waiting.slice(0, 5).map((w) => (
                    <li key={w.id}>
                      <Link
                        href={`/products/${p.id}?task=${w.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white py-0.5 pr-1 pl-0.5 ring-1 ring-slate-200 transition-[box-shadow,background-color] hover:bg-slate-50 hover:ring-slate-300 hover:shadow-sm"
                        title={`Open ${TASK_TYPE_SHORT[w.type]}${w.assignee ? ` (${w.assignee.name})` : ""}`}
                      >
                        {w.assignee ? (
                          <UserAvatar name={w.assignee.name} color={w.assignee.avatarColor} imageId={w.assignee.avatarAssetId} size="xs" />
                        ) : (
                          <span className="size-5 rounded-full border border-dashed border-slate-300" />
                        )}
                        <span className="text-meta text-slate-700">{TASK_TYPE_SHORT[w.type]}</span>
                        <TaskStatusPill status={w.status} />
                      </Link>
                    </li>
                  ))
                )}
                {p.waiting.length > 5 ? <li className="self-center text-meta text-slate-500">+{p.waiting.length - 5} more</li> : null}
              </ul>
              <span className="flex items-center gap-2 justify-self-start lg:justify-self-end">
                <DuePill dueAt={p.nextDueAt} />
                <Link
                  href={phaseHref(p)}
                  className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-meta text-slate-700 transition-colors hover:bg-slate-900/[0.05] hover:text-slate-900"
                >
                  Open <ArrowRightIcon className="size-3.5" />
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
