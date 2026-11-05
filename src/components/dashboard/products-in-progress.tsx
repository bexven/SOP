import Link from "next/link";
import { ArrowRightIcon, LayoutGridIcon, ListIcon } from "lucide-react";
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

export type PipView = "list" | "grid";

function hrefFor(filter: PipFilter, view: PipView) {
  const q = new URLSearchParams();
  if (filter !== "all") q.set("show", filter);
  if (view === "grid") q.set("view", "grid");
  const qs = q.toString();
  return `/dashboard${qs ? `?${qs}` : ""}#products-in-progress`;
}

/** "Waiting on" chips: each opens that task (sits above the card's own link). */
function WaitingChips({ p, max }: { p: ProductRow; max: number }) {
  return (
    <ul className="relative z-10 flex min-w-0 flex-wrap gap-1.5" aria-label={`Waiting on, ${p.name}`}>
      {p.waiting.length === 0 ? (
        <li className="text-meta font-normal text-slate-500">Nothing open</li>
      ) : (
        p.waiting.slice(0, max).map((w) => (
          <li key={w.id} className="min-w-0">
            <Link
              href={`/products/${p.id}?task=${w.id}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white py-0.5 pr-1 pl-0.5 ring-1 ring-slate-200 transition-[box-shadow,background-color] hover:bg-slate-50 hover:shadow-sm hover:ring-slate-300"
              title={`Open ${TASK_TYPE_SHORT[w.type]}${w.assignee ? ` (${w.assignee.name})` : ""}`}
            >
              {w.assignee ? (
                <UserAvatar name={w.assignee.name} color={w.assignee.avatarColor} imageId={w.assignee.avatarAssetId} size="xs" />
              ) : (
                <span className="size-5 shrink-0 rounded-full border border-dashed border-slate-300" />
              )}
              <span className="truncate text-meta text-slate-700">{TASK_TYPE_SHORT[w.type]}</span>
              <TaskStatusPill status={w.status} />
            </Link>
          </li>
        ))
      )}
      {p.waiting.length > max ? <li className="self-center text-meta text-slate-500">+{p.waiting.length - max} more</li> : null}
    </ul>
  );
}

/** Admin dashboard: every running product, what it's waiting on and who has it. The whole row / card opens the product. */
export function ProductsInProgress({
  rows,
  filter,
  counts,
  view = "list",
}: {
  rows: ProductRow[];
  filter: PipFilter;
  counts: Record<PipFilter, number>;
  view?: PipView;
}) {
  const shown = filterRows(rows, filter);
  return (
    <section aria-labelledby="pip" className="mb-8 scroll-mt-24" id="products-in-progress">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="pip" className="text-section text-slate-900">
          Products in progress <span className="num text-meta text-slate-500">{rows.length}</span>
        </h2>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <nav aria-label="Filter products" className="no-scrollbar relative -mx-4 flex max-w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0">
            {PIP_FILTERS.map((f) => (
              <Link
                key={f.key}
                href={hrefFor(f.key, view)}
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
          <div role="group" aria-label="View" className="inline-flex rounded-control bg-slate-900/[0.05] p-0.5">
            {(
              [
                ["list", "List", ListIcon],
                ["grid", "Grid", LayoutGridIcon],
              ] as const
            ).map(([k, label, Icon]) => (
              <Link
                key={k}
                href={hrefFor(filter, k)}
                scroll={false}
                aria-current={view === k ? "true" : undefined}
                aria-label={`${label} view`}
                title={`${label} view`}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-[8px] transition-colors duration-150",
                  view === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="surface rounded-panel px-4 py-6 text-center text-body text-slate-600">
          {rows.length === 0 ? "No products are running right now. New ones start on the Research page." : "No products match this filter."}
        </p>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => (
            <li
              key={p.id}
              className={cn(
                "surface group relative flex min-w-0 flex-col overflow-hidden rounded-panel transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg motion-reduce:hover:translate-y-0",
                p.overdue && "ring-2 ring-rose-200",
              )}
            >
              <div className="relative">
                <Thumbnail src={p.imageUrl} alt="" className="aspect-square size-auto w-full rounded-none ring-0" />
                {p.nextDueAt ? (
                  <span className="absolute top-2 right-2">
                    <DuePill dueAt={p.nextDueAt} className="bg-white/95 shadow-sm" />
                  </span>
                ) : null}
              </div>
              <div className="grid min-w-0 flex-1 content-start gap-2 p-3">
                <div className="flex min-w-0 items-center gap-1.5">
                  <BrandPill brand={p.brand} />
                  <StagePill stage={p.stage} />
                </div>
                <Link href={phaseHref(p)} className="text-body font-semibold text-slate-900 outline-none after:absolute after:inset-0 after:rounded-panel focus-visible:after:ring-2 focus-visible:after:ring-ring">
                  <span className="line-clamp-2 [overflow-wrap:anywhere]">{p.name}</span>
                </Link>
                <span className="flex min-w-0 items-center gap-2">
                  <MiniStepper stepper={p.stepper} />
                  <span className="truncate text-meta font-normal text-slate-500">{p.stepper.steps[p.stepper.index]?.label}</span>
                </span>
                <WaitingChips p={p} max={2} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="surface divide-y divide-slate-100 overflow-hidden rounded-panel">
          {shown.map((p) => (
            <li
              key={p.id}
              className={cn(
                "group relative grid cursor-pointer gap-2.5 px-3 py-3 transition-colors hover:bg-slate-50/80 sm:px-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto] lg:items-center lg:gap-4",
                p.overdue && "bg-rose-50/40 hover:bg-rose-50/70",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Thumbnail src={p.imageUrl} alt="" />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <BrandPill brand={p.brand} />
                    <Link
                      href={phaseHref(p)}
                      className="truncate text-body font-medium text-slate-900 outline-none after:absolute after:inset-0 group-hover:underline group-hover:underline-offset-2 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                    >
                      {p.name}
                    </Link>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <StagePill stage={p.stage} />
                    <MiniStepper stepper={p.stepper} />
                    <span className="text-meta font-normal text-slate-500">{p.stepper.steps[p.stepper.index]?.label}</span>
                  </span>
                </span>
              </div>
              <WaitingChips p={p} max={5} />
              <span className="flex items-center gap-2 justify-self-start lg:justify-self-end">
                <DuePill dueAt={p.nextDueAt} />
                <span aria-hidden className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-meta text-slate-700 transition-colors group-hover:bg-slate-900/[0.05] group-hover:text-slate-900">
                  Open <ArrowRightIcon className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
