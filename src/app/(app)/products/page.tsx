import type { Metadata } from "next";
import Link from "next/link";
import { PackageIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { MarginBadge, PriorityPill, StagePill } from "@/components/common/pills";
import { Thumbnail } from "@/components/common/thumbnail";
import { NewProductButton } from "@/components/product/new-product-dialog";
import { can } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/server/auth/current-user";
import { listProducts } from "@/lib/server/queries/products";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const user = await requireUser();
  const products = await listProducts();
  const canCreate = can(user.role, "product.create");
  return (
    <>
      <PageHeader
        title="Products"
        description="Search and filter every product, including killed ones."
        actions={canCreate ? <NewProductButton /> : null}
      />
      {products.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="No products yet"
          description={canCreate ? "Start the first research draft to get the pipeline moving." : "Products appear here as soon as research starts on them."}
          action={canCreate ? <NewProductButton /> : undefined}
        />
      ) : (
        <ul className="surface divide-y divide-slate-100 overflow-hidden rounded-panel">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/products/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70">
                <Thumbnail src={p.imageUrl} alt="" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{p.name}</span>
                  <span className="num text-meta text-slate-500">{p.ref}</span>
                </span>
                <MarginBadge pct={p.marginPct} band={p.marginBand} />
                <PriorityPill priority={p.priority} />
                <StagePill stage={p.stage} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
