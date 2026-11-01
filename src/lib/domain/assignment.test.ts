import { describe, expect, it } from "vitest";
import { assignMany, pickAssignee, type Candidate } from "./assignment";

const d = (s: string) => new Date(s);
const c = (over: Partial<Candidate>): Candidate => ({
  id: "x",
  name: "X",
  role: "IMAGE_DESIGNER",
  active: true,
  openTaskCount: 0,
  lastAssignedAt: null,
  ...over,
});

describe("pickAssignee", () => {
  it("picks the person with the fewest open tasks", () => {
    const a = c({ id: "a", name: "A", openTaskCount: 3 });
    const b = c({ id: "b", name: "B", openTaskCount: 1 });
    expect(pickAssignee([a, b], "IMAGE_DESIGNER")?.id).toBe("b");
  });

  it("breaks ties by least recently assigned (never assigned first)", () => {
    const a = c({ id: "a", name: "A", lastAssignedAt: d("2026-10-01") });
    const b = c({ id: "b", name: "B", lastAssignedAt: d("2026-09-01") });
    const n = c({ id: "n", name: "N", lastAssignedAt: null });
    expect(pickAssignee([a, b], "IMAGE_DESIGNER")?.id).toBe("b");
    expect(pickAssignee([a, b, n], "IMAGE_DESIGNER")?.id).toBe("n");
  });

  it("ignores inactive people and other roles", () => {
    const a = c({ id: "a", active: false });
    const v = c({ id: "v", role: "VIDEO_EDITOR" });
    expect(pickAssignee([a, v], "IMAGE_DESIGNER")).toBeNull();
  });

  it("can exclude people", () => {
    const a = c({ id: "a", name: "A" });
    const b = c({ id: "b", name: "B", openTaskCount: 5 });
    expect(pickAssignee([a, b], "IMAGE_DESIGNER", { exclude: ["a"] })?.id).toBe("b");
  });
});

describe("assignMany", () => {
  it("spreads several tasks across people", () => {
    const a = c({ id: "a", name: "A" });
    const b = c({ id: "b", name: "B" });
    const v = c({ id: "v", name: "V", role: "VIDEO_EDITOR" });
    const now = d("2026-11-01");
    expect(assignMany([a, b, v], ["IMAGE_DESIGNER", "IMAGE_DESIGNER", "IMAGE_DESIGNER", "VIDEO_EDITOR"], now)).toEqual([
      "a",
      "b",
      "a",
      "v",
    ]);
  });

  it("returns null where nobody holds the role", () => {
    expect(assignMany([], ["MEDIA_BUYER"], new Date())).toEqual([null]);
  });
});
