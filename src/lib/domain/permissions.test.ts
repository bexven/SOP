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
  it("shows admin sections only to Admin", () => {
    expect(navItemsFor("ADMIN").map((i) => i.key)).toEqual([
      "queue",
      "pipeline",
      "products",
      "overview",
      "team",
      "settings",
    ]);
    for (const role of ROLES.filter((r) => r !== "ADMIN")) {
      expect(navItemsFor(role).map((i) => i.key)).toEqual(["queue", "pipeline", "products"]);
    }
  });
});
