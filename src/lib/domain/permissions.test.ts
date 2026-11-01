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
  const keys = (r: Parameters<typeof navItemsFor>[0], isMaster = false) => navItemsFor(r, { isMaster }).map((i) => i.key);
  it("gives the Master Admin every menu", () => {
    expect(keys("ADMIN", true)).toEqual(["dashboard", "research", "creative", "pipeline", "products", "overview", "team", "settings"]);
  });
  it("hides Team from admins who aren't the master", () => {
    expect(keys("ADMIN")).toEqual(["dashboard", "research", "creative", "pipeline", "products", "overview", "settings"]);
  });
  it("shows all main tabs to everyone except Research for image/video makers", () => {
    for (const r of ["RESEARCHER", "MEDIA_BUYER", "REVIEWER"] as const) {
      expect(keys(r)).toEqual(["dashboard", "research", "creative", "pipeline", "products"]);
    }
    for (const r of ["IMAGE_DESIGNER", "VIDEO_EDITOR"] as const) {
      expect(keys(r)).toEqual(["dashboard", "creative", "pipeline", "products"]);
    }
  });
});

import { canSeeProduct } from "./permissions";
describe("early-stage visibility", () => {
  it("hides research and review from image/video makers until approved", () => {
    expect(canSeeProduct("IMAGE_DESIGNER", "RESEARCH", null)).toBe(false);
    expect(canSeeProduct("VIDEO_EDITOR", "REVIEW", null)).toBe(false);
    expect(canSeeProduct("VIDEO_EDITOR", "KILLED", "REVIEW")).toBe(false);
    expect(canSeeProduct("VIDEO_EDITOR", "CREATIVE", null)).toBe(true);
    expect(canSeeProduct("MEDIA_BUYER", "RESEARCH", null)).toBe(true);
    expect(canSeeProduct("REVIEWER", "REVIEW", null)).toBe(true);
  });
  it("lets reviewers approve and review creative", () => {
    expect(can("REVIEWER", "product.approve")).toBe(true);
    expect(can("REVIEWER", "task.review")).toBe(true);
    expect(can("MEDIA_BUYER", "product.approve")).toBe(false);
  });
});
