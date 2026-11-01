import type { Role } from "@/generated/prisma/enums";

/**
 * Role × capability matrix. This is the single source of truth for what a
 * role may do. The server enforces it in every action and page loader; the UI
 * uses it only to hide controls (cosmetic).
 *
 * ADMIN implicitly has every capability.
 */
export const CAPABILITIES = {
  "team.manage": [],
  "settings.manage": [],
  "overview.view": [],
  "product.create": ["RESEARCHER"],
  /** Approve / not approve a researched product for testing. */
  "product.approve": ["REVIEWER"],
  "product.override": [],
  "product.kill": ["MEDIA_BUYER"],
  "brief.edit": ["MEDIA_BUYER"],
  "task.review": ["MEDIA_BUYER", "REVIEWER"],
  "campaign.manage": ["MEDIA_BUYER"],
  "batch.request": ["MEDIA_BUYER"],
  "task.reassignAny": [],
  "product.sendBack": ["MEDIA_BUYER", "REVIEWER"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: Role, capability: Capability): boolean {
  if (role === "ADMIN") return true;
  return (CAPABILITIES[capability] as readonly Role[]).includes(role);
}

/**
 * Image and video makers don't see products until they pass Product review
 * (owner's rule). Everyone else sees everything.
 */
export function canSeeEarlyStages(role: Role): boolean {
  return role !== "IMAGE_DESIGNER" && role !== "VIDEO_EDITOR";
}

export const EARLY_STAGES = ["RESEARCH", "REVIEW"] as const;

/** Whether a product is visible to this role (killed-before-approval counts as early). */
export function canSeeProduct(role: Role, stage: string, stageBeforeKill: string | null): boolean {
  if (canSeeEarlyStages(role)) return true;
  if ((EARLY_STAGES as readonly string[]).includes(stage)) return false;
  if (stage === "KILLED" && stageBeforeKill && (EARLY_STAGES as readonly string[]).includes(stageBeforeKill)) return false;
  return true;
}
