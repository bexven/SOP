"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRightIcon, SparklesIcon, XIcon } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { GUIDE } from "@/lib/domain/guide";

const listeners = new Set<() => void>();
const keyFor = (userId: string) => `sop_guide_done_v1_${userId}`;

function read(userId: string): boolean {
  try {
    return window.localStorage.getItem(keyFor(userId)) === "1";
  } catch {
    return false;
  }
}

/** First-login guide on Home: role-specific steps until the person dismisses it (remembered in this browser). */
export function WelcomeGuide({ userId, role, name }: { userId: string; role: Role; name: string }) {
  const dismissed = useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => read(userId),
    () => true, // server: render nothing, so there is no flash for people who dismissed it
  );
  if (dismissed) return null;
  const guide = GUIDE[role];
  const close = () => {
    try {
      window.localStorage.setItem(keyFor(userId), "1");
    } catch {
      /* private mode: it just shows again next time */
    }
    listeners.forEach((f) => f());
  };
  return (
    <section aria-labelledby="guide-h" className="mb-5 rounded-panel border border-indigo-200 bg-accent/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 id="guide-h" className="flex items-center gap-2 text-section text-slate-900">
          <SparklesIcon className="size-4 text-primary" aria-hidden /> Welcome, {name.split(" ")[0]} — {guide.title.toLowerCase()}
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Hide this guide">
          <XIcon />
        </Button>
      </div>
      <ol className="mt-2 grid gap-1.5">
        {guide.steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-body text-slate-700">
            <span className="num mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-primary ring-1 ring-indigo-200">{i + 1}</span>
            <span>
              {s.text}
              {s.href ? (
                <Link href={s.href} className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-primary underline-offset-2 hover:underline">
                  {s.link} <ArrowRightIcon className="size-3.5" aria-hidden />
                </Link>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      <Button variant="outline" size="sm" className="mt-3" onClick={close}>
        Got it
      </Button>
    </section>
  );
}
