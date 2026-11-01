import { describe, expect, it } from "vitest";
import { deriveStepper, type StepperInput } from "./stepper";

const none = { approved: 0, total: 0 };
const base: StepperInput = { stage: "RESEARCH", stageBeforeKill: null, campaignStatus: null, lanes: { images: none, videos: none }, ordering: false };
const states = (i: StepperInput) => deriveStepper(i).steps.map((s) => s.state[0]).join("");

describe("deriveStepper", () => {
  it("research", () => expect(states(base)).toBe("cuuuuu"));
  it("product review", () => expect(states({ ...base, stage: "REVIEW" })).toBe("dcuuuu"));
  it("image creative with progress", () => {
    const s = deriveStepper({ ...base, stage: "CREATIVE", lanes: { images: { approved: 1, total: 3 }, videos: { approved: 0, total: 2 } } });
    expect(s.index).toBe(2);
    expect(s.progress).toEqual({ approved: 1, total: 3 });
  });
  it("video creative once every image task is approved", () => {
    const s = deriveStepper({ ...base, stage: "CREATIVE", lanes: { images: { approved: 3, total: 3 }, videos: { approved: 1, total: 2 } } });
    expect(s.index).toBe(3);
    expect(s.progress).toEqual({ approved: 1, total: 2 });
  });
  it("meta ads while ready to launch / live, ordering once moved", () => {
    expect(states({ ...base, stage: "READY_TO_LAUNCH" })).toBe("ddddcu");
    expect(states({ ...base, stage: "LIVE", campaignStatus: "RUNNING" })).toBe("ddddcu");
    expect(states({ ...base, stage: "LIVE", ordering: true })).toBe("dddddc");
  });
  it("completed marks everything done", () => {
    const s = deriveStepper({ ...base, stage: "COMPLETED" });
    expect(s.completed).toBe(true);
    expect(s.steps.every((x) => x.state === "done")).toBe(true);
  });
  it("killed shows where it stopped", () => {
    const s = deriveStepper({ ...base, stage: "KILLED", stageBeforeKill: "READY_TO_LAUNCH" });
    expect(s.killed).toBe(true);
    expect(s.steps.map((x) => x.state[0]).join("")).toBe("ddddku");
  });
});
