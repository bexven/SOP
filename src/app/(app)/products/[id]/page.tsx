import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import { BackLink } from "@/components/common/back-link";
import { ProductView } from "@/components/product/product-view";
import { canSeeProduct } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/server/auth/current-user";
import { getProductDetail } from "@/lib/server/queries/product";

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductDetail(id);
  return { title: product?.name ?? "Product" };
}

export default async function ProductPage({ params, searchParams }: PageProps<"/products/[id]">) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const product = await getProductDetail(id);
  if (!product || !canSeeProduct(user.role, product.stage, product.stageBeforeKill)) notFound();
  const task = typeof sp.task === "string" ? sp.task : undefined;
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <BackLink fallback="/products" />
        <nav aria-label="Breadcrumb" className="hidden text-meta text-slate-500 sm:block">
          <ol className="flex items-center gap-1">
            <li>
              <Link href="/products" className="hover:text-slate-900">
                Products
              </Link>
            </li>
            <ChevronRightIcon className="size-3" aria-hidden />
            <li className="num text-slate-700" aria-current="page">
              {product.ref}
            </li>
          </ol>
        </nav>
      </div>
      <ProductView product={product} viewer={{ id: user.id, role: user.role, name: user.name }} focusTaskId={task} />
    </>
  );
}
