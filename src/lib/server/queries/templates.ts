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

export async function getStepGuides() {
  const rows = await db.taskTypeConfig.findMany();
  const byType = new Map(rows.map((r) => [r.taskType, r]));
  return TASK_TYPES.map((taskType) => {
    const r = byType.get(taskType);
    return {
      taskType,
      configured: Boolean(r),
      body: r?.guideBody ?? "",
      links: Array.isArray(r?.guideLinks) ? (r!.guideLinks as { label: string; url: string }[]) : [],
      updatedAt: r?.updatedAt.toISOString() ?? null,
    };
  });
}

export type GuideRow = Awaited<ReturnType<typeof getStepGuides>>[number];
