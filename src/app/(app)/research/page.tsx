import type { Metadata } from "next";
import { canAddProduct, canAddRunningProduct } from "@/lib/domain/resources";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BadgeCheckIcon, FlaskConicalIcon, HourglassIcon, XCircleIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ViewTabs } from "@/components/common/list-view";
import { PageHeader } from "@/components/common/page-header";
import { AddProductButton } from "@/components/research/add-product-button";
import { ApprovedList, NotApprovedList, PendingList } from "@/components/research/decided-list";
import { ResearchList } from "@/components/research/research-list";
import { can, canSeeEarlyStages } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/server/auth/current-user";
import { getBrands } from "@/lib/server/queries/product";
import { getResearchBoard } from "@/lib/server/queries/research";

export const metadata: Metadata = { title: "Research" };

const TABS = [
  { key: "pending", label: "Pending approval" },
  { key: "approved", label: "Approved" },
  { key: "drafts", label: "In research" },
  { key: "not-approved", label: "Not approved" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function ResearchPage({ searchParams }: PageProps<"/research">) {
  const user = await requireUser();
  if (!canSeeEarlyStages(user)) redirect("/dashboard");
  const [board, brands, sp] = await Promise.all([getResearchBoard(user), getBrands(user), searchParams]);
  const canAdd = canAddProduct(user);
  const canApprove = can(user, "product.approve");
  const counts: Record<TabKey, number> = {
    pending: board.pending.length,
    approved: board.approved.length,
    drafts: board.drafts.length,
    "not-approved": board.notApproved.length,
  };
  const requested = typeof sp.tab === "string" ? sp.tab : "";
  const tab: TabKey = (TABS.find((t) => t.key === requested)?.key ?? "pending") as TabKey;
  const sentBack = board.drafts.filter((d) => d.sentBack);
  const drafts = board.drafts.filter((d) => !d.sentBack);

  return (
    <>
      <PageHeader
        title="Research"
        description={
          canApprove
            ? "New products waiting for your decision, and everything already approved or dropped. Approved products move to Creative."
            : "Add products you've found and submit them for approval. Approved products move to Creative."
        }
        actions={
          canAdd ? (
            <Suspense>
              <AddProductButton brands={brands.filter((b) => b.active)} canResearch={can(user, "product.create")} canRunning={canAddRunningProduct(user)} />
            </Suspense>
          ) : null
        }
      />

      <ViewTabs
        label="Research lists"
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "pending" ? "/research" : `/research?tab=${t.key}`, current: t.key === tab, count: counts[t.key] }))}
      />

      {tab === "pending" ? (
        board.pending.length ? (
          <PendingList items={board.pending} canApprove={canApprove} />
        ) : (
          <EmptyState
            icon={HourglassIcon}
            title="Nothing waiting for approval"
            description={
              canApprove
                ? "When a researcher submits a product it appears here for you to approve or drop."
                : "Products you submit appear here until the reviewer approves or drops them."
            }
          />
        )
      ) : null}

      {tab === "approved" ? (
        board.approved.length ? (
          <ApprovedList items={board.approved} />
        ) : (
          <EmptyState icon={BadgeCheckIcon} title="No approved products yet" description="Products appear here once the reviewer approves them. They then show up on the Creative page for the designers." />
        )
      ) : null}

      {tab === "not-approved" ? (
        board.notApproved.length ? (
          <NotApprovedList items={board.notApproved} />
        ) : (
          <EmptyState icon={XCircleIcon} title="No dropped products" description="Products the reviewer drops (or that are dropped during research) are kept here with the reason." />
        )
      ) : null}

      {tab === "drafts" ? (
        <div className="grid gap-6">
          {sentBack.length ? (
            <section aria-labelledby="r-sent-back">
              <h2 id="r-sent-back" className="mb-2 text-section text-rose-700">
                Sent back for changes <span className="num text-meta text-slate-500">{sentBack.length}</span>
              </h2>
              <ResearchList items={sentBack} showOwner />
            </section>
          ) : null}
          {drafts.length ? (
            <section aria-labelledby="r-drafts">
              <h2 id="r-drafts" className="mb-2 text-section text-slate-900">
                Drafts <span className="num text-meta text-slate-500">{drafts.length}</span>
              </h2>
              <ResearchList items={drafts} showOwner />
            </section>
          ) : null}
          {board.drafts.length === 0 ? (
            <EmptyState
              icon={FlaskConicalIcon}
              title="No products in research"
              description={canAdd ? "Click “Add Product” to start a new one. You can save a draft and finish it later." : "Products appear here while the researcher is filling them in."}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
