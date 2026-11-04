import "server-only";
import { TASK_TYPES } from "@/lib/domain/labels";
import { db } from "../db";

export async function getGeneralSettings() {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  if (!s) return null;
  return {
    rmbToBdtRate: s.rmbToBdtRate.toString(),
    usdToBdtRate: s.usdToBdtRate.toString(),
    courierChargePct: s.courierChargePct.toString(),
    shippingRatePerKgBdt: s.shippingRatePerKgBdt?.toString() ?? "",
    healthyMarginPct: s.healthyMarginPct.toString(),
    thinMarginPct: s.thinMarginPct.toString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function getSlaSettings() {
  const rows = await db.taskTypeConfig.findMany({ select: { taskType: true, slaHours: true } });
  const byType = new Map(rows.map((r) => [r.taskType, r.slaHours]));
  return TASK_TYPES.map((taskType) => ({ taskType, slaHours: byType.get(taskType) ?? null }));
}
