import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductView } from "@/components/product/product-view";
import { requireUser } from "@/lib/server/auth/current-user";
import { getProductDetail } from "@/lib/server/queries/product";

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductDetail(id);
  return { title: product?.name ?? "Product" };
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const product = await getProductDetail(id);
  if (!product) notFound();
  return <ProductView product={product} viewer={{ id: user.id, role: user.role, name: user.name }} />;
}
