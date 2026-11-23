/**
 * Who may change a product (owner's rule, Nov 2026): everyone can view; only Admins and people
 * assigned to the product can edit — and only what their role allows (capabilities still apply).
 * Assigned = the product's owning Media Buyer, or anyone who has (or had) a task on the product.
 * Reviews (Senior approve / needs changes, Product review), comments and orders are not "edits"
 * and stay open to everyone with the matching permission.
 */
export type ProductAssignment = { mediaBuyerId: string | null; assigneeIds: readonly (string | null)[] };

export function isAssignedToProduct(userId: string, p: ProductAssignment): boolean {
  return p.mediaBuyerId === userId || p.assigneeIds.includes(userId);
}

export function canEditProduct(subject: { id: string; role: string; permissions?: readonly string[] }, p: ProductAssignment): boolean {
  return subject.role === "ADMIN" || Boolean(subject.permissions?.includes("product.editAll")) || isAssignedToProduct(subject.id, p);
}

export const VIEW_ONLY_MESSAGE = "You can view this product, but only Admins and people assigned to it can change it.";
