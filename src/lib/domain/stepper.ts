import type { CampaignStatus, ProductStage } from "@/generated/prisma/enums";

/**
 * Pipeline stepper (pure). Derived from stage, Phase 1 progress and campaign
 * status — never stored.
 *   Research → Creative · Phase 1 → Creative · Phase 2 & Store → Ready to Launch → Live
 * (A "Scaling" step was removed at the owner's request.)
 */

export const STEPPER_STEPS = [
  "Research",
  "Creative: step 1",
  "Creative: step 2 & store",
  "Ready to launch",
  "Live",
] as const;

export type StepState = "done" | "current" | "upcoming" | "killed";

export type StepperInput = {
  stage: ProductStage;
  stageBeforeKill: ProductStage | null;
  campaignStatus: CampaignStatus | null;
  /** Phase 1 tasks of the current batch (non-cancelled). */
  phase1: { approved: number; total: number };
};

export type Stepper = {
  steps: { label: string; state: StepState }[];
  /** Index of the current step; STEPPER_STEPS.length when completed. */
  index: number;
  killed: boolean;
  completed: boolean;
  /** Shown under "Creative · Phase 1" while it is current. */
  phase1Progress: { approved: number; total: number } | null;
};

function indexFor(stage: ProductStage, input: StepperInput): number {
  switch (stage) {
    case "RESEARCH":
      return 0;
    case "CREATIVE":
      return input.phase1.total > 0 && input.phase1.approved >= input.phase1.total ? 2 : 1;
    case "READY_TO_LAUNCH":
      return 3;
    case "LIVE":
      return 4;
    case "COMPLETED":
      return STEPPER_STEPS.length;
    case "KILLED":
      return input.stageBeforeKill ? indexFor(input.stageBeforeKill, input) : 0;
  }
}

export function deriveStepper(input: StepperInput): Stepper {
  const killed = input.stage === "KILLED";
  const completed = input.stage === "COMPLETED";
  const index = indexFor(input.stage, input);
  const steps = STEPPER_STEPS.map((label, i) => {
    let state: StepState;
    if (i < index) state = "done";
    else if (i === index) state = killed ? "killed" : "current";
    else state = "upcoming";
    return { label, state };
  });
  return {
    steps,
    index,
    killed,
    completed,
    phase1Progress: index === 1 && !killed ? input.phase1 : null,
  };
}
