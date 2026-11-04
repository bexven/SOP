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
  "REVIEWER",
  "ADMIN",
  "CUSTOMER_SUPPORT",
  "OFFICE_SECRETARY",
] as const satisfies readonly Role[];

export const ROLE_LABELS: Record<Role, string> = {
  RESEARCHER: "Researcher",
  IMAGE_DESIGNER: "Image Designer",
  VIDEO_EDITOR: "Video Editor",
  MEDIA_BUYER: "Media Buyer",
  REVIEWER: "Reviewer",
  ADMIN: "Admin",
  CUSTOMER_SUPPORT: "Customer Support",
  OFFICE_SECRETARY: "Office Boy",
};

export const TASK_TYPES = [
  "RESEARCH",
  "PRODUCT_APPROVAL",
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
  PRODUCT_APPROVAL: "Product approval",
  WEBSITE_IMAGE: "Website product images",
  AD_IMAGE_LANDSCAPE: "Meta ad images · Landscape",
  AD_IMAGE_SQUARE: "Meta ad images · Square",
  AD_IMAGE_VERTICAL: "Meta ad images · Portrait",
  STORE_LISTING: "Store product listing",
  VIDEO_MAIN: "Main video",
  VIDEO_SQUARE: "Square video",
  CAMPAIGN_LAUNCH: "Campaign Launch",
};

/** The role that owns (and is auto-assigned) each task type. */
export const TASK_TYPE_ROLE: Record<TaskType, Role> = {
  RESEARCH: "RESEARCHER",
  PRODUCT_APPROVAL: "REVIEWER",
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
  "REVIEW",
  "CREATIVE",
  "READY_TO_LAUNCH",
  "LIVE",
  "COMPLETED",
  "KILLED",
] as const satisfies readonly ProductStage[];

export const STAGE_LABELS: Record<ProductStage, string> = {
  RESEARCH: "Research",
  REVIEW: "Product review",
  CREATIVE: "Creative",
  READY_TO_LAUNCH: "Ready to Launch",
  LIVE: "Live",
  COMPLETED: "Completed",
  KILLED: "Dropped",
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
  "NOT_APPROVED",
  "OTHER",
] as const satisfies readonly KillReason[];

export const KILL_REASON_LABELS: Record<KillReason, string> = {
  LOW_MARGIN: "Low margin",
  SUPPLIER_ISSUE: "Supplier issue",
  WEAK_CREATIVE: "Weak creative",
  POOR_AD_PERFORMANCE: "Poor ad performance",
  NOT_APPROVED: "Not approved in review",
  OTHER: "Other",
};

/** Creative formats a Media Buyer can request in a new batch. (Landscape ads and the store listing are no longer made.) */
export const CREATIVE_TYPES = [
  "WEBSITE_IMAGE",
  "AD_IMAGE_VERTICAL",
  "AD_IMAGE_SQUARE",
  "VIDEO_MAIN",
  "VIDEO_SQUARE",
] as const satisfies readonly TaskType[];

/** Task types whose work is submitted as links and approved by a Senior. Legacy types stay reviewable. */
export const REVIEWED_TYPES = [...CREATIVE_TYPES, "AD_IMAGE_LANDSCAPE", "STORE_LISTING"] as const satisfies readonly TaskType[];

export function isReviewedType(type: TaskType): boolean {
  return (REVIEWED_TYPES as readonly TaskType[]).includes(type);
}

/** Short labels for compact UI (cards, toasts). */
export const TASK_TYPE_SHORT: Record<TaskType, string> = {
  RESEARCH: "Research",
  PRODUCT_APPROVAL: "Approval",
  WEBSITE_IMAGE: "Website images",
  AD_IMAGE_LANDSCAPE: "Landscape ads",
  AD_IMAGE_SQUARE: "Square ads",
  AD_IMAGE_VERTICAL: "Portrait ads",
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

/** Follow-ups a Senior can ask for when approving. ("Something else" was removed; the enum value stays for old data.) */
export const FOLLOW_UP_KINDS = ["DIFFERENT_ANGLE", "DIFFERENT_SIZE"] as const satisfies readonly FollowUpKind[];

export const FOLLOW_UP_LABELS: Record<FollowUpKind, string> = {
  DIFFERENT_ANGLE: "Different angle",
  DIFFERENT_SIZE: "Different size",
  OTHER: "Something else",
};

/** Which group a creative task belongs to on the board. */
export type BoardGroup = "website" | "metaAds" | "videos";
export function boardGroupOf(type: TaskType): BoardGroup | null {
  if (type === "WEBSITE_IMAGE" || type === "STORE_LISTING") return "website";
  if (type === "AD_IMAGE_VERTICAL" || type === "AD_IMAGE_SQUARE" || type === "AD_IMAGE_LANDSCAPE") return "metaAds";
  if (laneOf(type) === "videos") return "videos";
  return null;
}

/** What the maker adds when marking a task ready. */
export const SUBMIT_PROMPT: Partial<Record<TaskType, { ready: string; field: string; placeholder: string; many: boolean }>> = {
  WEBSITE_IMAGE: { ready: "Website product images ready", field: "Image links", placeholder: "https://drive.google.com/…", many: true },
  STORE_LISTING: { ready: "Store listing ready", field: "Store product URL", placeholder: "https://yourstore.com/products/…", many: false },
  AD_IMAGE_VERTICAL: { ready: "Portrait ad images ready", field: "Portrait image links", placeholder: "https://drive.google.com/…", many: true },
  AD_IMAGE_SQUARE: { ready: "Square ad images ready", field: "Square image links", placeholder: "https://drive.google.com/…", many: true },
  AD_IMAGE_LANDSCAPE: { ready: "Landscape ad images ready", field: "Landscape image links", placeholder: "https://drive.google.com/…", many: true },
  VIDEO_MAIN: { ready: "Main video ready", field: "Video links", placeholder: "https://drive.google.com/…", many: true },
  VIDEO_SQUARE: { ready: "Square video ready", field: "Video links", placeholder: "https://drive.google.com/…", many: true },
};

/** What must exist before a task can be marked ready (pure): at least one link (one for the website URL). */
export function submissionError(type: TaskType, counts: { links: number }): string | null {
  if (!isReviewedType(type)) return "This task isn't submitted for review.";
  const prompt = SUBMIT_PROMPT[type];
  if (counts.links < 1) return `Add the ${prompt?.field.toLowerCase() ?? "link"} first.`;
  if (prompt && !prompt.many && counts.links > 1) return `Add one ${prompt.field.toLowerCase()}.`;
  return null;
}
