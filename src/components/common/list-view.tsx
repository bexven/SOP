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
  amber: "bg-amber-500",
  violet: "bg-violet-600",
  sky: "bg-sky-600",
  emerald: "bg-emerald-600",
  orange: "bg-orange-500",
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
