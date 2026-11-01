import { describe, expect, it } from "vitest";
import { ROLES } from "./labels";
import { navItemsFor } from "./nav";
import { CAPABILITIES, can, type Capability } from "./permissions";

describe("permissions", () => {
  it("gives Admin every capability", () => {
    for (const cap of Object.keys(CAPABILITIES) as Capability[]) {
      expect(can("ADMIN", cap)).toBe(true);
    }
  });

  it("restricts team and settings management to Admin", () => {
    for (const role of ROLES.filter((r) => r !== "ADMIN")) {
      expect(can(role, "team.manage")).toBe(false);
      expect(can(role, "settings.manage")).toBe(false);
      expect(can(role, "overview.view")).toBe(false);
    }
  });

  it("lets only Researchers (and Admin) create products", () => {
    expect(can("RESEARCHER", "product.create")).toBe(true);
    expect(can("IMAGE_DESIGNER", "product.create")).toBe(false);
    expect(can("MEDIA_BUYER", "product.create")).toBe(false);
  });

  it("lets Media Buyers review, brief, launch and kill", () => {
    for (const cap of ["task.review", "brief.edit", "campaign.manage", "product.kill"] as const) {
      expect(can("MEDIA_BUYER", cap)).toBe(true);
      expect(can("IMAGE_DESIGNER", cap)).toBe(false);
    }
  });
});

describe("navigation", () => {
  const keys = (r: Parameters<typeof navItemsFor>[0]) => navItemsFor(r).map((i) => i.key);
  it("gives Admin every menu", () => {
    expect(keys("ADMIN")).toEqual(["dashboard", "research", "creative", "pipeline", "products", "overview", "team", "settings"]);
  });
  it("shows Research only to researchers (and Admin)", () => {
    expect(keys("RESEARCHER")).toEqual(["dashboard", "research", "pipeline", "products"]);
  });
  it("shows Creative to designers, editors and media buyers", () => {
    for (const r of ["IMAGE_DESIGNER", "VIDEO_EDITOR", "MEDIA_BUYER"] as const) {
      expect(keys(r)).toEqual(["dashboard", "creative", "pipeline", "products"]);
    }
  });
});
