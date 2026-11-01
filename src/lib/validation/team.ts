import { z } from "zod";
import { Role } from "@/generated/prisma/enums";
import { AVATAR_COLORS } from "@/lib/domain/labels";
import { idSchema, pinSchema } from "./common";

const name = z.string().trim().min(2, "Name must be at least 2 characters").max(40, "Name is too long");
const role = z.enum(Role);
const avatarColor = z.enum(AVATAR_COLORS);

export const createMemberSchema = z.object({ name, role, avatarColor, pin: pinSchema, adminAccess: z.boolean().default(false) });
export const updateMemberSchema = z.object({ id: idSchema, name, role, avatarColor, adminAccess: z.boolean().default(false) });
export const setActiveSchema = z.object({ id: idSchema, active: z.boolean() });
export const resetPinSchema = z.object({ id: idSchema, pin: pinSchema, requireChange: z.boolean().default(false) });
export const unlockSchema = z.object({ id: idSchema });

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
