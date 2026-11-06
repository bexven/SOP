import { describe, expect, it } from "vitest";
import { reminderKind } from "./reminders";

const due = new Date("2026-11-06T12:00:00Z");
const at = (iso: string) => new Date(iso);
const t = (o: Partial<{ dueSoonNotifiedAt: Date | null; overdueNotifiedAt: Date | null }> = {}) => ({ dueAt: due, dueSoonNotifiedAt: null, overdueNotifiedAt: null, ...o });

describe("due reminders", () => {
  it("says nothing until 3 hours before", () => {
    expect(reminderKind(t(), at("2026-11-06T08:59:00Z"))).toBeNull();
  });
  it("sends one 'due soon' in the last 3 hours", () => {
    expect(reminderKind(t(), at("2026-11-06T09:30:00Z"))).toBe("soon");
    expect(reminderKind(t({ dueSoonNotifiedAt: at("2026-11-06T09:30:00Z") }), at("2026-11-06T10:00:00Z"))).toBeNull();
  });
  it("sends one 'overdue' once the time has passed", () => {
    expect(reminderKind(t({ dueSoonNotifiedAt: at("2026-11-06T09:30:00Z") }), at("2026-11-06T12:05:00Z"))).toBe("overdue");
    expect(reminderKind(t({ overdueNotifiedAt: at("2026-11-06T12:05:00Z") }), at("2026-11-06T15:00:00Z"))).toBeNull();
  });
  it("re-arms when the due time moves later", () => {
    const later = { dueAt: at("2026-11-08T12:00:00Z"), dueSoonNotifiedAt: at("2026-11-06T09:30:00Z"), overdueNotifiedAt: at("2026-11-06T12:05:00Z") };
    expect(reminderKind(later, at("2026-11-08T10:00:00Z"))).toBe("soon");
  });
  it("ignores tasks without a due time", () => {
    expect(reminderKind({ dueAt: null, dueSoonNotifiedAt: null, overdueNotifiedAt: null }, at("2026-11-06T12:05:00Z"))).toBeNull();
  });
});
