import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FlaskConicalIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StagePill } from "@/components/common/pills";
import { Thumbnail } from "@/components/common/thumbnail";
import { AddProductButton } from "@/components/research/add-product-button";
import { ResearchList } from "@/components/research/research-list";
import { formatRelative } from "@/lib/format";
import { requireCapability } from "@/lib/server/auth/current-user";
import { getResearchBoard } from "@/lib/server/queries/research";

export const metadata: Metadata = { title: "Research" };

export default async function ResearchPage() {
  const user = await requireCapability("product.create");
  const board = await getResearchBoard(user);
  const admin = user.role === "ADMIN";
  const nothing = board.drafts.length + board.sentBack.length === 0;

  return (
    <>
      <PageHeader
        title="Research"
        description={
          admin
            ? "Every product still in research. Researchers add products here, fill in prices and the SOP checklist, then submit to start Creative."
            : "Add products you've found, fill in the prices and SOP checklist, then submit to start Creative."
        }
        actions={
          <Suspense>
            <AddProductButton />
          </Suspense>
        }
      />

      <div className="grid gap-6">
        {board.sentBack.length ? (
          <section aria-labelledby="r-sent-back">
            <h2 id="r-sent-back" className="mb-2 text-section text-rose-700">
              Sent back to research <span className="num text-meta text-slate-500">{board.sentBack.length}</span>
            </h2>
            <ResearchList items={board.sentBack} showOwner={admin} />
          </section>
        ) : null}

        <section aria-labelledby="r-drafts">
          <h2 id="r-drafts" className="mb-2 text-section text-slate-900">
            {admin ? "In research" : "My research"} <span className="num text-meta text-slate-500">{board.drafts.length}</span>
          </h2>
          {nothing ? (
            <EmptyState
              icon={FlaskConicalIcon}
              title="No products in research"
              description="Click “Add product” to start researching a new product. You can save a draft and finish it later."
            />
          ) : board.drafts.length ? (
            <ResearchList items={board.drafts} showOwner={admin} />
          ) : (
            <p className="text-body text-slate-600">No other drafts.</p>
          )}
        </section>

        {board.submitted.length ? (
          <section aria-labelledby="r-submitted">
            <h2 id="r-submitted" className="mb-2 text-section text-slate-900">
              {admin ? "Recently submitted" : "Submitted by me"}
            </h2>
            <ul className="surface divide-y divide-slate-100 overflow-hidden rounded-panel">
              {board.submitted.map((p) => (
                <li key={p.id}>
                  <Link href={`/products/${p.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50/80 sm:px-4">
                    <Thumbnail src={p.imageUrl} alt="" className="size-8" />
                    <span className="min-w-0 flex-1 truncate text-body text-slate-900">{p.name}</span>
                    <span className="num hidden text-meta text-slate-500 sm:inline">{p.ref}</span>
                    <span className="hidden text-meta font-normal text-slate-500 sm:inline" suppressHydrationWarning>
                      {formatRelative(new Date(p.updatedAt))}
                    </span>
                    <StagePill stage={p.stage} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
