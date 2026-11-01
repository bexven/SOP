import { describe, expect, it } from "vitest";
import { deriveStepper, type StepperInput } from "./stepper";

const base: StepperInput = { stage: "RESEARCH", stageBeforeKill: null, campaignStatus: null, phase1: { approved: 0, total: 0 } };
const states = (i: StepperInput) => deriveStepper(i).steps.map((s) => s.state[0]).join("");

describe("deriveStepper", () => {
  it("research", () => expect(states(base)).toBe("cuuuuu"));
  it("product review", () => expect(states({ ...base, stage: "REVIEW" })).toBe("dcuuuu"));
  it("creative phase 1 with progress", () => {
    const s = deriveStepper({ ...base, stage: "CREATIVE", phase1: { approved: 1, total: 2 } });
    expect(s.index).toBe(2);
    expect(s.phase1Progress).toEqual({ approved: 1, total: 2 });
  });
  it("creative phase 2 once both phase 1 tasks are approved (Q13)", () => {
    expect(states({ ...base, stage: "CREATIVE", phase1: { approved: 2, total: 2 } })).toBe("dddcuu");
  });
  it("ready to launch and live (no Scaling step)", () => {
    expect(states({ ...base, stage: "READY_TO_LAUNCH" })).toBe("ddddcu");
    expect(states({ ...base, stage: "LIVE", campaignStatus: "RUNNING" })).toBe("dddddc");
    expect(states({ ...base, stage: "LIVE", campaignStatus: "SCALING" })).toBe("dddddc");
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
