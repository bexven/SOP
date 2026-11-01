import { MarginBadge } from "@/components/common/pills";
import type { MarginBand, MarginResult } from "@/lib/domain/margin";
import { formatBdt, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const BAR: Record<MarginBand, string> = { healthy: "bg-emerald-500", ok: "bg-amber-500", thin: "bg-rose-500" };

export function MarginCard({
  margin,
  band,
  courierPct,
  className,
}: {
  margin: MarginResult | null;
  band: MarginBand | null;
  courierPct: string;
  className?: string;
}) {
  const pct = margin?.marginPct ? Number(margin.marginPct) : null;
  return (
    <section className={cn("surface rounded-panel p-4", className)} aria-label="Margin check">
      <div className="flex items-center justify-between">
        <h2 className="text-section text-slate-900">Margin check</h2>
        <MarginBadge pct={margin?.marginPct} band={band} />
      </div>
      {margin ? (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-body">
            <Metric label="Landed cost" value={formatBdt(margin.landedCostBdt)} />
            <Metric label={`Courier (${formatPct(courierPct)})`} value={formatBdt(margin.courierChargeBdt)} />
            <Metric
              label="Gross margin"
              value={formatBdt(margin.grossMarginBdt)}
              tone={Number(margin.grossMarginBdt) < 0 ? "text-rose-700" : undefined}
            />
            <Metric label="Margin" value={margin.marginPct ? `${margin.marginPct}%` : "—"} />
          </dl>
          {pct !== null && band ? (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div className={cn("h-full rounded-full transition-[width] duration-300", BAR[band])} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-body text-slate-600">Enter the China price, shipping and selling price to see the margin.</p>
      )}
      <p className="mt-3 text-meta font-normal text-slate-500">
        All prices in Taka (৳). Landed cost = China price + shipping; courier is {formatPct(courierPct)} of the selling price.
      </p>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-meta text-slate-500">{label}</dt>
      <dd className={cn("num mt-0.5 text-body font-medium text-slate-900", tone)}>{value}</dd>
    </div>
  );
}
