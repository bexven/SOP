import { CheckIcon, XIcon } from "lucide-react";
import type { Stepper } from "@/lib/domain/stepper";
import { cn } from "@/lib/utils";

/**
 * Full pipeline stepper for the product header. When `onSelect` is given, steps
 * for which `canSelect(i)` is true become buttons that open that step's details.
 */
export function PipelineStepper({
  stepper,
  className,
  onSelect,
  canSelect,
  selected,
}: {
  stepper: Stepper;
  className?: string;
  onSelect?: (index: number) => void;
  canSelect?: (index: number) => boolean;
  /** Steps whose details are currently shown (highlighted). */
  selected?: number[];
}) {
  return (
    <ol className={cn("relative flex w-full items-start gap-1 overflow-x-auto pb-1", className)} aria-label="Pipeline progress">
      {stepper.steps.map((step, i) => {
        const done = step.state === "done";
        const current = step.state === "current";
        const killed = step.state === "killed";
        const clickable = Boolean(onSelect && canSelect?.(i));
        const isSelected = clickable && Boolean(selected?.includes(i));
        const Inner = clickable ? "button" : "div";
        return (
          <li key={step.label} className="flex min-w-[5.5rem] flex-1" aria-current={current ? "step" : undefined}>
            <Inner
              {...(clickable
                ? {
                    type: "button" as const,
                    onClick: () => onSelect!(i),
                    "aria-pressed": isSelected,
                    title: `Show ${step.label}`,
                  }
                : {})}
              className={cn(
                "-mx-1.5 -my-1 flex w-full flex-col gap-1.5 rounded-control px-1.5 py-1 text-left",
                clickable && "transition-colors duration-150 hover:bg-slate-900/[0.04] active:bg-slate-900/[0.07]",
                isSelected && "bg-accent hover:bg-accent",
              )}
            >
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 transition-colors",
                  done && "bg-primary text-white ring-primary",
                  current && "bg-white text-primary ring-2 ring-primary",
                  killed && "bg-rose-600 text-white ring-rose-600",
                  step.state === "upcoming" && "bg-white text-slate-500 ring-slate-300",
                )}
              >
                {done ? <CheckIcon className="size-3" /> : killed ? <XIcon className="size-3" /> : i + 1}
              </span>
              {i < stepper.steps.length - 1 ? (
                <span className={cn("h-px flex-1 rounded-full", done ? "bg-primary" : "bg-slate-200")} aria-hidden />
              ) : null}
            </div>
            <span
              className={cn(
                "pr-2 text-[11px] leading-tight font-medium",
                current ? "text-slate-900" : killed ? "text-rose-700" : done ? "text-slate-700" : "text-slate-500",
              )}
            >
              {step.label}
              {current && stepper.progress ? (
                <span className="num block font-normal text-slate-500">
                  {stepper.progress.approved}/{stepper.progress.total} approved
                </span>
              ) : null}
              {killed ? <span className="block font-normal">Killed here</span> : null}
            </span>
            <span className="sr-only">{step.state}</span>
            </Inner>
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
            s.state === "done" && "bg-primary",
            s.state === "current" && "bg-primary/40",
            s.state === "killed" && "bg-rose-500",
            s.state === "upcoming" && "bg-slate-200",
          )}
        />
      ))}
    </div>
  );
}
