import type { Metadata } from "next";
import { PackageIcon } from "lucide-react";
import type { ProductStage } from "@/generated/prisma/enums";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { NewProductButton } from "@/components/product/new-product-dialog";
import { ProductSheetSlot, sheetParam } from "@/components/product/product-sheet-slot";
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
    listProducts(),
    searchParams,
    db.user.findMany({ where: { active: true }, select: { id: true, name: true, avatarColor: true }, orderBy: { name: "asc" } }),
  ]);
  const canCreate = can(user.role, "product.create");
  const stage = typeof sp.stage === "string" && (STAGES as readonly string[]).includes(sp.stage) ? (sp.stage as ProductStage) : undefined;
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
        <ProductsTable rows={products} people={people} initialStage={stage} />
      )}
      <ProductSheetSlot productId={sheetParam(sp)} user={user} />
    </>
  );
}
