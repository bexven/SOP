"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CheckIcon, XIcon } from "lucide-react";
import type { Stepper } from "@/lib/domain/stepper";
import { cn } from "@/lib/utils";

/**
 * Full pipeline stepper for the product header. When `onSelect` is given, steps
 * for which `canSelect(i)` is true become buttons that open that step's details;
 * the shown step gets a soft highlight that glides between steps.
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
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <>
      <CompactStepper stepper={stepper} onSelect={onSelect} canSelect={canSelect} selected={selected} className={className} />
    <ol className={cn("relative hidden w-full items-start overflow-x-auto pb-0.5 sm:flex", className)} aria-label="Pipeline progress">
      {stepper.steps.map((step, i) => {
        const done = step.state === "done";
        const current = step.state === "current";
        const killed = step.state === "killed";
        const clickable = Boolean(onSelect && canSelect?.(i));
        const isSelected = clickable && Boolean(selected?.includes(i));
        const last = i === stepper.steps.length - 1;
        const body = (
          <>
            {isSelected ? (
              <motion.span
                layoutId={`step-pill-${id}`}
                className="absolute inset-0 rounded-control bg-accent ring-1 ring-primary/25 ring-inset"
                transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.45 }}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 transition-[transform,box-shadow] duration-200 ease-out",
                done && "bg-primary text-white ring-primary",
                current && "bg-white text-primary ring-2 ring-primary",
                killed && "bg-rose-600 text-white ring-rose-600",
                step.state === "upcoming" && "bg-white text-slate-500 ring-slate-300",
                clickable && "group-hover:scale-110 group-hover:shadow-[0_0_0_4px_var(--color-accent)]",
                isSelected && "scale-110 shadow-[0_0_0_4px_rgb(255_255_255/0.9)]",
              )}
            >
              {done ? <CheckIcon className="size-3" /> : killed ? <XIcon className="size-3" /> : i + 1}
            </span>
            <span
              className={cn(
                "relative text-[11px] leading-tight font-medium transition-colors duration-200",
                isSelected ? "text-accent-foreground" : current ? "text-slate-900" : killed ? "text-rose-700" : done ? "text-slate-700" : "text-slate-500",
                clickable && !isSelected && "group-hover:text-slate-900",
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
          </>
        );
        return (
          <li key={step.label} className="relative min-w-[6.5rem] flex-1" aria-current={current ? "step" : undefined}>
            {!last ? (
              <span
                className={cn("absolute top-[19px] right-0 left-[38px] h-[2px] rounded-full transition-colors duration-300", done ? "bg-primary" : "bg-slate-200")}
                aria-hidden
              />
            ) : null}
            {clickable ? (
              <button
                type="button"
                onClick={() => onSelect!(i)}
                aria-pressed={isSelected}
                title={`Show ${step.label}`}
                className="group relative z-10 flex w-fit flex-col items-start gap-1.5 rounded-control px-2 py-1.5 pr-3 text-left outline-none transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.035] focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96]"
              >
                {body}
              </button>
            ) : (
              <div className="relative z-10 flex flex-col items-start gap-1.5 px-2 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
    </>
  );
}

/** Phones: six dots that fit the width, with the shown (or current) step's name underneath. */
function CompactStepper({
  stepper,
  onSelect,
  canSelect,
  selected,
  className,
}: {
  stepper: Stepper;
  onSelect?: (index: number) => void;
  canSelect?: (index: number) => boolean;
  selected?: number[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const shown = selected?.[0] ?? Math.min(stepper.index, stepper.steps.length - 1);
  const step = stepper.steps[shown];
  return (
    <div className={cn("grid gap-2 px-1 py-1 sm:hidden", className)}>
      <ol className="flex items-center" aria-label="Pipeline progress">
        {stepper.steps.map((s, i) => {
          const done = s.state === "done";
          const current = s.state === "current";
          const killed = s.state === "killed";
          const clickable = Boolean(onSelect && canSelect?.(i));
          const isShown = i === shown;
          const dot = (
            <span
              className={cn(
                "relative flex size-7 items-center justify-center rounded-full text-[11px] font-semibold ring-1 transition-[transform,box-shadow] duration-200",
                done && "bg-primary text-white ring-primary",
                current && "bg-white text-primary ring-2 ring-primary",
                killed && "bg-rose-600 text-white ring-rose-600",
                s.state === "upcoming" && "bg-white text-slate-500 ring-slate-300",
                isShown && "scale-110 shadow-[0_0_0_4px_var(--color-accent)]",
              )}
            >
              {done ? <CheckIcon className="size-3.5" /> : killed ? <XIcon className="size-3.5" /> : i + 1}
            </span>
          );
          return (
            <li key={s.label} className={cn("flex items-center", i < stepper.steps.length - 1 && "flex-1")} aria-current={current ? "step" : undefined}>
              {clickable ? (
                <button type="button" onClick={() => onSelect!(i)} aria-pressed={isShown} aria-label={`${s.label} (${s.state})`} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-90">
                  {dot}
                </button>
              ) : (
                <span aria-label={`${s.label} (${s.state})`}>{dot}</span>
              )}
              {i < stepper.steps.length - 1 ? <span className={cn("mx-1 h-[2px] flex-1 rounded-full", done ? "bg-primary" : "bg-slate-200")} aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
      {step ? (
        <motion.p
          key={shown}
          initial={reduce ? false : { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="flex items-center justify-between gap-2 text-meta"
        >
          <span className={cn("font-semibold", step.state === "killed" ? "text-rose-700" : "text-slate-900")}>
            <span className="num font-normal text-slate-500">Step {shown + 1} of {stepper.steps.length} · </span>
            {step.label}
          </span>
          <span className="num font-normal text-slate-500">
            {step.state === "current" && stepper.progress
              ? `${stepper.progress.approved}/${stepper.progress.total} approved`
              : step.state === "done"
                ? "Done"
                : step.state === "killed"
                  ? "Killed here"
                  : step.state === "current"
                    ? "Now"
                    : "Later"}
          </span>
        </motion.p>
      ) : null}
    </div>
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
