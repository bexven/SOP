import { describe, expect, it } from "vitest";
import { formatBdt, formatDate, formatDateTime, productRef } from "./format";
import { validateThresholds } from "./domain/settings";

describe("formatBdt", () => {
  it("uses lakh grouping", () => {
    expect(formatBdt(125000)).toBe("৳1,25,000");
    expect(formatBdt("1234567.5")).toBe("৳12,34,567.5");
    expect(formatBdt(-500)).toBe("−৳500");
  });
});

describe("Dhaka dates", () => {
  it("renders in Asia/Dhaka regardless of server TZ", () => {
    // 20:30 UTC on 31 Oct is 02:30 on 1 Nov in Dhaka.
    const d = new Date("2026-10-31T20:30:00Z");
    expect(formatDate(d)).toBe("1 Nov 2026");
    expect(formatDateTime(d)).toMatch(/^1 Nov, 2:30\s?am$/i);
  });
});

describe("productRef", () => {
  it("pads to four digits", () => {
    expect(productRef(42)).toBe("PRD-0042");
    expect(productRef(12345)).toBe("PRD-12345");
  });
});

describe("validateThresholds", () => {
  it("requires thin < healthy", () => {
    expect(validateThresholds({ healthyMarginPct: "30", thinMarginPct: "15" })).toBeNull();
    expect(validateThresholds({ healthyMarginPct: "15", thinMarginPct: "15" })).not.toBeNull();
  });
});
