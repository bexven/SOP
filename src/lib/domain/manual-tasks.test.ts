import { describe, expect, it } from "vitest";
import { canEditManualTask, completedAtFor, manualTaskRef, positionBetween } from "./manual-tasks";

describe("manual tasks", () => {
  it("formats the reference", () => {
    expect(manualTaskRef(12)).toBe("T-12");
  });

  it("lets the creator, assignee and Admins edit", () => {
    const task = { createdById: "a", assigneeId: "b" };
    expect(canEditManualTask({ id: "a", role: "MEDIA_BUYER" }, task)).toBe(true);
    expect(canEditManualTask({ id: "b", role: "VIDEO_EDITOR" }, task)).toBe(true);
    expect(canEditManualTask({ id: "c", role: "ADMIN" }, task)).toBe(true);
    expect(canEditManualTask({ id: "c", role: "MEDIA_BUYER" }, task)).toBe(false);
  });

  it("places dropped cards between neighbours", () => {
    expect(positionBetween(null, null)).toBe(1000);
    expect(positionBetween(null, 1000)).toBe(0);
    expect(positionBetween(2000, null)).toBe(3000);
    expect(positionBetween(1000, 2000)).toBe(1500);
  });

  it("stamps completion only when a task reaches Done", () => {
    const now = new Date("2026-11-04T10:00:00Z");
    const before = new Date("2026-11-01T10:00:00Z");
    expect(completedAtFor("IN_REVIEW", "DONE", null, now)).toEqual(now);
    expect(completedAtFor("DONE", "DONE", before, now)).toEqual(before);
    expect(completedAtFor("DONE", "TODO", before, now)).toBeNull();
  });
});
