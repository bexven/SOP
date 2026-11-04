import { z } from "zod";

export const pushDeviceSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(4).max(200) }),
  label: z.string().trim().max(120).optional().transform((v) => v || null),
  /** Background re-sync on page load: don't refresh pages. */
  silent: z.boolean().optional(),
});
export const removePushSchema = z.object({ endpoint: z.string().url().max(2000) });
export const alertPrefsSchema = z.object({ instant: z.boolean(), digest: z.boolean() });
export const botTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/, "That doesn't look like a bot token. Copy the whole token BotFather sent (numbers:letters)."),
});
export const emptySchema = z.object({}).optional().default({});
