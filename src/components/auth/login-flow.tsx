"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeftIcon, UsersIcon } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { RolePill } from "@/components/common/pill";
import { UserAvatar } from "@/components/common/user-avatar";
import { loginAction } from "@/lib/server/actions/auth";
import { PinPad } from "./pin-pad";

type Person = { id: string; name: string; role: Role; avatarColor: string; avatarAssetId?: string | null };

export function LoginFlow({ roster }: { roster: Person[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setError(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  function submit(pin: string) {
    if (!selected) return;
    startTransition(async () => {
      const result = await loginAction({ userId: selected.id, pin });
      if (!result.ok) {
        setError(result.error);
        setErrorKey((k) => k + 1);
        return;
      }
      router.replace(result.data?.mustChangePin ? "/change-pin" : "/dashboard");
      router.refresh();
    });
  }

  const slide = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 8, filter: "blur(4px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -8, filter: "blur(4px)" },
        transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div className="glass w-full max-w-md overflow-hidden rounded-[20px] p-6 sm:p-8">
      <AnimatePresence mode="wait" initial={false}>
        {!selected ? (
          <motion.div key="pick" {...slide}>
            <h1 className="text-page text-slate-900">Who&apos;s working?</h1>
            <p className="mt-1 text-body text-slate-600">Choose your name to sign in.</p>
            {roster.length === 0 ? (
              <div className="mt-8 flex flex-col items-center rounded-panel border border-dashed border-slate-300 bg-white/50 px-4 py-10 text-center">
                <UsersIcon className="mb-3 size-5 text-slate-500" />
                <p className="text-body font-medium text-slate-800">No team members yet</p>
                <p className="mt-1 text-meta text-slate-600">Run the seed script to create the first Admin.</p>
              </div>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {roster.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(p);
                        setError(null);
                        setErrorKey(0);
                      }}
                      className="group flex w-full flex-col items-center gap-2 rounded-panel border border-transparent bg-white/60 px-2 py-4 text-center transition-all duration-150 ease-out hover:-translate-y-px hover:border-white hover:bg-white hover:shadow-[var(--raised-shadow)]"
                    >
                      <UserAvatar name={p.name} color={p.avatarColor} imageId={p.avatarAssetId} size="lg" />
                      <span className="w-full truncate text-body font-medium text-slate-900">{p.name}</span>
                      <RolePill role={p.role} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : (
          <motion.div key="pin" {...slide} className="flex flex-col items-center">
            <div className="flex w-full items-center">
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setError(null);
                }}
                className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-meta text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-900"
              >
                <ArrowLeftIcon className="size-3.5" /> Not you?
              </button>
            </div>
            <UserAvatar name={selected.name} color={selected.avatarColor} imageId={selected.avatarAssetId} size="xl" className="mt-2" />
            <h1 className="mt-3 text-section text-slate-900">Hi, {selected.name}</h1>
            <p className="text-meta text-slate-600">Enter your PIN</p>
            <PinPad
              key={selected.id}
              onSubmit={submit}
              pending={pending}
              error={error}
              errorKey={errorKey}
              className="mt-6"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
