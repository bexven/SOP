"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLinkIcon, FilmIcon, ImageIcon, RocketIcon, TruckIcon } from "lucide-react";
import { toast } from "sonner";
import { CampaignPill } from "@/components/common/pills";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChecklistPanel } from "@/components/task/checklist-panel";
import { laneOf, TASK_TYPE_LABELS } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { formatDate } from "@/lib/format";
import { moveToOrderingAction } from "@/lib/server/actions/orders";
import type { ProductDetail, TaskDTO } from "@/lib/server/queries/product";
import { CampaignCard } from "./campaign-card";
import { Discussion } from "./discussion";
import { LaunchPanel } from "./launch-panel";
import type { Viewer } from "./product-view";

type AssetGroup = { label: string; links: string[]; approved: boolean };

/** Latest links per creative task of a lane (current batches first), for the floating asset buttons. */
export function laneAssets(product: ProductDetail, lane: "images" | "videos"): AssetGroup[] {
  const batchNo = new Map(product.batches.map((b) => [b.id, b.number]));
  return product.tasks
    .filter((t) => laneOf(t.type) === lane && t.status !== "CANCELLED" && t.submissions[0]?.links.length)
    .sort((a, b) => (batchNo.get(b.batchId ?? "") ?? 0) - (batchNo.get(a.batchId ?? "") ?? 0))
    .map((t) => ({
      label: `${TASK_TYPE_LABELS[t.type]}${(batchNo.get(t.batchId ?? "") ?? 1) > 1 ? ` · batch #${batchNo.get(t.batchId ?? "")}` : ""}`,
      links: t.submissions[0]!.links,
      approved: t.status === "APPROVED",
    }));
}

function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function MetaAdsTab({ product, viewer }: { product: ProductDetail; viewer: Viewer }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const launch = [...product.tasks].reverse().find((t) => t.type === "CAMPAIGN_LAUNCH" && t.status !== "CANCELLED");
  const c = product.campaign;
  const launched = Boolean(c?.launchedAt);
  const canCampaign = can(viewer, "campaign.manage");
  const canOrder = can(viewer, "orders.manage");
  const images = laneAssets(product, "images");
  const videos = laneAssets(product, "videos");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 pb-16">
      <section className="surface grid gap-3 rounded-panel p-4 sm:p-5" aria-label="Campaign status">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-meta text-slate-500">Campaign status</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <CampaignPill status={c?.status ?? "NOT_LAUNCHED"} />
              {launched ? (
                <span className="text-body text-slate-700">
                  Running for <span className="num font-semibold text-slate-900">{daysSince(c!.launchedAt!)}</span> day{daysSince(c!.launchedAt!) === 1 ? "" : "s"} · since{" "}
                  <span className="num">{formatDate(new Date(c!.launchedAt!))}</span>
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
        <CampaignCard product={product} canEdit={canCampaign && product.stage === "LIVE"} />
      ) : launch ? (
        <section className="grid gap-3" aria-labelledby="launch-h">
          <h2 id="launch-h" className="flex items-center gap-2 text-section text-slate-900">
            <RocketIcon className="size-4 text-slate-500" /> Launch the campaign
          </h2>
          {launch.checklist.length ? <ChecklistPanel items={launch.checklist} editable={canCampaign && launchOpen(launch)} /> : null}
          <LaunchPanel product={product} task={launch} canManage={canCampaign} />
        </section>
      ) : null}

      <Discussion product={product} viewer={viewer} phase="ADS" />

      <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-2 sm:bottom-6 sm:left-6 sm:flex-row" role="group" aria-label="Creative assets">
        <AssetButton label="Image assets" icon={ImageIcon} groups={images} empty="No image links yet. They appear when the image designer sends work for review." />
        <AssetButton label="Video assets" icon={FilmIcon} groups={videos} empty="No video links yet. They appear when the video editor sends work for review." />
      </div>
    </div>
  );
}

function launchOpen(t: TaskDTO) {
  return t.status === "TODO" || t.status === "REVISION";
}

function AssetButton({ label, icon: Icon, groups, empty }: { label: string; icon: typeof ImageIcon; groups: AssetGroup[]; empty: string }) {
  const count = groups.reduce((n, g) => n + g.links.length, 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="h-11 rounded-full px-4 shadow-[0_8px_24px_-6px_rgb(15_23_42/0.35)]">
          <Icon /> {label} <span className="num rounded-full bg-white/20 px-1.5 text-meta">{count}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[min(22rem,calc(100vw-2rem))] p-3">
        <p className="mb-2 text-section text-slate-900">{label}</p>
        {groups.length === 0 ? (
          <p className="text-meta font-normal text-slate-600">{empty}</p>
        ) : (
          <ul className="grid max-h-[60vh] gap-3 overflow-y-auto">
            {groups.map((g) => (
              <li key={g.label}>
                <p className="mb-1 text-meta text-slate-700">
                  {g.label} {g.approved ? <span className="text-emerald-700">· approved</span> : <span className="text-slate-500">· in review</span>}
                </p>
                <ul className="grid gap-1">
                  {g.links.map((l, i) => (
                    <li key={l + i}>
                      <a
                        href={l}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-control bg-white px-2.5 py-1.5 text-body text-slate-800 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:ring-slate-300"
                      >
                        <ExternalLinkIcon className="size-3.5 shrink-0 text-slate-500" />
                        <span className="truncate">{l.replace(/^https?:\/\/(www\.)?/, "")}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
