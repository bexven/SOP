import "server-only";
import type { z } from "zod";
import type { researchFieldsSchema } from "@/lib/validation/product";
import type { Tx } from "../db";
import { ActionError } from "../action";
import { rateForMethod, shippingFromWeight, type ShippingMethodKey } from "@/lib/domain/margin";

export type ResearchData = z.output<typeof researchFieldsSchema>;

/** Prisma data for research fields (dates as UTC midnight of the chosen day). */
export function researchData(input: ResearchData) {
  return {
    brandId: input.brandId,
    name: input.name,
    supplierUrl: input.supplierUrl,
    imageUrl: input.imageUrl,
    chinaPriceBdt: input.chinaPriceBdt,
    weightKg: input.weightKg,
    shippingMethod: input.shippingMethod,
    sellingPriceBdt: input.sellingPriceBdt,
    problemSolved: input.problemSolved,
    referenceLinks: input.referenceLinks,
    priority: input.priority,
    targetLaunchDate: input.targetLaunchDate ? new Date(`${input.targetLaunchDate}T00:00:00Z`) : null,
  };
}

export async function currentRates(tx: Tx) {
  const settings = await tx.settings.findUnique({ where: { id: 1 } });
  if (!settings) throw new ActionError("An Admin needs to set the exchange rates in Settings first.");
  return {
    rates: { rmbToBdtRate: settings.rmbToBdtRate, courierChargePct: settings.courierChargePct },
    settings,
  };
}

type Rate = { toString(): string } | null;

/**
 * Shipping for a product = its weight × the rate per kg of its method (owner's rule).
 * `rate` is the rate to use (today's Settings rate in Research, the product's frozen one afterwards).
 */
export function shippingData(weightKg: string | null, rate: Rate) {
  const ratePerKg = rate?.toString() ?? null;
  return { shippingPerUnitBdt: shippingFromWeight(weightKg, ratePerKg), shippingRatePerKgBdt: ratePerKg };
}

/** Today's Settings rate for a method. */
export function settingsRateFor(method: ShippingMethodKey | null, s: { shippingRatePerKgBdt: Rate; seaShippingRatePerKgBdt: Rate } | null) {
  if (!s) return null;
  return rateForMethod(method, { air: s.shippingRatePerKgBdt?.toString() ?? null, sea: s.seaShippingRatePerKgBdt?.toString() ?? null });
}

/**
 * Admin edit after research: re-work shipping from the new weight / method. The product keeps its frozen
 * rate while the method stays the same; a new method (or an older product without a rate) uses today's rate.
 * Returns {} when shipping can't be worked out, so the saved shipping is kept.
 */
export async function adminShippingData(
  tx: Tx,
  product: { shippingMethod: ShippingMethodKey | null; shippingRatePerKgBdt: Rate },
  weightKg: string | null,
  method: ShippingMethodKey | null,
) {
  if (!weightKg || !method) return {};
  const rate =
    method === product.shippingMethod && product.shippingRatePerKgBdt
      ? product.shippingRatePerKgBdt
      : settingsRateFor(method, await tx.settings.findUnique({ where: { id: 1 } }));
  const shipping = shippingData(weightKg, rate);
  return shipping.shippingPerUnitBdt ? shipping : {};
}
