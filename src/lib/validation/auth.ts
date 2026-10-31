import { z } from "zod";
import { idSchema, pinSchema } from "./common";

export const loginSchema = z.object({ userId: idSchema, pin: z.string().min(1).max(6) });

export const changePinSchema = z
  .object({ pin: pinSchema, confirm: z.string() })
  .refine((v) => v.pin === v.confirm, { message: "PINs don't match", path: ["confirm"] });
