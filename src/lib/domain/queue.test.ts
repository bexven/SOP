import { describe, expect, it } from "vitest";
import { groupQueue } from "./queue";

const now = new Date("2026-11-01T04:00:00Z"); // 10:00 Dhaka
const item = (id: string, status: "TODO" | "REVISION" | "SUBMITTED" | "LOCKED", due: string | null, priority = "MEDIUM" as const) => ({
  id,
  status,
  dueAt: due ? new Date(due) : null,
  priority,
});

describe("groupQueue", () => {
  it("groups actionable tasks and sorts by due date then priority", () => {
    const g = groupQueue(
      [
        item("late", "TODO", "2026-10-31T04:00:00Z"),
        item("today", "TODO", "2026-11-01T10:00:00Z"),
        item("later", "TODO", "2026-11-05T10:00:00Z"),
        item("nodue-low", "TODO", null, "LOW" as never),
        item("nodue-urgent", "TODO", null, "URGENT" as never),
        item("rev", "REVISION", "2026-10-30T04:00:00Z"),
        item("review", "SUBMITTED", "2026-10-30T04:00:00Z"),
        item("locked", "LOCKED", null),
      ],
      now,
    );
    expect(g.overdue.map((i) => i.id)).toEqual(["late"]);
    expect(g.today.map((i) => i.id)).toEqual(["today"]);
    expect(g.upcoming.map((i) => i.id)).toEqual(["later", "nodue-urgent", "nodue-low"]);
    expect(g.revision.map((i) => i.id)).toEqual(["rev"]);
  });
});
