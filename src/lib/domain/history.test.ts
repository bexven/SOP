import { describe, expect, it } from "vitest";
import { describeEvent } from "./history";

describe("history lines", () => {
  it("describes common events", () => {
    expect(describeEvent("TASK_APPROVED", null, "Main video")).toBe("approved Main video");
    expect(describeEvent("TASK_REVISION_REQUESTED", { note: "Brighter" }, "Square ads")).toBe("asked for changes on Square ads — “Brighter”");
    expect(describeEvent("PRODUCT_SENT_BACK", { to: "RESEARCH" }, null)).toBe("sent the product back to Research");
    expect(describeEvent("ORDER_CREATED", { name: "Eid stock" }, null)).toBe("added order “Eid stock”");
  });
  it("never fails on odd data", () => {
    expect(describeEvent("PRODUCT_UPDATED", { fields: "x" }, null)).toBe("updated product details");
    expect(describeEvent("STAGE_CHANGED", undefined, null)).toBe("moved the product to the next stage");
  });
});
