import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { BrandViewer } from "@/lib/domain/permissions";

/**
 * Prisma filter for products a person may see: every product except those of a
 * restricted brand (e.g. Bexven) they have no access to. Use it in every query
 * that lists products or their tasks.
 */
export function productScope(viewer: BrandViewer): Prisma.ProductWhereInput {
  if (viewer.isMaster) return {};
  return { OR: [{ brandId: null }, { brand: { restricted: false } }, { brandId: { in: [...viewer.brandAccess] } }] };
}

/** The same, for task queries. */
export function taskScope(viewer: BrandViewer): Prisma.TaskWhereInput {
  return viewer.isMaster ? {} : { product: productScope(viewer) };
}

/** Users allowed to see a product of this brand (for assignment, notifications, @mentions). */
export function userCanSeeBrandWhere(brand: { id: string; restricted: boolean } | null | undefined): Prisma.UserWhereInput {
  if (!brand?.restricted) return {};
  return { OR: [{ isMaster: true }, { brandAccess: { has: brand.id } }] };
}
