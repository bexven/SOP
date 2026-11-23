import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ClickUp-style list building blocks: a collapsible group (coloured label + count) holding dense rows.
 * Groups use <details>, so they open / close without JavaScript and keep keyboard support.
 */

export type GroupTone = "slate" | "rose" | "amber" | "violet" | "sky" | "emerald" | "orange" | "indigo";

const TONE: Record<GroupTone, string> = {
  slate: "bg-slate-500",
  rose: "bg-rose-600",
  amber: "bg-amber-700",
  violet: "bg-violet-600",
  sky: "bg-sky-700",
  emerald: "bg-emerald-700",
  orange: "bg-orange-700",
  indigo: "bg-indigo-600",
};

export function ListGroup({
  id,
  label,
  tone = "slate",
  count,
  defaultOpen = true,
  action,
  columns,
  children,
}: {
  id?: string;
  label: string;
  tone?: GroupTone;
  count: number;
  defaultOpen?: boolean;
  /** Small link or button on the right of the group header (e.g. "Open board"). */
  action?: React.ReactNode;
  /** Column headings shown above the rows on wide screens. */
  columns?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} className="group/list scroll-mt-20">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1.5 select-none [&::-webkit-details-marker]:hidden">
        <ChevronDownIcon className="size-4 -rotate-90 text-slate-500 transition-transform duration-150 group-open/list:rotate-0 motion-reduce:transition-none" aria-hidden />
        <span className={cn("inline-flex h-[22px] items-center rounded-[5px] px-2 text-[11px] font-semibold tracking-[0.03em] text-white uppercase", TONE[tone])}>{label}</span>
        <span className="num text-meta text-slate-500">{count}</span>
        {action ? <span className="ml-auto">{action}</span> : null}
      </summary>
      <div className="mt-1 mb-5 overflow-hidden rounded-panel border border-[var(--line)] bg-white">
        {columns}
        <ul className="divide-y divide-[var(--line)]">{children}</ul>
      </div>
    </details>
  );
}

/** Column heading row (hidden on phones). Give it the same grid template as the rows. */
export function ListColumns({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("hidden border-b border-[var(--line)] bg-[#fafbfc] px-3 py-1.5 text-[11px] font-medium tracking-[0.02em] text-slate-500 uppercase md:grid", className)}>{children}</div>;
}

/** A dense, fully clickable row. Put the grid template in `className` so it matches `ListColumns`. */
export function ListRow({ href, className, children, tone }: { href: string; className?: string; children: React.ReactNode; tone?: "danger" }) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "group/row relative grid min-h-11 items-center gap-x-3 gap-y-1 px-3 py-2 text-body outline-none transition-colors duration-100 hover:bg-hover focus-visible:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:bg-slate-100",
          tone === "danger" && "shadow-[inset_3px_0_0_var(--color-rose-500)]",
          className,
        )}
      >
        {children}
      </Link>
    </li>
  );
}

/** One-line stat strip: "10 open · 4 overdue · …", each item jumps to its group. */
export function StatStrip({ items }: { items: { label: string; value: number; href?: string; tone?: "danger" | "warn" | "accent" }[] }) {
  return (
    <div className="no-scrollbar relative -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      {items.map((s) => {
        const body = (
          <>
            <span
              className={cn(
                "num text-[15px] font-semibold",
                s.value > 0 && s.tone === "danger" ? "text-rose-700" : s.value > 0 && s.tone === "warn" ? "text-amber-700" : s.value > 0 && s.tone === "accent" ? "text-primary" : "text-slate-900",
              )}
            >
              {s.value}
            </span>
            <span className="text-meta font-normal whitespace-nowrap text-slate-600">{s.label}</span>
          </>
        );
        const cls = "inline-flex shrink-0 items-baseline gap-1.5 rounded-control border border-[var(--line)] bg-white px-3 py-1.5";
        return s.href ? (
          <a key={s.label} href={s.href} className={cn(cls, "transition-colors hover:border-slate-300 hover:bg-hover")}>
            {body}
          </a>
        ) : (
          <span key={s.label} className={cls}>
            {body}
          </span>
        );
      })}
    </div>
  );
}

/** A ClickUp-style board column: coloured status tag + count on top, cards below on a light grey lane. */
export function BoardColumn({ label, tone = "slate", count, empty, action, children }: { label: string; tone?: GroupTone; count: number; empty?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={`${label}, ${count}`} className="flex min-w-0 flex-col rounded-panel bg-[#f7f8f9] p-1.5">
      <div className="flex items-center gap-2 px-1.5 pt-1 pb-2">
        <span className={cn("inline-flex h-[22px] items-center rounded-[5px] px-2 text-[11px] font-semibold tracking-[0.03em] text-white uppercase", TONE[tone])}>{label}</span>
        <span className="num text-meta text-slate-500">{count}</span>
        {action ? <span className="ml-auto">{action}</span> : null}
      </div>
      {count === 0 && empty ? <p className="px-2 py-4 text-center text-meta font-normal text-slate-500">{empty}</p> : <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">{children}</ul>}
    </section>
  );
}

/** View / scope tabs under a page title (List · Board, Everyone · Mine): links, underlined when current. */
export function ViewTabs({ tabs, right, label = "Views" }: { tabs: { key: string; label: string; href: string; icon?: React.ComponentType<{ className?: string }>; current: boolean; count?: number }[]; right?: React.ReactNode; label?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[var(--line)]">
      <nav aria-label={label} className="no-scrollbar relative -mb-px flex gap-5 overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            scroll={false}
            aria-current={t.current ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-0.5 pb-2 text-body font-medium whitespace-nowrap transition-colors",
              t.current ? "border-primary text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.icon ? <t.icon className="size-4" aria-hidden /> : null}
            {t.label}
            {t.count !== undefined ? <span className="num text-meta font-normal text-slate-500">{t.count}</span> : null}
          </Link>
        ))}
      </nav>
      {right ? <div className="flex items-center gap-2 pb-2">{right}</div> : null}
    </div>
  );
}
