import Decimal from "decimal.js";

/** Business-rule validation for Settings (pure). */

export type MarginThresholds = { healthyMarginPct: string; thinMarginPct: string };

export function validateThresholds(t: MarginThresholds): string | null {
  const healthy = new Decimal(t.healthyMarginPct);
  const thin = new Decimal(t.thinMarginPct);
  if (thin.gte(healthy)) {
    return "The thin threshold must be lower than the healthy threshold.";
  }
  return null;
}
