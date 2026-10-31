import type { Metadata } from "next";
import { LayoutDashboardIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { requireCapability } from "@/lib/server/auth/current-user";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  await requireCapability("overview.view");
  return (
    <>
      <PageHeader title="Overview" description="Stage counts, workload, overdue work and bottlenecks." />
      <EmptyState
        icon={LayoutDashboardIcon}
        title="Not enough activity yet"
        description="This view fills in as products move through the pipeline."
      />
    </>
  );
}
