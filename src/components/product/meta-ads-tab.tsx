"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, FilmIcon, GlobeIcon, ImageIcon, RocketIcon, TruckIcon } from "lucide-react";
import { toast } from "sonner";
import { CampaignPill } from "@/components/common/pills";
import { Button } from "@/components/ui/button";
import { ChecklistPanel } from "@/components/task/checklist-panel";
import { laneOf } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { formatDate } from "@/lib/format";
import { moveToOrderingAction } from "@/lib/server/actions/orders";
import type { ProductDetail, TaskDTO } from "@/lib/server/queries/product";
import { CampaignCard } from "./campaign-card";
import { CampaignDialogButton } from "./campaign-edit";
import { Discussion } from "./discussion";
import { LaunchPanel } from "./launch-panel";
import type { Viewer } from "./product-view";

function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function MetaAdsTab({
  product,
  viewer,
  onOpenPhase,
}: {
  product: ProductDetail;
  viewer: Viewer;
  /** Switch to the image / video creative tab to check the work. */
  onOpenPhase: (phase: "images" | "videos") => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const launch = [...product.tasks].reverse().find((t) => t.type === "CAMPAIGN_LAUNCH" && t.status !== "CANCELLED");
  const launchedCampaigns = product.campaigns.filter((c) => c.launchedAt);
  const launched = launchedCampaigns.length > 0;
  const firstLaunch = launched ? launchedCampaigns.map((c) => c.launchedAt!).sort()[0]! : null;
  const running = product.campaigns.filter((c) => c.status === "RUNNING").length;
  const canCampaign = can(viewer, "campaign.manage");
  const canOrder = can(viewer, "orders.manage");
  const lane = (l: "images" | "videos") => {
    const live = product.tasks.filter((t) => laneOf(t.type) === l && t.status !== "CANCELLED");
    return { approved: live.filter((t) => t.status === "APPROVED").length, total: live.length, review: live.filter((t) => t.status === "SUBMITTED").length };
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <section className="surface grid gap-3 rounded-panel p-4 sm:p-5" aria-label="Campaign status">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-meta text-slate-500">Campaign status</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <CampaignPill status={product.campaignStatus ?? "NOT_LAUNCHED"} />
              {firstLaunch ? (
                <span className="text-body text-slate-700">
                  <span className="num font-semibold text-slate-900">{running}</span> of <span className="num">{launchedCampaigns.length}</span> campaign
                  {launchedCampaigns.length === 1 ? "" : "s"} running · live for <span className="num font-semibold text-slate-900">{daysSince(firstLaunch)}</span> day
                  {daysSince(firstLaunch) === 1 ? "" : "s"} since <span className="num">{formatDate(new Date(firstLaunch))}</span>
                </span>
              ) : (
                <span className="text-body text-slate-600">
                  {product.stage === "READY_TO_LAUNCH" ? "All creative is approved — ready to launch." : "Launches once all creative is approved."}
                </span>
              )}
            </div>
          </div>
          {product.orderingSince ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-meta text-emerald-800 ring-1 ring-emerald-100">
              <TruckIcon className="size-3.5" /> In ordering since <span className="num">{formatDate(new Date(product.orderingSince))}</span>
            </span>
          ) : product.stage === "LIVE" && canOrder ? (
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await moveToOrderingAction({ productId: product.id });
                  if (r.ok) {
                    toast.success(r.message);
                    router.push(`/products/${product.id}?phase=orders`, { scroll: false });
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              <TruckIcon /> Performing well — move to ordering
            </Button>
          ) : null}
        </div>
      </section>

      {launched ? (
        <section className="grid gap-3" aria-labelledby="campaigns-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="campaigns-h" className="text-section text-slate-900">
              Campaigns <span className="num text-meta text-slate-500">{launchedCampaigns.length}</span>
            </h2>
            {canCampaign && product.stage === "LIVE" ? <CampaignDialogButton product={product} /> : null}
          </div>
          <ul className="grid gap-3 lg:grid-cols-2">
            {[...launchedCampaigns].reverse().map((c) => (
              <CampaignCard key={c.id} product={product} campaign={c} canEdit={canCampaign && product.stage === "LIVE"} />
            ))}
          </ul>
        </section>
      ) : launch ? (
        <section className="grid gap-3" aria-labelledby="launch-h">
          <h2 id="launch-h" className="flex items-center gap-2 text-section text-slate-900">
            <RocketIcon className="size-4 text-slate-500" /> Launch the campaign
          </h2>
          {launch.checklist.length ? <ChecklistPanel items={launch.checklist} editable={canCampaign && launchOpen(launch)} /> : null}
          <LaunchPanel product={product} task={launch} canManage={canCampaign} />
        </section>
      ) : null}

      <section aria-labelledby="creatives-h" className="grid gap-3">
        <h2 id="creatives-h" className="text-section text-slate-900">
          Creatives for this campaign
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["images", "videos"] as const).map((l) => {
            const s = lane(l);
            const Icon = l === "images" ? ImageIcon : FilmIcon;
            return (
              <button
                key={l}
                type="button"
                onClick={() => onOpenPhase(l)}
                className="surface raised-hover group flex items-center gap-3 rounded-panel p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.99]"
              >
                <span className="flex size-10 items-center justify-center rounded-control bg-accent text-accent-foreground transition-transform duration-200 group-hover:scale-105">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-slate-900">{l === "images" ? "Image creative" : "Video creative"}</span>
                  <span className="num block text-meta font-normal text-slate-600">
                    {s.approved}/{s.total} approved{s.review ? ` · ${s.review} in review` : ""}
                  </span>
                </span>
                <ArrowRightIcon className="size-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            );
          })}
        </div>
        {product.websiteUrl ? (
          <Button asChild variant="brandSoft" size="sm" className="w-fit">
            <a href={product.websiteUrl} target="_blank" rel="noopener noreferrer">
              <GlobeIcon /> Product on the website
            </a>
          </Button>
        ) : null}
      </section>

      <Discussion product={product} viewer={viewer} phase="ADS" />

    </div>
  );
}

function launchOpen(t: TaskDTO) {
  return t.status === "TODO" || t.status === "REVISION";
}
