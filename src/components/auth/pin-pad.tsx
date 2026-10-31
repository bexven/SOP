"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { ArrowRightIcon, DeleteIcon, Loader2Icon } from "lucide-react";
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from "@/lib/domain/pin";
import { cn } from "@/lib/utils";

/**
 * Numeric PIN pad (4–6 digits). Works with taps and the physical keyboard
 * (digits, Backspace, Enter). Submits automatically at 6 digits.
 */
export function PinPad({
  onSubmit,
  pending,
  error,
  errorKey,
  submitLabel = "Sign in",
  className,
}: {
  onSubmit: (pin: string) => void;
  pending: boolean;
  error: string | null;
  errorKey: number;
  submitLabel?: string;
  className?: string;
}) {
  const [pin, setPin] = useState("");
  const controls = useAnimationControls();
  const reduce = useReducedMotion();

  // On a new error: clear the entry (adjusting state during render, per
  // React's guidance) and shake the dots (an external animation, so an effect).
  const [seenErrorKey, setSeenErrorKey] = useState(errorKey);
  if (errorKey !== seenErrorKey) {
    setSeenErrorKey(errorKey);
    setPin("");
  }
  useEffect(() => {
    if (errorKey === 0 || reduce) return;
    void controls.start({ x: [0, -10, 10, -6, 6, -2, 0], transition: { duration: 0.4 } });
  }, [errorKey, controls, reduce]);

  const submit = useCallback(
    (value: string) => {
      if (value.length >= PIN_MIN_LENGTH && !pending) onSubmit(value);
    },
    [onSubmit, pending],
  );

  const press = useCallback(
    (digit: string) => {
      if (pending) return;
      setPin((current) => {
        if (current.length >= PIN_MAX_LENGTH) return current;
        const next = current + digit;
        if (next.length === PIN_MAX_LENGTH) queueMicrotask(() => submit(next));
        return next;
      });
    },
    [pending, submit],
  );

  const backspace = useCallback(() => setPin((p) => p.slice(0, -1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") backspace();
      else if (e.key === "Enter") submit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, backspace, submit, pin]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const canSubmit = pin.length >= PIN_MIN_LENGTH && !pending;

  return (
    <div className={cn("flex w-full flex-col items-center", className)}>
      <motion.div animate={controls} className="flex h-6 items-center gap-3" aria-hidden>
        {Array.from({ length: PIN_MAX_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3 rounded-full transition-all duration-150 ease-out",
              i < pin.length
                ? "scale-100 bg-indigo-600 shadow-[0_0_0_4px_rgb(99_102_241/0.15)]"
                : i < PIN_MIN_LENGTH
                  ? "bg-slate-300"
                  : "bg-slate-200",
              error && pin.length === 0 && "bg-rose-300",
            )}
          />
        ))}
      </motion.div>
      <p role="status" aria-live="polite" className="sr-only">
        {pin.length} digits entered
      </p>
      <p role="alert" className={cn("mt-3 min-h-5 text-center text-meta", error ? "text-rose-700" : "text-transparent")}>
        {error ?? "·"}
      </p>

      <div className="mt-3 grid w-full max-w-[17rem] grid-cols-3 gap-2.5">
        {keys.map((k) => (
          <PadKey key={k} onClick={() => press(k)} disabled={pending} label={k}>
            {k}
          </PadKey>
        ))}
        <PadKey onClick={backspace} disabled={pending || pin.length === 0} label="Delete last digit" muted>
          <DeleteIcon className="size-5" />
        </PadKey>
        <PadKey onClick={() => press("0")} disabled={pending} label="0">
          0
        </PadKey>
        <button
          type="button"
          onClick={() => submit(pin)}
          disabled={!canSubmit}
          aria-label={submitLabel}
          className="flex h-14 items-center justify-center rounded-panel bg-indigo-600 text-white shadow-[0_1px_2px_rgb(79_70_229/0.3),inset_0_1px_0_rgb(255_255_255/0.2)] transition-all duration-150 ease-out hover:bg-indigo-700 active:scale-[0.97] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          {pending ? <Loader2Icon className="size-5 animate-spin" /> : <ArrowRightIcon className="size-5" />}
        </button>
      </div>
    </div>
  );
}

function PadKey({
  children,
  onClick,
  disabled,
  label,
  muted,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "num flex h-14 items-center justify-center rounded-panel text-xl font-medium transition-all duration-150 ease-out active:scale-[0.96] disabled:opacity-40",
        muted
          ? "text-slate-600 hover:bg-slate-900/5"
          : "bg-white/80 text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.05)] ring-1 ring-slate-900/[0.06] hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}
