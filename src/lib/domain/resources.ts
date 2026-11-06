import { can, type Subject } from "./permissions";

/** Creative lanes that keep their own extra resource links. */
export type ResourceLane = "images" | "videos";

type Person = Subject & { jobRole?: string | null };

/**
 * Who adds products: anyone with "Add products", plus Admins and Media Buyers (owner's rule),
 * who can also add an already-running product straight to Live.
 */
export function canAddProduct(user: Person): boolean {
  return can(user, "product.create") || canAddRunningProduct(user);
}

export function canAddRunningProduct(user: Person): boolean {
  return user.role === "ADMIN" || user.jobRole === "MEDIA_BUYER" || user.role === "MEDIA_BUYER";
}

/** Extra links on a creative tab: that tab's makers, Seniors, Media Buyers and Admins. */
export function canEditResources(user: Person, lane: ResourceLane): boolean {
  if (can(user, "task.review") || can(user, "campaign.manage")) return true;
  const job = user.jobRole ?? user.role;
  return lane === "images" ? job === "IMAGE_DESIGNER" : job === "VIDEO_EDITOR";
}
