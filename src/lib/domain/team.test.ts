import { describe, expect, it } from "vitest";
import { canChangeRole, canDeactivate, type TeamMember } from "./team";

const admin: TeamMember = { id: "a1", role: "ADMIN", active: true };
const admin2: TeamMember = { id: "a2", role: "ADMIN", active: true };
const designer: TeamMember = { id: "d1", role: "IMAGE_DESIGNER", active: true };

describe("canDeactivate", () => {
  it("allows deactivating a regular member", () => {
    expect(canDeactivate(admin.id, designer, [admin, designer])).toEqual({ ok: true });
  });
  it("blocks deactivating yourself", () => {
    expect(canDeactivate(admin.id, admin, [admin, admin2]).ok).toBe(false);
  });
  it("blocks deactivating the last active admin", () => {
    const inactiveAdmin = { ...admin2, active: false };
    expect(canDeactivate("x", admin, [admin, inactiveAdmin]).ok).toBe(false);
    expect(canDeactivate("x", admin, [admin, admin2]).ok).toBe(true);
  });
  it("blocks deactivating someone already inactive", () => {
    expect(canDeactivate(admin.id, { ...designer, active: false }, [admin]).ok).toBe(false);
  });
});

describe("canChangeRole", () => {
  it("blocks removing your own admin role", () => {
    expect(canChangeRole(admin.id, admin, "MEDIA_BUYER", [admin, admin2]).ok).toBe(false);
  });
  it("blocks demoting the last active admin", () => {
    expect(canChangeRole("x", admin, "MEDIA_BUYER", [admin, designer]).ok).toBe(false);
  });
  it("allows demoting an admin when another remains", () => {
    expect(canChangeRole(admin2.id, admin, "MEDIA_BUYER", [admin, admin2]).ok).toBe(true);
  });
  it("allows any non-admin role change", () => {
    expect(canChangeRole(admin.id, designer, "VIDEO_EDITOR", [admin, designer]).ok).toBe(true);
  });
});
