import type { Metadata } from "next";
import Link from "next/link";
import { KanbanSquareIcon } from "lucide-react";
import type { ProductStage } from "@/generated/prisma/enums";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { STAGE_DOT } from "@/components/common/pills";
import { PipelineCard } from "@/components/pipeline/product-card";
import { Button } from "@/components/ui/button";
import { PRIORITY_RANK, STAGE_LABELS, STAGES } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/server/auth/current-user";
import { listProducts, type ProductRow } from "@/lib/server/queries/products";

export const metadata: Metadata = { title: "Pipeline" };

const CLOSED_LIMIT = 8;

export default async function PipelinePage() {
  const user = await requireUser();
  const products = await listProducts(user);
  const canCreate = can(user, "product.create");

  const byStage = (stage: ProductStage): ProductRow[] => {
    const list = products.filter((p) => p.stage === stage);
    if (stage === "COMPLETED" || stage === "KILLED") return list; // most recently updated first
    return list.sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        (a.nextDueAt ?? "9").localeCompare(b.nextDueAt ?? "9"),
    );
  };

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Every product by stage. Click a product to open it."
      />
      {products.length === 0 ? (
        <EmptyState
          icon={KanbanSquareIcon}
          title="The pipeline is empty"
          description="Once a researcher adds a product on the Research page it appears here and moves through Research, Creative, Ready to Launch and Live."
          action={canCreate ? <Button asChild><Link href="/research?add=1">Go to Research</Link></Button> : undefined}
        />
      ) : (
        <div className="-mx-4 relative overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          <div className="grid auto-cols-[minmax(15.5rem,1fr)] grid-flow-col gap-3">
            {STAGES.map((stage) => {
              const all = byStage(stage);
              const closed = stage === "COMPLETED" || stage === "KILLED";
              const shown = closed ? all.slice(0, CLOSED_LIMIT) : all;
              return (
                <section key={stage} aria-labelledby={`col-${stage}`} className="flex flex-col rounded-panel bg-slate-900/[0.025] p-2">
                  <h2 id={`col-${stage}`} className="flex items-center gap-2 px-1.5 pt-1 pb-2.5 text-body font-semibold text-slate-800">
                    <span className={`size-2 rounded-full ${STAGE_DOT[stage]}`} aria-hidden />
                    {STAGE_LABELS[stage]}
                    <span className="num ml-auto text-meta text-slate-500">{all.length}</span>
                  </h2>
                  <ul className="grid gap-2">
                    {shown.map((p) => (
                      <li key={p.id}>
                        <PipelineCard p={p} />
                      </li>
                    ))}
                  </ul>
                  {all.length === 0 ? <p className="px-2 py-6 text-center text-meta font-normal text-slate-500">Nothing here</p> : null}
                  {closed && all.length > CLOSED_LIMIT ? (
                    <Link href={`/products?stage=${stage}`} className="mt-2 px-2 py-1.5 text-center text-meta text-indigo-700 hover:underline">
                      View all {all.length} in Products
                    </Link>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
