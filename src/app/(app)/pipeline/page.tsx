import type { Metadata } from "next";
import { KanbanSquareIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { requireUser } from "@/lib/server/auth/current-user";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Pipeline" description="Every product, by stage." />
      <EmptyState
        icon={KanbanSquareIcon}
        title="The pipeline is empty"
        description="Once a researcher adds a product, it appears here and moves through Research, Creative, Ready to Launch and Live."
      />
    </>
  );
}
