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

export type Viewer = { id: string; role: Role; name: string };

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
  const early = inResearch || product.stage === "REVIEW";
  const [tab, setTab] = useState(focusTaskId && !focusIsResearch ? "tasks" : early ? "overview" : "tasks");
  const isAdmin = viewer.role === "ADMIN";
  const [adminEditing, setAdminEditing] = useState(false);
  const showForm = (inResearch && research) || adminEditing;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <ProductHeader product={product} viewer={viewer} actions={actions ?? <ProductActions product={product} viewer={viewer} />} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Product sections" className="max-w-full relative overflow-x-auto">
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
          {product.stage === "REVIEW" ? (
            <div className="mb-4">
              <ReviewPanel product={product} canDecide={can(viewer.role, "product.approve")} />
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
              guide={product.guides.RESEARCH}
              rates={
                product.thresholds
                  ? {
                      rmbToBdtRate: product.thresholds.rmbToBdtRate,
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
                chinaPriceRmb: product.chinaPriceRmb ?? "",
                shippingPerUnitRmb: product.shippingPerUnitRmb ?? "",
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
                <MarginCard
                  margin={product.margin}
                  band={product.marginBand}
                  rate={product.rmbToBdtRate}
                  courierPct={product.courierChargePct}
                  snapshot
                />
              </div>
            </div>
          )}
          {research?.revisionNote && inResearch ? (
            <div role="status" className="mt-4 rounded-panel border border-rose-200 bg-rose-50 px-4 py-3 text-body text-rose-800">
              <span className="font-semibold">Sent back to research:</span> {research.revisionNote}
            </div>
          ) : null}
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
    </div>
  );
}
