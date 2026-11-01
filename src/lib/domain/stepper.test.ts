import { describe, expect, it } from "vitest";
import { deriveStepper, type StepperInput } from "./stepper";

const base: StepperInput = { stage: "RESEARCH", stageBeforeKill: null, campaignStatus: null, phase1: { approved: 0, total: 0 } };
const states = (i: StepperInput) => deriveStepper(i).steps.map((s) => s.state[0]).join("");

describe("deriveStepper", () => {
  it("research", () => expect(states(base)).toBe("cuuuu"));
  it("creative phase 1 with progress", () => {
    const s = deriveStepper({ ...base, stage: "CREATIVE", phase1: { approved: 1, total: 2 } });
    expect(s.index).toBe(1);
    expect(s.phase1Progress).toEqual({ approved: 1, total: 2 });
  });
  it("creative phase 2 once both phase 1 tasks are approved (Q13)", () => {
    expect(states({ ...base, stage: "CREATIVE", phase1: { approved: 2, total: 2 } })).toBe("ddcuu");
  });
  it("ready to launch and live (no Scaling step)", () => {
    expect(states({ ...base, stage: "READY_TO_LAUNCH" })).toBe("dddcu");
    expect(states({ ...base, stage: "LIVE", campaignStatus: "RUNNING" })).toBe("ddddc");
    expect(states({ ...base, stage: "LIVE", campaignStatus: "SCALING" })).toBe("ddddc");
  });
  it("completed marks everything done", () => {
    const s = deriveStepper({ ...base, stage: "COMPLETED" });
    expect(s.completed).toBe(true);
    expect(s.steps.every((x) => x.state === "done")).toBe(true);
  });
  it("killed shows where it stopped", () => {
    const s = deriveStepper({ ...base, stage: "KILLED", stageBeforeKill: "READY_TO_LAUNCH" });
    expect(s.killed).toBe(true);
    expect(s.steps.map((x) => x.state[0]).join("")).toBe("dddku");
  });
});
