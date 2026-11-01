import type { CampaignStatus, ProductStage } from "@/generated/prisma/enums";

/**
 * Pipeline stepper (pure). Derived from stage, creative progress per lane and
 * ordering — never stored.
 *   Research → Product review → Image creative → Video creative → Meta ads → Ordering
 * Image and video work run side by side; the stepper shows Image creative until
 * every image task of the current batch is approved, then Video creative.
 */

export const STEPPER_STEPS = ["Research", "Product review", "Image creative", "Video creative", "Meta ads", "Ordering"] as const;

export type StepState = "done" | "current" | "upcoming" | "killed";

type Progress = { approved: number; total: number };

export type StepperInput = {
  stage: ProductStage;
  stageBeforeKill: ProductStage | null;
  campaignStatus: CampaignStatus | null;
  /** Current batch, non-cancelled tasks, per lane. */
  lanes: { images: Progress; videos: Progress };
  /** The product was moved to ordering. */
  ordering: boolean;
};

export type Stepper = {
  steps: { label: string; state: StepState }[];
  /** Index of the current step; STEPPER_STEPS.length when completed. */
  index: number;
  killed: boolean;
  completed: boolean;
  /** "2/3 approved" under the current creative step. */
  progress: Progress | null;
};

const done = (p: Progress) => p.total > 0 && p.approved >= p.total;

function indexFor(stage: ProductStage, input: StepperInput): number {
  switch (stage) {
    case "RESEARCH":
      return 0;
    case "REVIEW":
      return 1;
    case "CREATIVE":
      return done(input.lanes.images) || input.lanes.images.total === 0 ? 3 : 2;
    case "READY_TO_LAUNCH":
      return 4;
    case "LIVE":
      return input.ordering ? 5 : 4;
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
  const progress = killed ? null : index === 2 ? input.lanes.images : index === 3 ? input.lanes.videos : null;
  return { steps, index, killed, completed, progress: progress && progress.total > 0 ? progress : null };
}
