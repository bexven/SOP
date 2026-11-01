import Decimal from "decimal.js";

/**
 * Live margin check (pure).
 *   Landed cost (BDT)  = (China price + shipping per unit) × RMB→BDT rate
 *   Courier (BDT)      = selling price × courier %
 *   Gross margin (BDT) = selling price − landed cost − courier
 *   Margin %           = gross margin ÷ selling price × 100
 * All inputs are decimal strings (or null while the researcher is typing).
 */

export type MarginInput = {
  chinaPriceRmb: string | null;
  shippingPerUnitRmb: string | null;
  sellingPriceBdt: string | null;
  rmbToBdtRate: string;
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

function parse(value: string | null): Decimal | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === "" || !/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  return new Decimal(trimmed);
}

/** Returns null until all three prices are valid numbers. */
export function computeMargin(input: MarginInput): MarginResult | null {
  const china = parse(input.chinaPriceRmb);
  const shipping = parse(input.shippingPerUnitRmb);
  const selling = parse(input.sellingPriceBdt);
  const rate = parse(input.rmbToBdtRate);
  const courierPct = parse(input.courierChargePct);
  if (!china || !shipping || !selling || !rate || !courierPct) return null;

  const landed = china.plus(shipping).times(rate);
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
