"use client";

import { useState } from "react";
import type { Role } from "@/generated/prisma/enums";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canWorkOnTask } from "@/lib/domain/workflow";
import type { ProductDetail } from "@/lib/server/queries/product";
import { ProductHeader } from "./product-header";
import { ResearchForm } from "./research-form";
import { ResearchSummary } from "./research-summary";
import { MarginCard } from "./margin-card";
import { TasksTab } from "./tasks-tab";
import { CampaignCard } from "./campaign-card";
import { LaunchPanel } from "./launch-panel";
import { ProductActions } from "./product-actions";
import { Discussion } from "./discussion";
import { Timeline } from "./timeline";
import { can } from "@/lib/domain/permissions";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewPanel } from "./review-panel";
import { brandThemeStyle } from "@/lib/brand-color";
import { EARLY_STAGES } from "@/lib/domain/permissions";

export type Viewer = { id: string; role: Role; name: string; /** The person's own job (role is the access role). */ jobRole?: Role };

function inResearchOrReview(stage: string) {
  return stage === "RESEARCH" || stage === "REVIEW";
}

export function ProductView({
  product,
  viewer,
  actions,
  extraTabs,
  focusTaskId,
}: {
  product: ProductDetail;
  viewer: Viewer;
  focusTaskId?: string;
  actions?: React.ReactNode;
  extraTabs?: { value: string; label: string; content: React.ReactNode; count?: number }[];
}) {
  const research = product.tasks.find((t) => t.type === "RESEARCH");
  const inResearch = product.stage === "RESEARCH";
  const canEditResearch = inResearch && !!research && canWorkOnTask(viewer, { assigneeId: research.assignee?.id ?? null });
  const openTasks = product.tasks.filter((t) => t.type !== "RESEARCH" && t.status !== "CANCELLED").length;
  const focusIsResearch = focusTaskId && focusTaskId === research?.id;
  const early =
    inResearchOrReview(product.stage) ||
    (product.stage === "KILLED" && !!product.stageBeforeKill && (EARLY_STAGES as readonly string[]).includes(product.stageBeforeKill));
  // Researchers, and anyone looking at a product still in research / review, get one simple page:
  // the details, the review decision and the discussion. Tasks and Timeline matter once creative work starts.
  const simple = !extraTabs?.length && (viewer.jobRole === "RESEARCHER" || early);
  const [tab, setTab] = useState(focusTaskId && !focusIsResearch ? "tasks" : "overview");
  const isAdmin = viewer.role === "ADMIN";
  const [adminEditing, setAdminEditing] = useState(false);
  const showForm = (inResearch && research) || adminEditing;

  const overview = (
    <>
      {product.stage === "REVIEW" ? (
        <div className="mb-4">
          <ReviewPanel product={product} canDecide={can(viewer.role, "product.approve")} />
        </div>
      ) : null}
      {research?.revisionNote && inResearch ? (
        <div role="status" className="mb-4 rounded-panel border border-rose-200 bg-rose-50 px-4 py-3 text-body text-rose-800">
          <span className="font-semibold">Sent back to research:</span> {research.revisionNote}
        </div>
      ) : null}
      {!inResearch && isAdmin && !adminEditing ? (
        <div className="mb-3 flex justify-end">
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
          <div className="grid content-start gap-4">
            <CampaignCard product={product} canEdit={can(viewer.role, "campaign.manage") && product.stage === "LIVE"} />
            <MarginCard margin={product.margin} band={product.marginBand} courierPct={product.courierChargePct} />
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5" style={brandThemeStyle(product.brand?.color)}>
      <ProductHeader product={product} viewer={viewer} actions={actions ?? <ProductActions product={product} viewer={viewer} />} />
      {simple ? (
        <>
          <div>{overview}</div>
          <section aria-labelledby="discussion-heading" className="grid gap-3">
            <h2 id="discussion-heading" className="text-section text-slate-900">
              Discussion {product.comments.length ? <span className="num text-meta text-slate-500">{product.comments.length}</span> : null}
            </h2>
            <Discussion product={product} viewer={viewer} />
          </section>
        </>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="Product sections" className="relative max-w-full overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks {openTasks ? <span className="num text-meta text-slate-500">{openTasks}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="discussion">
              Discussion {product.comments.length ? <span className="num text-meta text-slate-500">{product.comments.length}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            {extraTabs?.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label} {t.count ? <span className="num text-meta text-slate-500">{t.count}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {overview}
          </TabsContent>
          <TabsContent value="tasks" className="mt-4">
            <TasksTab
              product={product}
              viewer={viewer}
              focusTaskId={focusTaskId}
              launchPanel={(task) => <LaunchPanel product={product} task={task} canManage={can(viewer.role, "campaign.manage")} />}
            />
          </TabsContent>
          <TabsContent value="discussion" className="mt-4">
            <Discussion product={product} viewer={viewer} />
          </TabsContent>
          <TabsContent value="timeline" className="mt-4">
            <Timeline product={product} />
          </TabsContent>
          {extraTabs?.map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              {t.content}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
