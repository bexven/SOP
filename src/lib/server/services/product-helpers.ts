import "server-only";
import type { z } from "zod";
import type { researchFieldsSchema } from "@/lib/validation/product";
import type { Tx } from "../db";
import { ActionError } from "../action";

export type ResearchData = z.output<typeof researchFieldsSchema>;

/** Prisma data for research fields (dates as UTC midnight of the chosen day). */
export function researchData(input: ResearchData) {
  return {
    name: input.name,
    supplierUrl: input.supplierUrl,
    imageUrl: input.imageUrl,
    chinaPriceRmb: input.chinaPriceRmb,
    shippingPerUnitRmb: input.shippingPerUnitRmb,
    sellingPriceBdt: input.sellingPriceBdt,
    targetCustomer: input.targetCustomer,
    problemSolved: input.problemSolved,
    sellingAngle: input.sellingAngle,
    referenceLinks: input.referenceLinks,
    priority: input.priority,
    targetLaunchDate: input.targetLaunchDate ? new Date(`${input.targetLaunchDate}T00:00:00Z`) : null,
  };
}

export async function currentRates(tx: Tx) {
  const settings = await tx.settings.findUnique({ where: { id: 1 } });
  if (!settings) throw new ActionError("An Admin needs to set the exchange rates in Settings first.");
  return { rmbToBdtRate: settings.rmbToBdtRate, courierChargePct: settings.courierChargePct };
}
