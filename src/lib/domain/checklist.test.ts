import { describe, expect, it } from "vitest";
import { isChecklistComplete, missingRequiredCount, reorder, snapshotChecklist } from "./checklist";

describe("snapshotChecklist", () => {
  it("copies active items in order and renumbers", () => {
    expect(
      snapshotChecklist([
        { label: "B", required: false, order: 5, active: true },
        { label: "Hidden", required: true, order: 1, active: false },
        { label: "A", required: true, order: 2, active: true },
      ]),
    ).toEqual([
      { label: "A", required: true, order: 0 },
      { label: "B", required: false, order: 1 },
    ]);
  });
  it("can be empty", () => expect(snapshotChecklist([])).toEqual([]));
});

describe("completeness", () => {
  it("only required items gate submission", () => {
    const items = [
      { required: true, checked: true },
      { required: false, checked: false },
      { required: true, checked: false },
    ];
    expect(missingRequiredCount(items)).toBe(1);
    expect(isChecklistComplete(items)).toBe(false);
    expect(isChecklistComplete([{ required: false, checked: false }])).toBe(true);
    expect(isChecklistComplete([])).toBe(true);
  });
});

describe("reorder", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("moves an item onto another's position", () => {
    expect(reorder(items, "a", "c").map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(reorder(items, "c", "a").map((i) => i.id)).toEqual(["c", "a", "b"]);
  });
  it("is a no-op for unknown ids", () => expect(reorder(items, "x", "a")).toBe(items));
});
