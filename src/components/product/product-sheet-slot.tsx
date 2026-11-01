import { Suspense } from "react";
import type { CurrentUser } from "@/lib/server/auth/current-user";
import { getProductDetail } from "@/lib/server/queries/product";
import { ProductSheet } from "./product-sheet";
import { ProductView } from "./product-view";

/** Server part of the slide-over: renders the sheet when `?product=` is present. */
export async function ProductSheetSlot({ productId, user }: { productId: string | undefined; user: CurrentUser }) {
  if (!productId) return null;
  const product = await getProductDetail(productId);
  if (!product) return null;
  return (
    <Suspense>
      <ProductSheet productId={product.id} title={`${product.ref} · ${product.name}`}>
        <ProductView product={product} viewer={{ id: user.id, role: user.role, name: user.name }} />
      </ProductSheet>
    </Suspense>
  );
}

export function sheetParam(searchParams: Record<string, string | string[] | undefined>): string | undefined {
  const v = searchParams.product;
  return typeof v === "string" && /^[a-z0-9]{10,40}$/.test(v) ? v : undefined;
}
