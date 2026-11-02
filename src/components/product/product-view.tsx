"use client";

import { useState } from "react";
import { PencilIcon } from "lucide-react";
import type { Role, TaskType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductBoard, type BoardGroupDef } from "@/components/creative/product-board";
import { brandThemeStyle } from "@/lib/brand-color";
import { boardGroupOf, laneOf } from "@/lib/domain/labels";
import { can, isEarly } from "@/lib/domain/permissions";
import { canWorkOnTask, isTerminalStage } from "@/lib/domain/workflow";
import { formatDate } from "@/lib/format";
import type { ProductDetail, TaskDTO } from "@/lib/server/queries/product";
import { BriefCard } from "./brief-card";
import { Discussion } from "./discussion";
import { MarginCard } from "./margin-card";
import { MetaAdsTab } from "./meta-ads-tab";
import { OrdersTab } from "./orders-tab";
import { ProductActions } from "./product-actions";
import { ProductHeader } from "./product-header";
import { ResearchForm } from "./research-form";
import { ResearchSummary } from "./research-summary";
import { ReviewPanel } from "./review-panel";

export type Viewer = {
  id: string;
  role: Role;
  name: string;
  /** The person's own job (role is the access role). */
  jobRole?: Role;
  permissions: readonly string[];
};

export type Phase = "review" | "images" | "videos" | "ads" | "orders";

const PHASE_LABEL: Record<Phase, string> = {
  review: "Product review",
  images: "Image creative",
  videos: "Video creative",
  ads: "Meta ads",
  orders: "Orders",
};

/** Stepper step → the tab that shows its details (Research and Product review share one tab). */
const STEP_PHASE: Phase[] = ["review", "review", "images", "videos", "ads", "orders"];

const LAUNCHED_STAGES = ["READY_TO_LAUNCH", "LIVE", "COMPLETED"];

/** Which phases this product has reached. */
export function phasesFor(p: ProductDetail): Phase[] {
  const out: Phase[] = ["review"];
  if (isEarly(p.stage, p.stageBeforeKill)) return out;
  out.push("images", "videos");
  const reached = LAUNCHED_STAGES.includes(p.stage) || (p.stage === "KILLED" && LAUNCHED_STAGES.includes(p.stageBeforeKill ?? ""));
  if (reached) out.push("ads");
  if (p.orderingSince || p.orders.length || p.stage === "LIVE") out.push("orders");
  return out;
}

function defaultPhase(p: ProductDetail, viewer: Viewer, available: Phase[], focus?: TaskDTO): Phase {
  const pick = (ph: Phase) => (available.includes(ph) ? ph : available[available.length - 1]!);
  if (focus) {
    const lane = laneOf(focus.type);
    if (lane) return pick(lane);
    if (focus.type === "CAMPAIGN_LAUNCH") return pick("ads");
    return "review";
  }
  if (viewer.jobRole === "IMAGE_DESIGNER") return pick("images");
  if (viewer.jobRole === "VIDEO_EDITOR") return pick("videos");
  switch (p.stage) {
    case "CREATIVE":
      return p.stepper.index === 3 ? pick("videos") : pick("images");
    case "READY_TO_LAUNCH":
      return pick("ads");
    case "LIVE":
      return p.orderingSince ? pick("orders") : pick("ads");
    case "COMPLETED":
      return p.orders.length ? pick("orders") : pick("ads");
    default:
      return "review";
  }
}

