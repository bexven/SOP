"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { idSchema } from "@/lib/validation/common";
import { ActionError, defineAction } from "../action";
import { db } from "../db";

const name = z.string().trim().min(2, "Brand name is too short").max(40);
const color = z.enum(["sky", "amber", "violet", "emerald", "rose", "orange", "indigo", "slate"]);

export const saveBrandAction = defineAction({
  capability: "settings.manage",
  schema: z.object({ id: idSchema.optional(), name, color, active: z.boolean().default(true) }),
  run: async ({ id, name, color, active }) => {
    const clash = await db.brand.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) } });
    if (clash) throw new ActionError("A brand with that name already exists.");
    if (id) await db.brand.update({ where: { id }, data: { name, color, active } });
    else {
      const last = await db.brand.aggregate({ _max: { order: true } });
      await db.brand.create({ data: { name, color, order: (last._max.order ?? -1) + 1 } });
    }
    revalidatePath("/", "layout");
    return { ok: true, message: id ? "Brand saved" : `${name} added` };
  },
});
