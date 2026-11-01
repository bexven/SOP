"use server";

import { revalidatePath } from "next/cache";
import {
  addTemplateItemSchema,
  reorderTemplateSchema,
  setTemplateItemActiveSchema,
  updateTemplateItemSchema,
} from "@/lib/validation/templates";
import { ActionError, defineAction } from "../action";
import { db } from "../db";

function done(message?: string) {
  revalidatePath("/settings", "layout");
  return { ok: true as const, message };
}

export const addTemplateItemAction = defineAction({
  capability: "settings.manage",
  schema: addTemplateItemSchema,
  run: async ({ taskType, label, required }) => {
    const last = await db.checklistTemplateItem.aggregate({ where: { taskType }, _max: { order: true } });
    await db.checklistTemplateItem.create({ data: { taskType, label, required, order: (last._max.order ?? -1) + 1 } });
    return done("Checklist item added");
  },
});

export const updateTemplateItemAction = defineAction({
  capability: "settings.manage",
  schema: updateTemplateItemSchema,
  run: async ({ id, label, required }) => {
    await db.checklistTemplateItem.update({ where: { id }, data: { label, required } });
    return done("Checklist item saved");
  },
});

export const setTemplateItemActiveAction = defineAction({
  capability: "settings.manage",
  schema: setTemplateItemActiveSchema,
  run: async ({ id, active }) => {
    await db.checklistTemplateItem.update({ where: { id }, data: { active } });
    return done(active ? "Item reactivated" : "Item deactivated — new tasks won't include it");
  },
});

export const reorderTemplateAction = defineAction({
  capability: "settings.manage",
  schema: reorderTemplateSchema,
  run: async ({ taskType, ids }) => {
    const existing = await db.checklistTemplateItem.findMany({ where: { taskType, active: true }, select: { id: true } });
    const set = new Set(existing.map((e) => e.id));
    if (ids.length !== set.size || ids.some((id) => !set.has(id))) {
      throw new ActionError("The checklist changed in the meantime. Refresh and try again.");
    }
    await db.$transaction(ids.map((id, order) => db.checklistTemplateItem.update({ where: { id }, data: { order } })));
    return done();
  },
});
