import Decimal from "decimal.js";
import { ExternalLinkIcon } from "lucide-react";
import { CampaignPill } from "@/components/common/pills";
import { formatBdt, formatDateTime, formatUsd } from "@/lib/format";
import type { ProductDetail } from "@/lib/server/queries/product";

export function CampaignCard({ product }: { product: ProductDetail }) {
  const c = product.campaign;
  if (!c || !c.launchedAt) return null;
  const usdRate = product.thresholds?.usdToBdtRate;
  return (
    <section className="surface rounded-panel p-4" aria-label="Campaign">
      <div className="flex items-center justify-between">
        <h2 className="text-section text-slate-900">Campaign</h2>
        <CampaignPill status={c.status} />
      </div>
      <dl className="mt-3 grid gap-3 text-body">
        {c.dailyBudgetUsd ? (
          <div>
            <dt className="text-meta text-slate-500">Daily budget</dt>
            <dd className="num mt-0.5 font-medium text-slate-900">
              {formatUsd(c.dailyBudgetUsd)}
              {usdRate ? (
                <span className="ml-1.5 font-normal text-slate-500">≈ {formatBdt(new Decimal(c.dailyBudgetUsd).times(usdRate).toDecimalPlaces(0).toString())}</span>
              ) : null}
            </dd>
          </div>
        ) : null}
        {c.adsManagerUrl ? (
          <div>
            <dt className="text-meta text-slate-500">Ads Manager</dt>
            <dd className="mt-0.5">
              <a href={c.adsManagerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline">
                Open campaign <ExternalLinkIcon className="size-3.5" />
              </a>
              {c.metaCampaignId ? <span className="num ml-2 text-meta text-slate-500">ID {c.metaCampaignId}</span> : null}
            </dd>
          </div>
        ) : null}
        {c.strategyNotes ? (
          <div>
            <dt className="text-meta text-slate-500">Strategy</dt>
            <dd className="mt-0.5 whitespace-pre-line text-slate-800">{c.strategyNotes}</dd>
          </div>
        ) : null}
        <div className="text-meta font-normal text-slate-500">
          Launched{c.launchedBy ? ` by ${c.launchedBy}` : ""} · <span className="num">{formatDateTime(new Date(c.launchedAt))}</span>
        </div>
      </dl>
    </section>
  );
}
