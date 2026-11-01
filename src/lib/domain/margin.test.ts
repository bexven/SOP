import { describe, expect, it } from "vitest";
import { computeMargin, marginBand } from "./margin";

const base = { rmbToBdtRate: "17", courierChargePct: "2" };

describe("computeMargin", () => {
  it("calculates landed cost, courier and margin", () => {
    // (25 + 5) × 17 = 510 landed; 1200 × 2% = 24 courier; 1200 − 510 − 24 = 666; 55.5%
    expect(computeMargin({ ...base, chinaPriceRmb: "25", shippingPerUnitRmb: "5", sellingPriceBdt: "1200" })).toEqual({
      landedCostBdt: "510.00",
      courierChargeBdt: "24.00",
      grossMarginBdt: "666.00",
      marginPct: "55.5",
    });
  });

  it("uses exact decimals (no float drift)", () => {
    const r = computeMargin({
      rmbToBdtRate: "16.9512",
      courierChargePct: "2.5",
      chinaPriceRmb: "12.30",
      shippingPerUnitRmb: "3.15",
      sellingPriceBdt: "990",
    });
    // (15.45 × 16.9512) = 261.89604 → 261.90; courier 24.75; gross 703.35396 → 703.35
    expect(r).toMatchObject({ landedCostBdt: "261.90", courierChargeBdt: "24.75", grossMarginBdt: "703.35", marginPct: "71.0" });
  });

  it("can go negative", () => {
    const r = computeMargin({ ...base, chinaPriceRmb: "60", shippingPerUnitRmb: "10", sellingPriceBdt: "1000" });
    expect(r?.grossMarginBdt).toBe("-210.00");
    expect(r?.marginPct).toBe("-21.0");
  });

  it("returns null until all prices are valid", () => {
    expect(computeMargin({ ...base, chinaPriceRmb: "25", shippingPerUnitRmb: "", sellingPriceBdt: "1200" })).toBeNull();
    expect(computeMargin({ ...base, chinaPriceRmb: "abc", shippingPerUnitRmb: "5", sellingPriceBdt: "1200" })).toBeNull();
    expect(computeMargin({ ...base, chinaPriceRmb: null, shippingPerUnitRmb: "5", sellingPriceBdt: "1200" })).toBeNull();
  });

  it("has no margin % for a zero selling price", () => {
    expect(computeMargin({ ...base, chinaPriceRmb: "1", shippingPerUnitRmb: "1", sellingPriceBdt: "0" })?.marginPct).toBeNull();
  });
});

describe("marginBand", () => {
  const t = { healthyMarginPct: "30", thinMarginPct: "15" };
  it("bands by thresholds", () => {
    expect(marginBand("30.0", t)).toBe("healthy");
    expect(marginBand("29.9", t)).toBe("ok");
    expect(marginBand("15.0", t)).toBe("ok");
    expect(marginBand("14.9", t)).toBe("thin");
    expect(marginBand("-5", t)).toBe("thin");
  });
});
