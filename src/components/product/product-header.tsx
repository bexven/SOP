import type { Role } from "@/generated/prisma/enums";
import { CampaignPill, MarginBadge, PriorityPill, StagePill } from "@/components/common/pills";
import { PipelineStepper } from "@/components/common/stepper";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { KILL_REASON_LABELS } from "@/lib/domain/labels";
import type { ProductDetail } from "@/lib/server/queries/product";

export function ProductHeader({
  product,
  actions,
}: {
  product: ProductDetail;
  viewer: { id: string; role: Role };
  actions?: React.ReactNode;
}) {
  return (
    <header className="grid gap-4">
      <div className="flex items-start gap-3 sm:gap-4">
        <Thumbnail src={product.imageUrl} alt="" className="size-14 rounded-[12px] sm:size-16" />
        <div className="min-w-0 flex-1">
          <p className="num text-meta text-slate-500">{product.ref}</p>
          <h1 className="text-page text-slate-900 [overflow-wrap:anywhere]">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StagePill stage={product.stage} />
            <PriorityPill priority={product.priority} />
            <MarginBadge pct={product.margin?.marginPct} band={product.marginBand} />
            {product.campaign && product.campaign.status !== "NOT_LAUNCHED" ? <CampaignPill status={product.campaign.status} /> : null}
            {product.mediaBuyer ? (
              <span className="inline-flex items-center gap-1.5 pl-1 text-meta text-slate-600">
                <UserAvatar name={product.mediaBuyer.name} color={product.mediaBuyer.avatarColor} size="xs" />
                Media buyer: {product.mediaBuyer.name}
              </span>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="surface rounded-panel px-4 pt-3.5 pb-2.5">
        <PipelineStepper stepper={product.stepper} />
      </div>
      {product.stage === "KILLED" && product.killReason ? (
        <div className="rounded-panel border border-rose-200 bg-rose-50 px-4 py-3 text-body text-rose-800" role="status">
          <span className="font-semibold">Killed · {KILL_REASON_LABELS[product.killReason]}.</span>{" "}
          {product.killNote}
        </div>
      ) : null}
    </header>
  );
}
