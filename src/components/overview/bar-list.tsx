import { cn } from "@/lib/utils";

/**
 * Single-series horizontal bars (magnitude): one hue, thin bars with rounded
 * data ends anchored at the baseline, direct value labels in text ink, and a
 * native hover tooltip per bar. The rows double as the table view.
 */
export function BarList({
  rows,
  className,
  emphasize,
}: {
  rows: { key: string; label: React.ReactNode; value: number; display: string; title: string }[];
  className?: string;
  /** Key of the row to draw in the stronger step (e.g. the bottleneck). */
  emphasize?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className={cn("grid gap-3", className)}>
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)_auto] items-center gap-3" title={r.title}>
          <span className="truncate text-body text-slate-700">{r.label}</span>
          <span className="relative h-2.5 rounded-full bg-slate-100" aria-hidden>
            <span
              className={cn("absolute inset-y-0 left-0 rounded-l-full rounded-r-[4px]", r.key === emphasize ? "bg-indigo-600" : "bg-indigo-400")}
              style={{ width: `${r.value === 0 ? 0 : Math.max(2, (r.value / max) * 100)}%` }}
            />
          </span>
          <span className="num min-w-12 text-right text-body font-medium text-slate-900">{r.display}</span>
          <span className="sr-only">{r.title}</span>
        </li>
      ))}
    </ul>
  );
}
