import Decimal from "decimal.js";
import { ExternalLinkIcon } from "lucide-react";
import { CampaignPill } from "@/components/common/pills";
import { Button } from "@/components/ui/button";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/domain/campaigns";
import { formatBdt, formatDate, formatUsd } from "@/lib/format";
import type { CampaignDTO, ProductDetail } from "@/lib/server/queries/product";
import { CampaignDialogButton, CampaignStatusButton } from "./campaign-edit";

function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/** One named campaign: type, status, budget, link and strategy, with edit / status buttons. */
export function CampaignCard({ product, campaign: c, canEdit = false }: { product: ProductDetail; campaign: CampaignDTO; canEdit?: boolean }) {
  const usdRate = product.thresholds?.usdToBdtRate;
  const days = c.launchedAt ? daysSince(c.launchedAt) : null;
  return (
    <li className="surface grid gap-3 rounded-panel p-4" aria-label={c.name}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-meta text-slate-500">
            <span className="num">#{c.number}</span>
            {c.type ? ` · ${CAMPAIGN_TYPE_LABELS[c.type]}` : ""}
          </p>
          <h3 className="text-section [overflow-wrap:anywhere] text-slate-900">{c.name}</h3>
        </div>
        <CampaignPill status={c.status} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-body">
        <div>
          <dt className="text-meta text-slate-500">Daily budget</dt>
          <dd className="num mt-0.5 font-medium text-slate-900">
            {c.dailyBudgetUsd ? formatUsd(c.dailyBudgetUsd) : "—"}
            {c.dailyBudgetUsd && usdRate ? (
              <span className="block text-meta font-normal text-slate-500">≈ {formatBdt(new Decimal(c.dailyBudgetUsd).times(usdRate).toDecimalPlaces(0).toString())}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-slate-500">Started</dt>
          <dd className="mt-0.5 text-slate-900">
            {c.launchedAt ? (
              <>
                <span className="num">{formatDate(new Date(c.launchedAt))}</span>
                <span className="block text-meta font-normal text-slate-500">
                  <span className="num">{days}</span> day{days === 1 ? "" : "s"} ago{c.launchedBy ? ` · ${c.launchedBy}` : ""}
                </span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
      {c.strategyNotes ? <p className="text-body whitespace-pre-line [overflow-wrap:anywhere] text-slate-700">{c.strategyNotes}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {c.adsManagerUrl ? (
          <Button asChild size="sm" variant="brandSoft">
            <a href={c.adsManagerUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon /> Ads Manager
            </a>
          </Button>
        ) : null}
        {c.metaCampaignId ? <span className="num text-meta text-slate-500">ID {c.metaCampaignId}</span> : null}
        {canEdit ? (
          <span className="ml-auto flex gap-1.5">
            <CampaignDialogButton product={product} campaign={c} />
            <CampaignStatusButton product={product} campaign={c} />
          </span>
        ) : null}
      </div>
    </li>
  );
}
