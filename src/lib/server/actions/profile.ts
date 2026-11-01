"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { idSchema } from "@/lib/validation/common";
import { ActionError, defineAction } from "../action";
import { db } from "../db";

/** Set (or clear) your own profile photo. The image was uploaded to /api/assets first. */
export const setAvatarAction = defineAction({
  schema: z.object({ assetId: idSchema.nullable() }),
  run: async ({ assetId }, { user }) => {
    if (assetId) {
      const asset = await db.asset.findUnique({ where: { id: assetId }, select: { uploadedById: true } });
      if (!asset || asset.uploadedById !== user.id) throw new ActionError("Upload the photo again.");
    }
    await db.user.update({ where: { id: user.id }, data: { avatarAssetId: assetId } });
    revalidatePath("/", "layout");
    return { ok: true, message: assetId ? "Profile photo updated" : "Profile photo removed" };
  },
});
