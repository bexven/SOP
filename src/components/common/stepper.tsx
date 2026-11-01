import { CheckIcon, XIcon } from "lucide-react";
import type { Stepper } from "@/lib/domain/stepper";
import { cn } from "@/lib/utils";

/** Full pipeline stepper for the product header. */
export function PipelineStepper({ stepper, className }: { stepper: Stepper; className?: string }) {
  return (
    <ol className={cn("flex w-full items-start gap-1 overflow-x-auto pb-1", className)} aria-label="Pipeline progress">
      {stepper.steps.map((step, i) => {
        const done = step.state === "done";
        const current = step.state === "current";
        const killed = step.state === "killed";
        return (
          <li key={step.label} className="flex min-w-[5.5rem] flex-1 flex-col gap-1.5" aria-current={current ? "step" : undefined}>
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 transition-colors",
                  done && "bg-indigo-600 text-white ring-indigo-600",
                  current && "bg-white text-indigo-700 ring-2 ring-indigo-500",
                  killed && "bg-rose-600 text-white ring-rose-600",
                  step.state === "upcoming" && "bg-white text-slate-500 ring-slate-300",
                )}
              >
                {done ? <CheckIcon className="size-3" /> : killed ? <XIcon className="size-3" /> : i + 1}
              </span>
              {i < stepper.steps.length - 1 ? (
                <span className={cn("h-px flex-1 rounded-full", done ? "bg-indigo-500" : "bg-slate-200")} aria-hidden />
              ) : null}
            </div>
            <span
              className={cn(
                "pr-2 text-[11px] leading-tight font-medium",
                current ? "text-slate-900" : killed ? "text-rose-700" : done ? "text-slate-700" : "text-slate-500",
              )}
            >
              {step.label}
              {current && stepper.phase1Progress && stepper.phase1Progress.total > 0 ? (
                <span className="num block font-normal text-slate-500">
                  {stepper.phase1Progress.approved}/{stepper.phase1Progress.total} approved
                </span>
              ) : null}
              {killed ? <span className="block font-normal">Killed here</span> : null}
            </span>
            <span className="sr-only">{step.state}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Compact stepper for cards and table rows. */
export function MiniStepper({ stepper, className }: { stepper: Stepper; className?: string }) {
  const label = stepper.completed
    ? "Completed"
    : stepper.killed
      ? `Killed at ${stepper.steps[stepper.index]?.label}`
      : stepper.steps[stepper.index]?.label;
  return (
    <div className={cn("flex items-center gap-[3px]", className)} role="img" aria-label={`Progress: ${label}`} title={label}>
      {stepper.steps.map((s) => (
        <span
          key={s.label}
          className={cn(
            "h-1 w-3.5 rounded-full",
            s.state === "done" && "bg-indigo-500",
            s.state === "current" && "bg-indigo-300",
            s.state === "killed" && "bg-rose-500",
            s.state === "upcoming" && "bg-slate-200",
          )}
        />
      ))}
    </div>
  );
}
