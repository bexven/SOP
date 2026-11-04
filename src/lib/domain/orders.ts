import Decimal from "decimal.js";
import type { ScalePlan, ScaleVerdict } from "@/generated/prisma/enums";
import { computeMargin } from "./margin";

/**
 * Stock orders (pure). Each order keeps its own per-unit prices, independent
 * of the research prices, because supplier prices change between orders.
 *   Cost / unit     = buying price + shipping cost
 *   Courier / unit  = selling price × courier %
 *   Profit / unit   = selling − cost − courier
 *   Totals          = per unit × quantity
 */

export type OrderInput = {
  quantity: number;
  buyingPriceBdt: string;
  shippingCostBdt: string;
  sellingPriceBdt: string;
  courierChargePct: string;
};

export type OrderMath = {
  costPerUnit: string;
  profitPerUnit: string;
  marginPct: string | null;
  totalCost: string;
  expectedRevenue: string;
  expectedProfit: string;
};

export function orderMath(o: OrderInput): OrderMath | null {
  if (!Number.isInteger(o.quantity) || o.quantity < 1) return null;
  const m = computeMargin({
    chinaPriceBdt: o.buyingPriceBdt,
    shippingPerUnitBdt: o.shippingCostBdt,
    sellingPriceBdt: o.sellingPriceBdt,
    courierChargePct: o.courierChargePct,
  });
  if (!m) return null;
  const q = new Decimal(o.quantity);
  return {
    costPerUnit: m.landedCostBdt,
    profitPerUnit: m.grossMarginBdt,
    marginPct: m.marginPct,
    totalCost: new Decimal(m.landedCostBdt).times(q).toFixed(2),
    expectedRevenue: new Decimal(o.sellingPriceBdt).times(q).toFixed(2),
    expectedProfit: new Decimal(m.grossMarginBdt).times(q).toFixed(2),
  };
}

/** Totals across every order of a product. */
export function orderSummary(orders: OrderInput[]) {
  let units = 0;
  let cost = new Decimal(0);
  let profit = new Decimal(0);
  let revenue = new Decimal(0);
  for (const o of orders) {
    const m = orderMath(o);
    if (!m) continue;
    units += o.quantity;
    cost = cost.plus(m.totalCost);
    profit = profit.plus(m.expectedProfit);
    revenue = revenue.plus(m.expectedRevenue);
  }
  return {
    orders: orders.length,
    units,
    totalCost: cost.toFixed(2),
    expectedRevenue: revenue.toFixed(2),
    expectedProfit: profit.toFixed(2),
  };
}

export const SCALE_VERDICTS = ["YES", "NOT_SURE", "NO"] as const satisfies readonly ScaleVerdict[];
export const SCALE_VERDICT_LABELS: Record<ScaleVerdict, string> = { YES: "Scalable", NOT_SURE: "Not sure yet", NO: "Not scalable" };

export const SCALE_PLANS = ["SCALE_ADS", "INCREASE_ORDERS", "INVEST_MORE"] as const satisfies readonly ScalePlan[];
export const SCALE_PLAN_LABELS: Record<ScalePlan, string> = {
  SCALE_ADS: "Scale the product (bigger ad budget)",
  INCREASE_ORDERS: "Increase order quantities",
  INVEST_MORE: "Invest more heavily",
};

/** Only a live product can be moved to ordering (once). */
export function moveToOrderingError(p: { stage: string; orderingSince: Date | string | null }): string | null {
  if (p.orderingSince) return "This product is already in ordering.";
  if (p.stage !== "LIVE") return "Only a live product that is performing well can be moved to ordering.";
  return null;
}

/** Orders can be added once the product is in ordering, while live or after the campaign completed (never when killed). */
export function addOrderError(p: { stage: string; orderingSince: Date | string | null }): string | null {
  if (!p.orderingSince) return "Move the product to ordering first.";
  if (p.stage !== "LIVE" && p.stage !== "COMPLETED") return "Orders can't be added to a closed product.";
  return null;
}

/** An order's display name: the team's own name, or "Order #n" for older orders. */
export function orderTitle(o: { number: number; name: string | null }): string {
  return o.name?.trim() || `Order #${o.number}`;
}

export type TestOrderState = "confirmed" | "waiting" | "overdue";

/**
 * A test order shows a warning until someone confirms it (owner's rule).
 * Waiting until its expected date (Dhaka day, YYYY-MM-DD), overdue after that.
 */
export function testOrderState(t: { confirmedAt: string | Date | null; expectedOn: string | null }, todayDhaka: string): TestOrderState {
  if (t.confirmedAt) return "confirmed";
  if (t.expectedOn && t.expectedOn < todayDhaka) return "overdue";
  return "waiting";
}
