import type { Role, TaskType } from "@/generated/prisma/enums";

export const ROLES = [
  "RESEARCHER",
  "IMAGE_DESIGNER",
  "VIDEO_EDITOR",
  "MEDIA_BUYER",
  "ADMIN",
] as const satisfies readonly Role[];

export const ROLE_LABELS: Record<Role, string> = {
  RESEARCHER: "Researcher",
  IMAGE_DESIGNER: "Image Designer",
  VIDEO_EDITOR: "Video Editor",
  MEDIA_BUYER: "Media Buyer",
  ADMIN: "Admin",
};

export const TASK_TYPES = [
  "RESEARCH",
  "WEBSITE_IMAGE",
  "AD_IMAGE_LANDSCAPE",
  "AD_IMAGE_SQUARE",
  "AD_IMAGE_VERTICAL",
  "STORE_LISTING",
  "VIDEO_MAIN",
  "VIDEO_SQUARE",
  "CAMPAIGN_LAUNCH",
] as const satisfies readonly TaskType[];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  RESEARCH: "Product Research",
  WEBSITE_IMAGE: "Website Product Image",
  AD_IMAGE_LANDSCAPE: "Ad Image 1200×628 (Landscape)",
  AD_IMAGE_SQUARE: "Ad Image 1080×1080 (Square)",
  AD_IMAGE_VERTICAL: "Ad Image 1080×1920 (Vertical)",
  STORE_LISTING: "Store Product Listing",
  VIDEO_MAIN: "Main Video 16:9",
  VIDEO_SQUARE: "Square Video 1:1",
  CAMPAIGN_LAUNCH: "Campaign Launch",
};

/** The role that owns (and is auto-assigned) each task type. */
export const TASK_TYPE_ROLE: Record<TaskType, Role> = {
  RESEARCH: "RESEARCHER",
  WEBSITE_IMAGE: "IMAGE_DESIGNER",
  AD_IMAGE_LANDSCAPE: "IMAGE_DESIGNER",
  AD_IMAGE_SQUARE: "IMAGE_DESIGNER",
  AD_IMAGE_VERTICAL: "IMAGE_DESIGNER",
  STORE_LISTING: "IMAGE_DESIGNER",
  VIDEO_MAIN: "VIDEO_EDITOR",
  VIDEO_SQUARE: "VIDEO_EDITOR",
  CAMPAIGN_LAUNCH: "MEDIA_BUYER",
};

/**
 * Avatar colours (token names). Each maps to a soft background + darker text
 * pair in the UI; kept as data so Admin can pick one per person.
 */
export const AVATAR_COLORS = [
  "indigo",
  "violet",
  "sky",
  "emerald",
  "amber",
  "rose",
  "orange",
  "teal",
  "fuchsia",
  "slate",
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

export function isAvatarColor(value: string): value is AvatarColor {
  return (AVATAR_COLORS as readonly string[]).includes(value);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
