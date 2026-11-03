import { describe, expect, it } from "vitest";
import { buildDigest, dhakaDate, digestDue } from "./digest";

const none = { todo: 0, overdue: 0, dueToday: 0, revision: 0, review: 0, approvals: 0, mentions: 0 };

describe("morning summary", () => {
  it("nothing waiting → no message", () => {
    expect(buildDigest("Kamrul", none)).toBeNull();
  });
  it("lists only what's waiting, most urgent first", () => {
    const d = buildDigest("Sk Moni", { ...none, todo: 3, overdue: 1, revision: 1, mentions: 2 })!;
    expect(d.title).toBe("Good morning, Sk");
    expect(d.lines).toEqual(["⏰ 1 task overdue", "📝 3 tasks to do", "🔁 1 task sent back for changes", "💬 2 new mentions"]);
    expect(d.total).toBe(6);
  });
  it("reviewers hear about reviews and approvals", () => {
    expect(buildDigest("Inamul", { ...none, review: 2, approvals: 1 })!.lines).toEqual([
      "👀 2 waiting for your review",
      "✅ 1 product waiting for your approval",
    ]);
  });
  it("goes out once per Dhaka day, from 10:00", () => {
    expect(digestDue(new Date("2026-11-03T03:59:00Z"), null)).toBe(false); // 09:59 Dhaka
    expect(digestDue(new Date("2026-11-03T04:00:00Z"), null)).toBe(true); // 10:00 Dhaka
    expect(digestDue(new Date("2026-11-03T04:30:00Z"), "2026-11-03")).toBe(false); // already sent
    expect(digestDue(new Date("2026-11-03T19:00:00Z"), "2026-11-03")).toBe(false); // 01:00 next day: before 10:00
    expect(digestDue(new Date("2026-11-04T04:05:00Z"), "2026-11-03")).toBe(true); // 10:05 next day
  });
  it("uses the Dhaka date", () => {
    expect(dhakaDate(new Date("2026-11-03T19:00:00Z"))).toBe("2026-11-04");
  });
});
