import type { Role } from "@/generated/prisma/enums";
import { BrandPill, CampaignPill, MarginBadge, PriorityPill, StagePill } from "@/components/common/pills";
import { PipelineStepper } from "@/components/common/stepper";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { KILL_REASON_LABELS } from "@/lib/domain/labels";
import type { ProductDetail } from "@/lib/server/queries/product";

export function ProductHeader({
  product,
  actions,
  stepper,
}: {
  product: ProductDetail;
  viewer: { id: string; role: Role };
  actions?: React.ReactNode;
  /** Makes the stepper clickable (Admin): open a step's details. */
  stepper?: { onSelect: (i: number) => void; canSelect: (i: number) => boolean; selected: number[] };
}) {
  return (
    <header className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex items-start gap-3">
        <Thumbnail src={product.imageUrl} alt="" className="size-12 rounded-[10px]" />
        <div className="min-w-0 flex-1">
          <p className="num text-meta font-normal text-slate-500">{product.ref}</p>
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-slate-900 [overflow-wrap:anywhere]">{product.name}</h1>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {/* ClickUp-style property bar: one quiet line of facts. */}
      <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[var(--line)] py-2 text-meta">
        <Prop label="Stage">
          <StagePill stage={product.stage} />
        </Prop>
        {product.brand ? (
          <Prop label="Brand">
            <BrandPill brand={product.brand} />
          </Prop>
        ) : null}
        <Prop label="Priority">
          <PriorityPill priority={product.priority} />
        </Prop>
        {product.margin?.marginPct ? (
          <Prop label="Margin">
            <MarginBadge pct={product.margin?.marginPct} band={product.marginBand} />
          </Prop>
        ) : null}
        {product.campaignStatus && product.campaignStatus !== "NOT_LAUNCHED" ? (
          <Prop label="Ads">
            <CampaignPill status={product.campaignStatus} />
          </Prop>
        ) : null}
        {product.mediaBuyer ? (
          <Prop label="Media buyer">
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <UserAvatar name={product.mediaBuyer.name} color={product.mediaBuyer.avatarColor} imageId={product.mediaBuyer.avatarAssetId} size="xs" />
              {product.mediaBuyer.name}
            </span>
          </Prop>
        ) : null}
      </dl>
      <div className="rounded-panel border border-[var(--line)] bg-white px-2 py-1.5 sm:px-3">
        <PipelineStepper stepper={product.stepper} {...stepper} />
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

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="font-normal text-slate-500">{label}</dt>
      <dd className="flex items-center">{children}</dd>
    </div>
  );
}
