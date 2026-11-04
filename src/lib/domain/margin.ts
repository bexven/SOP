import Decimal from "decimal.js";

/**
 * Live margin check (pure). All prices are in BDT (owner's rule).
 *   Shipping (BDT)     = weight (kg) × the rate per kg of the chosen method (Air or Sea, Settings)
 *   Landed cost (BDT)  = China unit price + shipping per unit
 *   Courier (BDT)      = selling price × courier %
 *   Gross margin (BDT) = selling price − landed cost − courier
 *   Margin %           = gross margin ÷ selling price × 100
 * Inputs are decimal strings (or null while the researcher is typing).
 */

export type MarginInput = {
  chinaPriceBdt: string | null;
  shippingPerUnitBdt: string | null;
  sellingPriceBdt: string | null;
  courierChargePct: string;
};

export type MarginResult = {
  landedCostBdt: string;
  courierChargeBdt: string;
  grossMarginBdt: string;
  /** Null when the selling price is zero. */
  marginPct: string | null;
};

export type MarginBand = "healthy" | "ok" | "thin";

function parse(value: string | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "" || !/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  return new Decimal(trimmed);
}

export type ShippingMethodKey = "AIR" | "SEA";
export const SHIPPING_METHOD_LABELS: Record<ShippingMethodKey, string> = { AIR: "Air", SEA: "Sea" };

/** The rate per kg for the chosen method (null until a method is chosen and its rate is set). */
export function rateForMethod(
  method: ShippingMethodKey | null | undefined,
  rates: { air: string | null; sea: string | null },
): string | null {
  if (method === "AIR") return rates.air;
  if (method === "SEA") return rates.sea;
  return null;
}

/** Shipping per unit = weight × rate per kg, rounded to paisa. Null until both are valid numbers. */
export function shippingFromWeight(weightKg: string | null | undefined, ratePerKgBdt: string | null | undefined): string | null {
  const weight = parse(weightKg);
  const rate = parse(ratePerKgBdt);
  if (!weight || !rate) return null;
  return weight.times(rate).toDecimalPlaces(2).toFixed(2);
}

/** Returns null until all three prices are valid numbers. */
export function computeMargin(input: MarginInput): MarginResult | null {
  const china = parse(input.chinaPriceBdt);
  const shipping = parse(input.shippingPerUnitBdt);
  const selling = parse(input.sellingPriceBdt);
  const courierPct = parse(input.courierChargePct);
  if (!china || !shipping || !selling || !courierPct) return null;

  const landed = china.plus(shipping);
  const courier = selling.times(courierPct).dividedBy(100);
  const gross = selling.minus(landed).minus(courier);
  const pct = selling.isZero() ? null : gross.dividedBy(selling).times(100);

  return {
    landedCostBdt: landed.toDecimalPlaces(2).toFixed(2),
    courierChargeBdt: courier.toDecimalPlaces(2).toFixed(2),
    grossMarginBdt: gross.toDecimalPlaces(2).toFixed(2),
    marginPct: pct === null ? null : pct.toDecimalPlaces(1).toFixed(1),
  };
}

/** Green ≥ healthy, amber between thresholds, red below thin. */
export function marginBand(marginPct: string, thresholds: { healthyMarginPct: string; thinMarginPct: string }): MarginBand {
  const pct = new Decimal(marginPct);
  if (pct.gte(thresholds.healthyMarginPct)) return "healthy";
  if (pct.lt(thresholds.thinMarginPct)) return "thin";
  return "ok";
}
