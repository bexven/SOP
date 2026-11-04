import type { CampaignStatus, CampaignType } from "@/generated/prisma/enums";

/** Meta campaign formats, in the order the picker shows them. */
export const CAMPAIGN_TYPES = ["IMAGE", "VIDEO", "CAROUSEL", "PREORDER", "CATALOGUE", "MESSAGES"] as const satisfies readonly CampaignType[];

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  IMAGE: "Image",
  VIDEO: "Video",
  CAROUSEL: "Carousel",
  PREORDER: "Pre-order",
  CATALOGUE: "Catalogue",
  MESSAGES: "Messages",
};

/**
 * A product's overall campaign status from all of its campaigns (owner's rule: the product is
 * live while any campaign runs). Running beats paused beats stopped; null when there are none.
 */
export function overallCampaignStatus(statuses: readonly CampaignStatus[]): CampaignStatus | null {
  if (statuses.length === 0) return null;
  if (statuses.includes("RUNNING")) return "RUNNING";
  if (statuses.includes("PAUSED")) return "PAUSED";
  if (statuses.includes("SCALING")) return "SCALING";
  if (statuses.every((s) => s === "NOT_LAUNCHED")) return "NOT_LAUNCHED";
  return "STOPPED";
}

/** The next campaign number for a product (1, 2, 3…). */
export function nextCampaignNumber(numbers: readonly number[]): number {
  return numbers.reduce((m, n) => Math.max(m, n), 0) + 1;
}
