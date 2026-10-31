"use server";

import { revalidatePath } from "next/cache";
import { validateThresholds } from "@/lib/domain/settings";
import { generalSettingsSchema, slaSchema } from "@/lib/validation/settings";
import { defineAction } from "../action";
import { db } from "../db";

export const updateGeneralSettingsAction = defineAction({
  capability: "settings.manage",
  schema: generalSettingsSchema,
  run: async (input, { user }) => {
    const thresholdError = validateThresholds(input);
    if (thresholdError) return { ok: false, error: thresholdError, fieldErrors: { thinMarginPct: [thresholdError] } };
    await db.settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...input, updatedById: user.id },
      update: { ...input, updatedById: user.id },
    });
    revalidatePath("/settings");
    return { ok: true, message: "Settings saved" };
  },
});

export const updateSlaAction = defineAction({
  capability: "settings.manage",
  schema: slaSchema,
  run: async ({ sla }, { user }) => {
    await db.$transaction(
      sla.map(({ taskType, slaHours }) =>
        db.taskTypeConfig.upsert({
          where: { taskType },
          create: { taskType, slaHours, updatedById: user.id },
          update: { slaHours, updatedById: user.id },
        }),
      ),
    );
    revalidatePath("/settings");
    return { ok: true, message: "SLAs saved" };
  },
});
