import { describe, expect, it } from "vitest";
import { canEditProduct, isAssignedToProduct } from "./product-access";

const p = { mediaBuyerId: "mb", assigneeIds: ["designer", null, "editor"] };

describe("product edit access", () => {
  it("lets Admins edit any product", () => {
    expect(canEditProduct({ id: "boss", role: "ADMIN" }, p)).toBe(true);
  });
  it("lets the media buyer and anyone with a task on it edit", () => {
    expect(isAssignedToProduct("mb", p)).toBe(true);
    expect(canEditProduct({ id: "designer", role: "IMAGE_DESIGNER" }, p)).toBe(true);
    expect(canEditProduct({ id: "editor", role: "VIDEO_EDITOR" }, p)).toBe(true);
  });
  it("leaves everyone else view-only, even with broad permissions", () => {
    expect(canEditProduct({ id: "reviewer", role: "REVIEWER" }, p)).toBe(false);
    expect(canEditProduct({ id: "other-mb", role: "MEDIA_BUYER" }, { mediaBuyerId: null, assigneeIds: [] })).toBe(false);
  });
  it("lets people with 'Edit every product' edit unassigned products", () => {
    expect(canEditProduct({ id: "reviewer", role: "REVIEWER", permissions: ["product.editAll"] }, p)).toBe(true);
  });
});
