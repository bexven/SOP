import { describe, expect, it } from "vitest";
import { averageStageDurations, formatDuration, timeInStages } from "./stage-time";

const h = (n: number) => new Date(Date.UTC(2026, 10, 1, n));
const H = 3_600_000;

describe("timeInStages", () => {
  it("sums stints including repeated visits and an open stint", () => {
    const t = [
      { toStage: "RESEARCH" as const, at: h(0) },
      { toStage: "CREATIVE" as const, at: h(2) },
      { toStage: "RESEARCH" as const, at: h(5) }, // sent back
      { toStage: "CREATIVE" as const, at: h(6) },
    ];
    expect(timeInStages(t, h(10))).toEqual({ RESEARCH: 3 * H, CREATIVE: 7 * H });
  });
  it("does not count time after a terminal stage", () => {
    const t = [
      { toStage: "LIVE" as const, at: h(0) },
      { toStage: "COMPLETED" as const, at: h(4) },
    ];
    expect(timeInStages(t, h(100))).toEqual({ LIVE: 4 * H });
  });
});

describe("averageStageDurations", () => {
  it("averages finished stints only", () => {
    const a = [
      { toStage: "RESEARCH" as const, at: h(0) },
      { toStage: "CREATIVE" as const, at: h(2) },
    ];
    const b = [
      { toStage: "RESEARCH" as const, at: h(0) },
      { toStage: "CREATIVE" as const, at: h(4) },
      { toStage: "READY_TO_LAUNCH" as const, at: h(10) },
    ];
    expect(averageStageDurations([a, b])).toEqual({
      RESEARCH: { avgMs: 3 * H, count: 2 },
      CREATIVE: { avgMs: 6 * H, count: 1 },
    });
  });
});

describe("formatDuration", () => {
  it("formats compactly", () => {
    expect(formatDuration(30_000)).toBe("<1m");
    expect(formatDuration(12 * 60_000)).toBe("12m");
    expect(formatDuration(5 * H + 20 * 60_000)).toBe("5h 20m");
    expect(formatDuration(3 * 24 * H + 4 * H)).toBe("3d 4h");
    expect(formatDuration(2 * 24 * H)).toBe("2d");
  });
});
