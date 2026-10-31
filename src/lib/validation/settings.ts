import { z } from "zod";
import { TaskType } from "@/generated/prisma/enums";
import { decimalString } from "./common";

export const generalSettingsSchema = z.object({
  rmbToBdtRate: decimalString({ label: "RMB → BDT rate", max: 1000 }),
  usdToBdtRate: decimalString({ label: "USD → BDT rate", max: 10000 }),
  courierChargePct: decimalString({ label: "Courier charge", max: 100, allowZero: true, maxDecimals: 2 }),
  healthyMarginPct: decimalString({ label: "Healthy margin", max: 100, maxDecimals: 2 }),
  thinMarginPct: decimalString({ label: "Thin margin", max: 100, allowZero: true, maxDecimals: 2 }),
});

export const slaSchema = z.object({
  sla: z.array(
    z.object({
      taskType: z.enum(TaskType),
      slaHours: z.coerce.number().int("Whole hours only").min(1, "At least 1 hour").max(24 * 60, "Too long"),
    }),
  ),
});

export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;
