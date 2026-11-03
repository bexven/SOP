"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { idSchema } from "@/lib/validation/common";
import { ActionError, defineAction } from "../action";
import { db } from "../db";
import { HEX_COLOR } from "@/lib/brand-color";

const name = z.string().trim().min(2, "Brand name is too short").max(40);
const color = z.string().trim().regex(HEX_COLOR, "Pick a colour like #15803D").transform((c) => c.toUpperCase());

export const saveBrandAction = defineAction({
  capability: "settings.manage",
  schema: z.object({ id: idSchema.optional(), name, color, active: z.boolean().default(true), restricted: z.boolean().optional() }),
  run: async ({ id, name, color, active, restricted }, { user }) => {
    // Only the Master Admin decides which brands are restricted.
    const restrictedData = user.isMaster && restricted !== undefined ? { restricted } : {};
    const clash = await db.brand.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) } });
    if (clash) throw new ActionError("A brand with that name already exists.");
    if (id) await db.brand.update({ where: { id }, data: { name, color, active, ...restrictedData } });
    else {
      const last = await db.brand.aggregate({ _max: { order: true } });
      await db.brand.create({ data: { name, color, order: (last._max.order ?? -1) + 1, ...restrictedData } });
    }
    revalidatePath("/", "layout");
    return { ok: true, message: id ? "Brand saved" : `${name} added` };
  },
});