export function ProductView({
  product,
  viewer,
  focusTaskId,
  initialPhase,
  openReady,
}: {
  product: ProductDetail;
  viewer: Viewer;
  focusTaskId?: string;
  initialPhase?: string;
  /** Open the "ready" form on the focused task. */
  openReady?: boolean;
}) {
  const available = phasesFor(product);
  const focus = product.tasks.find((t) => t.id === focusTaskId);
  // Researchers only need the research itself: details, review and its discussion.
  const simple = viewer.jobRole === "RESEARCHER" || available.length === 1;
  const [phase, setPhase] = useState<Phase>(
    available.includes(initialPhase as Phase) ? (initialPhase as Phase) : defaultPhase(product, viewer, available, focus),
  );

  // A link to another phase of the same page (e.g. after "Move to ordering") switches the tab.
  const [lastInitial, setLastInitial] = useState(initialPhase);
  if (initialPhase !== lastInitial) {
    setLastInitial(initialPhase);
    if (available.includes(initialPhase as Phase)) setPhase(initialPhase as Phase);
  }

  function choose(next: string) {
    setPhase(next as Phase);
    const url = new URL(window.location.href);
    url.searchParams.set("phase", next);
    url.searchParams.delete("task");
    url.searchParams.delete("ready");
    window.history.replaceState(null, "", url.toString());
  }

  const content: Record<Phase, () => React.ReactNode> = {
    review: () => <ReviewPhase product={product} viewer={viewer} />,
    images: () => <CreativePhase product={product} viewer={viewer} lane="images" focusTaskId={focusTaskId} openReady={openReady} />,
    videos: () => <CreativePhase product={product} viewer={viewer} lane="videos" focusTaskId={focusTaskId} openReady={openReady} />,
    ads: () => <MetaAdsTab product={product} viewer={viewer} />,
    orders: () => <OrdersTab product={product} viewer={viewer} />,
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5" style={brandThemeStyle(product.brand?.color)}>
      <ProductHeader
        product={product}
        viewer={viewer}
        actions={<ProductActions product={product} viewer={viewer} />}
        stepper={
          viewer.role === "ADMIN" && !simple
            ? {
                // Admin / Master Admin: click a step to see where that step stands.
                canSelect: (i) => available.includes(STEP_PHASE[i]!),
                onSelect: (i) => {
                  choose(STEP_PHASE[i]!);
                  document.getElementById("product-phases")?.scrollIntoView({ behavior: "smooth", block: "start" });
                },
                selected: STEP_PHASE.flatMap((p, i) => (p === phase ? [i] : [])),
              }
            : undefined
        }
      />
      {simple ? (
        <ReviewPhase product={product} viewer={viewer} />
      ) : (
        <Tabs value={phase} onValueChange={choose} id="product-phases" className="scroll-mt-24">
          <TabsList aria-label="Product phases" className="relative max-w-full overflow-x-auto">
            {available.map((p) => (
              <TabsTrigger key={p} value={p}>
                {PHASE_LABEL[p]}
                <PhaseCount product={product} phase={p} />
              </TabsTrigger>
            ))}
          </TabsList>
          {available.map((p) => (
            <TabsContent key={p} value={p} className="mt-5">
              {phase === p ? content[p]() : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

/** Small open-work count on a phase tab (e.g. tasks waiting). */
function PhaseCount({ product, phase }: { product: ProductDetail; phase: Phase }) {
  if (phase !== "images" && phase !== "videos") return null;
  const open = product.tasks.filter((t) => laneOf(t.type) === phase && (t.status === "TODO" || t.status === "REVISION" || t.status === "SUBMITTED")).length;
  return open ? <span className="num rounded-full bg-slate-900/[0.06] px-1.5 text-meta text-slate-600">{open}</span> : null;
}

function ReviewPhase({ product, viewer }: { product: ProductDetail; viewer: Viewer }) {
  const research = product.tasks.find((t) => t.type === "RESEARCH");
  const inResearch = product.stage === "RESEARCH";
  const canEditResearch = inResearch && !!research && canWorkOnTask(viewer, { assigneeId: research.assignee?.id ?? null });
  const isAdmin = viewer.role === "ADMIN";
  const [adminEditing, setAdminEditing] = useState(false);
  const showForm = (inResearch && research) || adminEditing;
  // The creative brief stays hidden until the product is approved for testing.
  const approved = !isEarly(product.stage, product.stageBeforeKill);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {product.stage === "REVIEW" ? <ReviewPanel product={product} canDecide={can(viewer, "product.approve")} /> : null}
      {research?.revisionNote && inResearch ? (
        <div role="status" className="rounded-panel border border-rose-200 bg-rose-50 px-4 py-3 text-body text-rose-800">
          <span className="font-semibold">Sent back to research:</span> {research.revisionNote}
        </div>
      ) : null}
      {approved ? (
        <BriefCard
          productId={product.id}
          brief={product.creativeBrief}
          updatedAt={product.creativeBriefUpdatedAt}
          canEdit={can(viewer, "brief.edit") && !isTerminalStage(product.stage)}
        />
      ) : null}
      <section aria-label="Research" className="grid gap-3">
        {approved ? (
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-section text-slate-900">Research</h2>
            {!inResearch && isAdmin && !adminEditing ? (
              <Button variant="outline" size="sm" onClick={() => setAdminEditing(true)}>
                <PencilIcon /> Edit details (Admin)
              </Button>
            ) : null}
          </div>
        ) : !inResearch && isAdmin && !adminEditing ? (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdminEditing(true)}>
              <PencilIcon /> Edit details (Admin)
            </Button>
          </div>
        ) : null}
        {showForm ? (
          <ResearchForm
            brands={product.brands}
            mode={inResearch ? "research" : "admin"}
            onDone={() => setAdminEditing(false)}
            key={(research?.id ?? "") + product.stage}
            productId={product.id}
            editable={canEditResearch || (isAdmin && !inResearch)}
            checklist={research?.checklist ?? []}
            rates={
              product.thresholds
                ? {
                    courierChargePct: product.thresholds.courierChargePct,
                    healthyMarginPct: product.thresholds.healthyMarginPct,
                    thinMarginPct: product.thresholds.thinMarginPct,
                  }
                : null
            }
            initial={{
              brandId: product.brandId ?? "",
              name: product.name,
              supplierUrl: product.supplierUrl ?? "",
              imageUrl: product.imageUrl ?? "",
              chinaPriceBdt: product.chinaPriceBdt ?? "",
              shippingPerUnitBdt: product.shippingPerUnitBdt ?? "",
              sellingPriceBdt: product.sellingPriceBdt ?? "",
              targetCustomer: product.targetCustomer ?? "",
              problemSolved: product.problemSolved ?? "",
              sellingAngle: product.sellingAngle ?? "",
              referenceLinks: product.referenceLinks,
              priority: product.priority,
              targetLaunchDate: product.targetLaunchDate ?? "",
            }}
          />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <ResearchSummary product={product} />
            <MarginCard margin={product.margin} band={product.marginBand} courierPct={product.courierChargePct} />
          </div>
        )}
      </section>
      <Discussion product={product} viewer={viewer} phase="REVIEW" />
    </div>
  );
}

const GROUPS: Record<"images" | "videos", { key: "website" | "metaAds" | "videos"; title: string; hint: string }[]> = {
  images: [
    { key: "website", title: "Website product images", hint: "Tick ready, add the product page URL — a Senior reviews the link." },
    { key: "metaAds", title: "Meta ad images", hint: "Portrait first. Once a Senior approves the portrait images, make the square versions." },
  ],
  videos: [{ key: "videos", title: "Videos", hint: "Main video first, then the square version once a Senior approves it." }],
};

/** Board order inside a group: by step (phase), then follow-ups right after their original. */
function ordered(tasks: TaskDTO[]): TaskDTO[] {
  const roots = tasks.filter((t) => !t.followUpOfId || !tasks.some((x) => x.id === t.followUpOfId)).sort((a, b) => a.phase - b.phase);
  const out: TaskDTO[] = [];
  const visit = (t: TaskDTO) => {
    out.push(t);
    tasks.filter((x) => x.followUpOfId === t.id).forEach(visit);
  };
  roots.forEach(visit);
  return out;
}

function CreativePhase({
  product,
  viewer,
  lane,
  focusTaskId,
  openReady,
}: {
  product: ProductDetail;
  viewer: Viewer;
  lane: "images" | "videos";
  focusTaskId?: string;
  openReady?: boolean;
}) {
  const batches = [...product.batches].sort((a, b) => b.number - a.number);
  const laneTasks = product.tasks.filter((t) => laneOf(t.type) === lane && t.status !== "CANCELLED");
  const canEditBrief = can(viewer, "brief.edit") && !isTerminalStage(product.stage);
  const who = laneTasks.find((t) => t.assignee)?.assignee?.name;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <BriefCard productId={product.id} brief={product.creativeBrief} updatedAt={product.creativeBriefUpdatedAt} canEdit={canEditBrief} />
      {laneTasks.length === 0 ? (
        <p className="surface rounded-panel px-4 py-6 text-center text-body text-slate-600">
          No {lane === "images" ? "image" : "video"} tasks right now. They are created when the product is approved for testing, or when the media buyer requests a new batch.
        </p>
      ) : (
        batches.map((b) => {
          const tasks = laneTasks.filter((t) => t.batchId === b.id);
          if (!tasks.length) return null;
          const groups: BoardGroupDef[] = GROUPS[lane]
            .map((g) => ({ ...g, tasks: ordered(tasks.filter((t) => boardGroupOf(t.type as TaskType) === g.key)) }))
            .filter((g) => g.tasks.length);
          return (
            <section key={b.id} aria-label={`Batch ${b.number}`} className="grid gap-3">
              {batches.length > 1 || b.number > 1 ? (
                <div className="flex flex-wrap items-baseline gap-x-2 border-b border-slate-200/70 pb-2">
                  <h2 className="text-section text-slate-900">{b.number === 1 ? "First creatives" : `New creatives · batch #${b.number}`}</h2>
                  <span className="text-meta font-normal text-slate-500">
                    {b.requestedBy ? `${b.requestedBy} · ` : ""}
                    <span className="num">{formatDate(new Date(b.createdAt))}</span>
                    {b.reason ? ` · “${b.reason}”` : ""}
                  </span>
                </div>
              ) : who ? (
                <p className="text-meta font-normal text-slate-600">
                  {lane === "images" ? "Image designer" : "Video editor"}: <span className="font-medium text-slate-800">{who}</span>
                </p>
              ) : null}
              <ProductBoard
                product={product}
                viewer={viewer}
                groups={groups}
                focusTaskId={focusTaskId}
                openReadyId={openReady && tasks.some((t) => t.id === focusTaskId) ? focusTaskId : undefined}
              />
            </section>
          );
        })
      )}
      <Discussion product={product} viewer={viewer} phase={lane === "images" ? "IMAGES" : "VIDEOS"} />
    </div>
  );
}
