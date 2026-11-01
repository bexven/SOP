import type { Metadata } from "next";
import { PackageIcon } from "lucide-react";
import type { ProductStage } from "@/generated/prisma/enums";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductsTable } from "@/components/products/products-table";
import { STAGES } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/server/auth/current-user";
import { db } from "@/lib/server/db";
import { listProducts } from "@/lib/server/queries/products";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const user = await requireUser();
  const [products, sp, people] = await Promise.all([
    listProducts(user),
    searchParams,
    db.user.findMany({ where: { active: true }, select: { id: true, name: true, avatarColor: true, avatarAssetId: true }, orderBy: { name: "asc" } }),
  ]);
  const canCreate = can(user, "product.create");
  const stage = typeof sp.stage === "string" && (STAGES as readonly string[]).includes(sp.stage) ? (sp.stage as ProductStage) : undefined;
  return (
    <>
      <PageHeader
        title="Products"
        description="Search and filter every product, including killed ones. Click a row to open it."
      />
      {products.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="No products yet"
          description={canCreate ? "Add the first product on the Research page to get the pipeline moving." : "Products appear here as soon as research starts on them."}
          action={canCreate ? <Button asChild><Link href="/research?add=1">Go to Research</Link></Button> : undefined}
        />
      ) : (
        <ProductsTable rows={products} people={people} initialStage={stage} />
      )}
    </>
  );
}
