import { describe, expect, it } from "vitest";
import { rateForMethod, shippingFromWeight, computeMargin, marginBand } from "./margin";

const base = { courierChargePct: "2" };

describe("computeMargin (all BDT)", () => {
  it("calculates landed cost, courier and margin", () => {
    // 425 + 85 = 510 landed; 1200 × 2% = 24 courier; 1200 − 510 − 24 = 666; 55.5%
    expect(computeMargin({ ...base, chinaPriceBdt: "425", shippingPerUnitBdt: "85", sellingPriceBdt: "1200" })).toEqual({
      landedCostBdt: "510.00",
      courierChargeBdt: "24.00",
      grossMarginBdt: "666.00",
      marginPct: "55.5",
    });
  });

  it("uses exact decimals", () => {
    const r = computeMargin({ courierChargePct: "2.5", chinaPriceBdt: "208.53", shippingPerUnitBdt: "53.37", sellingPriceBdt: "990" });
    expect(r).toMatchObject({ landedCostBdt: "261.90", courierChargeBdt: "24.75", grossMarginBdt: "703.35", marginPct: "71.0" });
  });

  it("can go negative", () => {
    const r = computeMargin({ ...base, chinaPriceBdt: "1020", shippingPerUnitBdt: "170", sellingPriceBdt: "1000" });
    expect(r?.grossMarginBdt).toBe("-210.00");
    expect(r?.marginPct).toBe("-21.0");
  });

  it("returns null until all prices are valid", () => {
    expect(computeMargin({ ...base, chinaPriceBdt: "25", shippingPerUnitBdt: "", sellingPriceBdt: "1200" })).toBeNull();
    expect(computeMargin({ ...base, chinaPriceBdt: "abc", shippingPerUnitBdt: "5", sellingPriceBdt: "1200" })).toBeNull();
    expect(computeMargin({ ...base, chinaPriceBdt: null, shippingPerUnitBdt: "5", sellingPriceBdt: "1200" })).toBeNull();
  });

  it("has no margin % for a zero selling price", () => {
    expect(computeMargin({ ...base, chinaPriceBdt: "1", shippingPerUnitBdt: "1", sellingPriceBdt: "0" })?.marginPct).toBeNull();
  });
});

describe("marginBand", () => {
  const t = { healthyMarginPct: "30", thinMarginPct: "15" };
  it("bands by thresholds", () => {
    expect(marginBand("30.0", t)).toBe("healthy");
    expect(marginBand("29.9", t)).toBe("ok");
    expect(marginBand("15.0", t)).toBe("ok");
    expect(marginBand("14.9", t)).toBe("thin");
  });
});

describe("shippingFromWeight", () => {
  it("multiplies weight by the rate per kg, rounded to 2 decimals", () => {
    expect(shippingFromWeight("0.35", "750")).toBe("262.50");
    expect(shippingFromWeight("1.234", "333.33")).toBe("411.33");
  });
  it("works for weights under 1 kg typed without the leading 0", () => {
    expect(shippingFromWeight(".150", "750")).toBe("112.50");
    expect(shippingFromWeight("0.150", "750")).toBe("112.50");
  });
  it("is null until both numbers are valid", () => {
    expect(shippingFromWeight("", "750")).toBeNull();
    expect(shippingFromWeight("0.5", null)).toBeNull();
    expect(shippingFromWeight("abc", "750")).toBeNull();
  });
});

describe("rateForMethod", () => {
  const rates = { air: "750", sea: "300" };
  it("picks the chosen method's rate", () => {
    expect(rateForMethod("AIR", rates)).toBe("750");
    expect(rateForMethod("SEA", rates)).toBe("300");
  });
  it("is null until a method is chosen", () => {
    expect(rateForMethod(null, rates)).toBeNull();
    expect(rateForMethod("SEA", { air: "750", sea: null })).toBeNull();
  });
});
