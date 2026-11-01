import { describe, expect, it } from "vitest";
import { brandSolid, brandText, brandThemeStyle, brandTint, contrast } from "./brand-color";

describe("brand colours", () => {
  it("keeps an already-accessible colour unchanged", () => {
    expect(brandSolid("#15803D")).toBe("#15803D");
    expect(contrast("#15803D", "#FFFFFF")).toBeGreaterThan(4.5);
  });
  it("darkens light colours so white text passes AA", () => {
    const solid = brandSolid("#FACC15");
    expect(contrast(solid, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
  it("pill text passes AA on its tint", () => {
    for (const c of ["#15803D", "#0369A1", "#FACC15", "#F43F5E"]) {
      expect(contrast(brandText(c), brandTint(c))).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("ignores invalid colours", () => {
    expect(brandThemeStyle("emerald")).toBeUndefined();
    expect(brandThemeStyle(null)).toBeUndefined();
  });
});
