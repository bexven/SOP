"use client";

import { useEffect, useState } from "react";
import { PencilIcon } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CreativePhase } from "@/components/creative/creative-phase";
import { brandThemeStyle } from "@/lib/brand-color";
import { laneOf } from "@/lib/domain/labels";
import { can, isEarly } from "@/lib/domain/permissions";
import { canWorkOnTask, isTerminalStage } from "@/lib/domain/workflow";
import type { ProductDetail, TaskDTO } from "@/lib/server/queries/product";
import { BriefCard } from "./brief-card";
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

  const reduce = useReducedMotion();
  // Which stepper step is highlighted: the one clicked, else the step that belongs to the open tab.
  const [stepPick, setStepPick] = useState<number | null>(null);
  const shownStep = stepPick !== null && STEP_PHASE[stepPick] === phase ? stepPick : STEP_PHASE.lastIndexOf(phase);

  // Phones: keep the open tab visible in the swipeable tab row.
  useEffect(() => {
    document.querySelector<HTMLElement>('[aria-label="Product phases"] [data-state="active"]')?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduce ? "auto" : "smooth" });
  }, [phase, reduce]);

  function choose(next: string) {
    setPhase(next as Phase);
    setStepPick(null);
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
    ads: () => <MetaAdsTab product={product} viewer={viewer} onOpenPhase={(p) => choose(p)} />,
    orders: () => <OrdersTab product={product} viewer={viewer} />,
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5" style={brandThemeStyle(product.brand?.color)}>
      <ProductHeader
        product={product}
        viewer={viewer}
        actions={<ProductActions product={product} viewer={viewer} />}
        stepper={
          !simple
            ? {
                // Click a step to see where that step stands (opens its tab).
                canSelect: (i) => available.includes(STEP_PHASE[i]!),
                onSelect: (i) => {
                  choose(STEP_PHASE[i]!);
                  setStepPick(i);
                  document.getElementById("product-phases")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
                },
                selected: [shownStep],
              }
            : undefined
        }
      />
      {simple ? (
        <ReviewPhase product={product} viewer={viewer} />
      ) : (
        <Tabs value={phase} onValueChange={choose} id="product-phases" className="scroll-mt-24">
          <TabsList aria-label="Product phases" className="no-scrollbar relative flex w-full max-w-full justify-start overflow-x-auto sm:inline-flex sm:w-auto">
            {available.map((p) => (
              <TabsTrigger
                key={p}
                value={p}
                className="relative h-8 shrink-0 whitespace-nowrap data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {phase === p ? (
                  <motion.span
                    layoutId="phase-tab-pill"
                    className="absolute inset-0 rounded-[8px] bg-white shadow-[0_1px_3px_rgb(15_23_42/0.12)]"
                    transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0.18, duration: 0.4 }}
                  />
                ) : null}
                <span className="relative flex items-center gap-1.5">
                  {PHASE_LABEL[p]}
                  <PhaseCount product={product} phase={p} />
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {available.map((p) => (
            <TabsContent key={p} value={p} className="mt-5 outline-none">
              <AnimatePresence mode="wait" initial={false}>
                {phase === p ? (
                  <motion.div
                    key={p}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {content[p]()}
                  </motion.div>
                ) : null}
              </AnimatePresence>
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
                    // In research the rate follows Settings; afterwards the product keeps its own snapshot.
                    shippingRatePerKgBdt: inResearch
                      ? product.thresholds.shippingRatePerKgBdt
                      : (product.shippingRatePerKgBdt ?? product.thresholds.shippingRatePerKgBdt),
                  }
                : null
            }
            savedShippingBdt={product.shippingPerUnitBdt}
            initial={{
              brandId: product.brandId ?? "",
              name: product.name,
              supplierUrl: product.supplierUrl ?? "",
              imageUrl: product.imageUrl ?? "",
              chinaPriceBdt: product.chinaPriceBdt ?? "",
              weightKg: product.weightKg ?? "",
              sellingPriceBdt: product.sellingPriceBdt ?? "",
              problemSolved: product.problemSolved ?? "",
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
    </div>
  );
}
