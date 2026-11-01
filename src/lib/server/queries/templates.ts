import "server-only";
import { TASK_TYPES } from "@/lib/domain/labels";
import { db } from "../db";

export async function getChecklistTemplates() {
  const items = await db.checklistTemplateItem.findMany({ orderBy: [{ taskType: "asc" }, { order: "asc" }] });
  return TASK_TYPES.map((taskType) => ({
    taskType,
    items: items
      .filter((i) => i.taskType === taskType)
      .map((i) => ({ id: i.id, label: i.label, required: i.required, active: i.active, order: i.order })),
  }));
}

export type TemplateGroup = Awaited<ReturnType<typeof getChecklistTemplates>>[number];
