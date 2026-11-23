import Link from "next/link";
import { LayoutGridIcon, ListIcon } from "lucide-react";
import { ListColumns, ListGroup, type GroupTone } from "@/components/common/list-view";
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
        ? p.stepper.index === 2
          ? "videos"
          : "images"
        : p.stepper.index === 4
          ? "orders"
          : "ads";
  return `/products/${p.id}?phase=${phase}`;
}

export type PipView = "list" | "grid";

const TEAM_COLS = "md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_7.5rem]";

const STEP_TONE: Record<string, GroupTone> = {
  Research: "sky",
  "Research & review": "sky",
  "Image creative": "violet",
  "Video creative": "violet",
  "Meta ads": "emerald",
  Ordering: "orange",
};

/** Team view groups products by the step they are on, in pipeline order. */
function groupByStep(rows: ProductRow[]) {
  const order: string[] = [];
  const map = new Map<string, ProductRow[]>();
  for (const p of rows) {
    const label = p.stepper.steps[p.stepper.index]?.label ?? "Other";
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(p);
  }
  for (const p of rows[0]?.stepper.steps ?? []) if (map.has(p.label)) order.push(p.label);
  for (const k of map.keys()) if (!order.includes(k)) order.push(k);
  return order.map((label) => ({ label, tone: STEP_TONE[label] ?? ("slate" as GroupTone), rows: map.get(label)! }));
}

function hrefFor(filter: PipFilter, view: PipView) {
  const q = new URLSearchParams();
  if (filter !== "all") q.set("show", filter);
  if (view === "grid") q.set("view", "grid");
  const qs = q.toString();
  return `/dashboard?tab=team${qs ? `&${qs}` : ""}`;
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
              className="inline-flex max-w-full items-center gap-1.5 rounded-[6px] bg-white py-0.5 pr-1 pl-0.5 ring-1 ring-[var(--line)] transition-colors hover:bg-hover hover:ring-slate-300"
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
    <section aria-labelledby="pip" className="scroll-mt-24" id="products-in-progress">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="pip" className="sr-only">
          Products in progress
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
                  "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-meta whitespace-nowrap ring-1 transition-colors ring-inset",
                  filter === f.key ? "bg-accent text-accent-foreground ring-indigo-200" : "bg-white text-slate-700 ring-[var(--line)] hover:bg-hover",
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
        <div>
          {groupByStep(shown).map((g) => (
            <ListGroup key={g.label} label={g.label} tone={g.tone} count={g.rows.length} columns={<ListColumns className={TEAM_COLS}><span>Product</span><span>Waiting on</span><span>Next due</span></ListColumns>}>
              {g.rows.map((p) => (
                <li key={p.id} className={cn("group relative grid items-center gap-x-4 gap-y-2 px-3 py-2.5 transition-colors hover:bg-hover", TEAM_COLS, p.overdue && "shadow-[inset_3px_0_0_var(--color-rose-500)]")}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Thumbnail src={p.imageUrl} alt="" className="size-8 rounded-[6px]" />
                    <span className="min-w-0">
                      <Link
                        href={phaseHref(p)}
                        className="block truncate text-body font-medium text-slate-900 outline-none after:absolute after:inset-0 group-hover:text-primary focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                      >
                        {p.name}
                      </Link>
                      <span className="mt-0.5 flex items-center gap-2">
                        <BrandPill brand={p.brand} />
                        <MiniStepper stepper={p.stepper} />
                      </span>
                    </span>
                  </div>
                  <WaitingChips p={p} max={4} />
                  <span className="flex items-center">
                    <DuePill dueAt={p.nextDueAt} />
                  </span>
                </li>
              ))}
            </ListGroup>
          ))}
        </div>
      )}
    </section>
  );
}
