import type { EventType } from "@/generated/prisma/enums";

/**
 * One line per logged product event for the product's History panel. `data` is whatever the action logged
 * (shapes vary by event and by release), so every field is read defensively and there is always a fallback.
 */
type Data = Record<string, unknown> | null | undefined;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const STAGE: Record<string, string> = {
  RESEARCH: "Research",
  REVIEW: "Product review",
  CREATIVE: "Creative",
  READY_TO_LAUNCH: "Ready to launch",
  LIVE: "Live",
  COMPLETED: "Completed",
  KILLED: "Dropped",
};
const stage = (v: unknown) => (typeof v === "string" ? (STAGE[v] ?? v) : null);
const withNote = (text: string, d: Data) => {
  const note = str(d?.note);
  return note ? `${text} — “${note}”` : text;
};

export function describeEvent(type: EventType, data: Data, task: string | null): string {
  const d = data ?? {};
  const on = task ? ` ${task}` : "";
  switch (type) {
    case "PRODUCT_CREATED":
      return d.running ? "added the product as already running" : "added the product";
    case "PRODUCT_UPDATED": {
      const fields = Array.isArray(d.fields) ? d.fields.filter((f): f is string => typeof f === "string") : [];
      if (fields.length) return `updated ${fields.join(", ")}`;
      const changes = d.changes && typeof d.changes === "object" ? Object.keys(d.changes) : [];
      return changes.includes("websiteUrl") ? "updated the website link" : changes.length ? `updated ${changes.join(", ")}` : "updated product details";
    }
    case "OVERRIDE": {
      const changes = d.changes && typeof d.changes === "object" ? Object.keys(d.changes) : [];
      return changes.length ? `corrected ${changes.join(", ")}` : "corrected product details";
    }
    case "RESEARCH_SUBMITTED":
      return "submitted the research";
    case "STAGE_CHANGED":
      return stage(d.to) ? `moved the product to ${stage(d.to)}` : "moved the product to the next stage";
    case "PRODUCT_APPROVED":
      return withNote("approved the product for testing", d);
    case "PRODUCT_REJECTED":
      return withNote("didn't approve the product", d);
    case "PRODUCT_SENT_BACK":
      return withNote(`sent the product back${stage(d.to) ? ` to ${stage(d.to)}` : ""}`, d);
    case "PRODUCT_KILLED":
      return withNote("dropped the product", d);
    case "PRODUCT_COMPLETED":
      return "marked the product completed";
    case "PRODUCT_DELETED":
      return "deleted the product";
    case "TASK_CREATED":
      return `created${on || " a task"}`;
    case "TASK_UNLOCKED":
      return `unlocked${on || " a task"}`;
    case "TASK_SUBMITTED":
      return `sent${on || " a task"} for review`;
    case "TASK_APPROVED":
      return `approved${on || " a task"}`;
    case "TASK_REVISION_REQUESTED":
      return withNote(`asked for changes on${on || " a task"}`, d);
    case "TASK_REASSIGNED":
      return `reassigned${on || " a task"}${str(d.toName) ? ` to ${str(d.toName)}` : ""}`;
    case "TASK_CANCELLED":
      return `cancelled${on || " a task"}`;
    case "TASK_REOPENED":
      return `reopened${on || " a task"}`;
    case "TASK_RELOCKED":
      return `locked${on || " a task"} again`;
    case "TASK_WITHDRAWN":
      return `took${on || " a task"} back to edit`;
    case "FOLLOW_UP_REQUESTED":
      return withNote(`asked for a follow-up on${on || " a task"}`, d);
    case "BRIEF_UPDATED":
      return "updated the creative brief";
    case "BATCH_REQUESTED":
      return `requested new creatives${str(d.name) ? ` “${str(d.name)}”` : ""}`;
    case "CAMPAIGN_LAUNCHED":
      return `launched campaign${str(d.name) ? ` “${str(d.name)}”` : ""}`;
    case "CAMPAIGN_STATUS_CHANGED":
      return withNote(`changed campaign${str(d.campaign) ? ` “${str(d.campaign)}”` : ""} status${str(d.to) ? ` to ${String(d.to).toLowerCase().replace(/_/g, " ")}` : ""}`, d);
    case "MOVED_TO_ORDERING":
      return "moved the product to ordering";
    case "ORDER_CREATED":
      return `added order${str(d.name) ? ` “${str(d.name)}”` : ""}`;
    case "ORDER_UPDATED":
      if (d.test) return `updated test order${str(d.name) ? ` “${str(d.name)}”` : ""}`;
      if (d.shipment !== undefined) return d.reorder ? "requested a reorder shipment" : "added a shipment";
      return "updated an order";
    case "SCALING_UPDATED":
      return "updated the scaling plan";
    case "COMMENT_ADDED":
      return d.moreTimeUntil ? `asked for more time on${on || " a task"}` : `commented${on ? ` on${on}` : ""}`;
    case "FOLDER_UPDATED":
      return "updated a link";
    case "ASSET_REACTED":
    case "ASSET_COMMENTED":
      return "gave feedback on creative work";
    default:
      return "made a change";
  }
}
