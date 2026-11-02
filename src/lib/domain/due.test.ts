import { describe, expect, it } from "vitest";
import { dueAtFrom, dueBucket, dueLabel, startOfDhakaDay } from "./due";

describe("dueAtFrom", () => {
  it("adds SLA hours", () => {
    expect(dueAtFrom(new Date("2026-11-01T00:00:00Z"), 24)?.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(dueAtFrom(new Date(), null)).toBeNull();
    expect(dueAtFrom(new Date(), 0)).toBeNull();
  });
});

describe("dueBucket (Asia/Dhaka)", () => {
  // 1 Nov 2026 10:00 Dhaka = 04:00 UTC
  const now = new Date("2026-11-01T04:00:00Z");
  it("overdue when past", () => expect(dueBucket(new Date("2026-11-01T03:59:00Z"), now)).toBe("overdue"));
  it("today when later the same Dhaka day", () => {
    // 23:59 Dhaka on 1 Nov = 17:59 UTC
    expect(dueBucket(new Date("2026-11-01T17:59:00Z"), now)).toBe("today");
  });
  it("upcoming from Dhaka midnight", () => {
    // 00:00 Dhaka on 2 Nov = 18:00 UTC 1 Nov — still 1 Nov in UTC, but tomorrow in Dhaka
    expect(dueBucket(new Date("2026-11-01T18:00:00Z"), now)).toBe("upcoming");
  });
  it("null without a due date", () => expect(dueBucket(null, now)).toBeNull());
});

describe("startOfDhakaDay", () => {
  it("is 18:00 UTC the previous day", () => {
    expect(startOfDhakaDay(new Date("2026-11-01T04:00:00Z")).toISOString()).toBe("2026-10-31T18:00:00.000Z");
  });
});

describe("dueLabel", () => {
  const now = new Date("2026-11-01T04:00:00Z");
  it("labels overdue", () => {
    expect(dueLabel(new Date("2026-11-01T03:30:00Z"), now)).toBe("Overdue");
    expect(dueLabel(new Date("2026-10-31T22:00:00Z"), now)).toBe("Overdue 6h");
    expect(dueLabel(new Date("2026-10-29T04:00:00Z"), now)).toBe("Overdue 3d");
  });
  it("labels today and tomorrow in Dhaka time", () => {
    expect(dueLabel(new Date("2026-11-01T11:00:00Z"), now)).toMatch(/^Due 5:00\s?pm$/i);
    expect(dueLabel(new Date("2026-11-02T03:00:00Z"), now)).toMatch(/^Due tomorrow 9:00\s?am$/i);
    expect(dueLabel(new Date("2026-11-12T03:00:00Z"), now)).toBe("Due 12 Nov");
  });
});
