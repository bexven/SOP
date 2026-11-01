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
  "product.override": [],
  "product.kill": ["MEDIA_BUYER"],
  "brief.edit": ["MEDIA_BUYER"],
  "task.review": ["MEDIA_BUYER"],
  "campaign.manage": ["MEDIA_BUYER"],
  "batch.request": ["MEDIA_BUYER"],
  "task.reassignAny": [],
  "product.sendBack": ["MEDIA_BUYER"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: Role, capability: Capability): boolean {
  if (role === "ADMIN") return true;
  return (CAPABILITIES[capability] as readonly Role[]).includes(role);
}
