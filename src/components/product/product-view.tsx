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

export type Viewer = { id: string; role: Role; name: string };

export function ProductView({
  product,
  viewer,
  actions,
  extraTabs,
}: {
  product: ProductDetail;
  viewer: Viewer;
  actions?: React.ReactNode;
  extraTabs?: { value: string; label: string; content: React.ReactNode; count?: number }[];
}) {
  const research = product.tasks.find((t) => t.type === "RESEARCH");
  const inResearch = product.stage === "RESEARCH";
  const canEditResearch = inResearch && !!research && canWorkOnTask(viewer, { assigneeId: research.assignee?.id ?? null });
  const openTasks = product.tasks.filter((t) => t.type !== "RESEARCH" && t.status !== "CANCELLED").length;
  const [tab, setTab] = useState(inResearch ? "overview" : "tasks");

  return (
    <div className="grid gap-5">
      <ProductHeader product={product} viewer={viewer} actions={actions} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Product sections" className="max-w-full overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks {openTasks ? <span className="num text-meta text-slate-500">{openTasks}</span> : null}
          </TabsTrigger>
          {extraTabs?.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label} {t.count ? <span className="num text-meta text-slate-500">{t.count}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {inResearch && research ? (
            <ResearchForm
              key={research.id + product.stage}
              productId={product.id}
              editable={canEditResearch}
              checklist={research.checklist}
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
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <ResearchSummary product={product} />
              <MarginCard
                margin={product.margin}
                band={product.marginBand}
                rate={product.rmbToBdtRate}
                courierPct={product.courierChargePct}
                snapshot
                className="self-start"
              />
            </div>
          )}
          {research?.revisionNote && inResearch ? (
            <div role="status" className="mt-4 rounded-panel border border-rose-200 bg-rose-50 px-4 py-3 text-body text-rose-800">
              <span className="font-semibold">Sent back to research:</span> {research.revisionNote}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TasksTab product={product} viewer={viewer} />
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
