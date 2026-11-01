import type {
  CampaignStatus,
  FollowUpKind,
  KillReason,
  Priority,
  ProductStage,
  Role,
  TaskStatus,
  TaskType,
} from "@/generated/prisma/enums";

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


export const STAGES = [
  "RESEARCH",
  "CREATIVE",
  "READY_TO_LAUNCH",
  "LIVE",
  "COMPLETED",
  "KILLED",
] as const satisfies readonly ProductStage[];

export const STAGE_LABELS: Record<ProductStage, string> = {
  RESEARCH: "Research",
  CREATIVE: "Creative",
  READY_TO_LAUNCH: "Ready to Launch",
  LIVE: "Live",
  COMPLETED: "Completed",
  KILLED: "Killed",
};

export const PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const satisfies readonly Priority[];

export const PRIORITY_LABELS: Record<Priority, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  LOCKED: "Locked",
  TODO: "To do",
  SUBMITTED: "In review",
  REVISION: "Revision",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

/** Statuses a Media Buyer can pick. (SCALING is kept in the DB enum but not offered for now.) */
export const CAMPAIGN_STATUSES = ["RUNNING", "PAUSED", "STOPPED"] as const satisfies readonly CampaignStatus[];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  NOT_LAUNCHED: "Not launched",
  RUNNING: "Running",
  SCALING: "Scaling",
  PAUSED: "Paused",
  STOPPED: "Stopped",
};

export const KILL_REASONS = [
  "LOW_MARGIN",
  "SUPPLIER_ISSUE",
  "WEAK_CREATIVE",
  "POOR_AD_PERFORMANCE",
  "OTHER",
] as const satisfies readonly KillReason[];

export const KILL_REASON_LABELS: Record<KillReason, string> = {
  LOW_MARGIN: "Low margin",
  SUPPLIER_ISSUE: "Supplier issue",
  WEAK_CREATIVE: "Weak creative",
  POOR_AD_PERFORMANCE: "Poor ad performance",
  OTHER: "Other",
};

/** Creative formats a Media Buyer can request in a new batch (never the store listing). */
export const CREATIVE_TYPES = [
  "WEBSITE_IMAGE",
  "AD_IMAGE_LANDSCAPE",
  "AD_IMAGE_SQUARE",
  "AD_IMAGE_VERTICAL",
  "VIDEO_MAIN",
  "VIDEO_SQUARE",
] as const satisfies readonly TaskType[];

/** Task types whose work is submitted as a link and reviewed by a Media Buyer. */
export const REVIEWED_TYPES = [...CREATIVE_TYPES, "STORE_LISTING"] as const satisfies readonly TaskType[];

export function isReviewedType(type: TaskType): boolean {
  return (REVIEWED_TYPES as readonly TaskType[]).includes(type);
}

/** Short labels for compact UI (cards, toasts). */
export const TASK_TYPE_SHORT: Record<TaskType, string> = {
  RESEARCH: "Research",
  WEBSITE_IMAGE: "Website image",
  AD_IMAGE_LANDSCAPE: "Landscape ad",
  AD_IMAGE_SQUARE: "Square ad",
  AD_IMAGE_VERTICAL: "Vertical ad",
  STORE_LISTING: "Store listing",
  VIDEO_MAIN: "Main video",
  VIDEO_SQUARE: "Square video",
  CAMPAIGN_LAUNCH: "Campaign launch",
};

/** The two creative lanes: the image designer's and the video editor's. */
export const IMAGE_LANE = ["WEBSITE_IMAGE", "AD_IMAGE_LANDSCAPE", "AD_IMAGE_SQUARE", "AD_IMAGE_VERTICAL", "STORE_LISTING"] as const satisfies readonly TaskType[];
export const VIDEO_LANE = ["VIDEO_MAIN", "VIDEO_SQUARE"] as const satisfies readonly TaskType[];

export function laneOf(type: TaskType): "images" | "videos" | null {
  if ((IMAGE_LANE as readonly TaskType[]).includes(type)) return "images";
  if ((VIDEO_LANE as readonly TaskType[]).includes(type)) return "videos";
  return null;
}

export const FOLLOW_UP_KINDS = ["DIFFERENT_ANGLE", "DIFFERENT_SIZE", "OTHER"] as const satisfies readonly FollowUpKind[];

export const FOLLOW_UP_LABELS: Record<FollowUpKind, string> = {
  DIFFERENT_ANGLE: "Different angle",
  DIFFERENT_SIZE: "Different size",
  OTHER: "Something else",
};

/** What a person must attach when submitting (pure). Returns an error message or null. */
export function submissionError(type: TaskType, counts: { images: number; links: number }): string | null {
  if (type === "STORE_LISTING") return counts.links > 0 ? null : "Add the live store product URL.";
  if (laneOf(type) === "videos") return counts.links > 0 ? null : "Add at least one video link (Google Drive).";
  if (laneOf(type) === "images") return counts.images > 0 ? null : "Upload at least one image.";
  return "This task isn't submitted for review.";
}
