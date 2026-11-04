import { describe, expect, it } from "vitest";
import { orderMath, orderSummary } from "./orders";
import { orderTitle, testOrderState } from "./orders";

const o = { quantity: 100, buyingPriceBdt: "450", shippingCostBdt: "120", sellingPriceBdt: "1490", courierChargePct: "2" };

describe("orders", () => {
  it("works out per-unit and total cost and profit", () => {
    expect(orderMath(o)).toEqual({
      costPerUnit: "570.00",
      profitPerUnit: "890.20",
      marginPct: "59.7",
      totalCost: "57000.00",
      expectedRevenue: "149000.00",
      expectedProfit: "89020.00",
    });
  });
  it("needs a whole quantity of at least 1 and valid prices", () => {
    expect(orderMath({ ...o, quantity: 0 })).toBeNull();
    expect(orderMath({ ...o, quantity: 1.5 })).toBeNull();
    expect(orderMath({ ...o, buyingPriceBdt: "" })).toBeNull();
  });
  it("each order keeps its own prices; the summary adds them up", () => {
    const s = orderSummary([o, { ...o, quantity: 50, buyingPriceBdt: "500" }]);
    expect(s).toEqual({ orders: 2, units: 150, totalCost: "88000.00", expectedRevenue: "223500.00", expectedProfit: "131030.00" });
  });
});

import { addOrderError, moveToOrderingError } from "./orders";
describe("ordering gates", () => {
  it("moves only live products, once", () => {
    expect(moveToOrderingError({ stage: "LIVE", orderingSince: null })).toBeNull();
    expect(moveToOrderingError({ stage: "CREATIVE", orderingSince: null })).not.toBeNull();
    expect(moveToOrderingError({ stage: "LIVE", orderingSince: new Date() })).not.toBeNull();
  });
  it("adds orders only in ordering and not when killed", () => {
    expect(addOrderError({ stage: "LIVE", orderingSince: null })).not.toBeNull();
    expect(addOrderError({ stage: "LIVE", orderingSince: new Date() })).toBeNull();
    expect(addOrderError({ stage: "COMPLETED", orderingSince: new Date() })).toBeNull();
    expect(addOrderError({ stage: "KILLED", orderingSince: new Date() })).not.toBeNull();
  });
});

describe("order names and test orders", () => {
  it("uses the team's name, or Order #n for older orders", () => {
    expect(orderTitle({ number: 3, name: "Eid stock" })).toBe("Eid stock");
    expect(orderTitle({ number: 3, name: null })).toBe("Order #3");
    expect(orderTitle({ number: 3, name: "  " })).toBe("Order #3");
  });
  it("warns until a test order is confirmed, overdue after its expected day", () => {
    expect(testOrderState({ confirmedAt: null, expectedOn: "2026-11-10" }, "2026-11-05")).toBe("waiting");
    expect(testOrderState({ confirmedAt: null, expectedOn: "2026-11-10" }, "2026-11-10")).toBe("waiting");
    expect(testOrderState({ confirmedAt: null, expectedOn: "2026-11-10" }, "2026-11-11")).toBe("overdue");
    expect(testOrderState({ confirmedAt: "2026-11-09T10:00:00Z", expectedOn: "2026-11-10" }, "2026-11-12")).toBe("confirmed");
    expect(testOrderState({ confirmedAt: null, expectedOn: null }, "2026-11-12")).toBe("waiting");
  });
});
