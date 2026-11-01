"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/common/user-avatar";
import { changePinAction } from "@/lib/server/actions/auth";
import { PinPad } from "./pin-pad";

export function ChangePinForm({ name, avatarColor, forced }: { name: string; avatarColor: string; forced: boolean }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [pending, startTransition] = useTransition();

  function fail(message: string) {
    setError(message);
    setErrorKey((k) => k + 1);
  }

  function handle(pin: string) {
    if (first === null) {
      setFirst(pin);
      setError(null);
      return;
    }
    if (pin !== first) {
      setFirst(null);
      fail("PINs didn't match. Start again.");
      return;
    }
    startTransition(async () => {
      const result = await changePinAction({ pin: first, confirm: pin });
      if (!result.ok) {
        setFirst(null);
        fail(result.error);
        return;
      }
      toast.success("PIN updated", { description: "Use your new PIN next time you sign in." });
      router.replace("/dashboard");
      router.refresh();
    });
  }

  const step = first === null ? "first" : "confirm";

  return (
    <div className="glass w-full max-w-md rounded-[20px] p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <UserAvatar name={name} color={avatarColor} size="xl" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <h1 className="mt-3 text-section text-slate-900">
              {step === "first" ? (forced ? `Welcome, ${name}` : "Choose a new PIN") : "Confirm your PIN"}
            </h1>
            <p className="mt-0.5 text-meta text-slate-600">
              {step === "first"
                ? forced
                  ? "Set a personal 4–6 digit PIN before you start."
                  : "Enter a new 4–6 digit PIN."
                : "Enter the same PIN again."}
            </p>
          </motion.div>
        </AnimatePresence>
        <PinPad
          key={step}
          onSubmit={handle}
          pending={pending}
          error={error}
          errorKey={errorKey}
          submitLabel={step === "first" ? "Continue" : "Save PIN"}
          className="mt-6"
        />
      </div>
    </div>
  );
}
