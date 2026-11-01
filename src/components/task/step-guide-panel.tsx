"use client";

import { useState } from "react";
import { BookOpenIcon, ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Markdown } from "@/components/common/markdown";
import { cn } from "@/lib/utils";

export type GuideDTO = { body: string; links: { label: string; url: string }[] };

/** Collapsible "How we do this" panel. */
export function StepGuidePanel({ guide, className }: { guide: GuideDTO | undefined; className?: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const empty = !guide || (!guide.body.trim() && guide.links.length === 0);
  return (
    <div className={cn("rounded-control border border-slate-200/80 bg-white", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-meta text-slate-700 hover:bg-slate-50/70"
      >
        <span className="flex items-center gap-2">
          <BookOpenIcon className="size-3.5 text-slate-500" /> How we do this
        </span>
        <ChevronDownIcon className={cn("size-4 text-slate-500 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 px-3 py-3">
              {empty ? (
                <p className="text-meta font-normal text-slate-500">
                  No guide yet. An Admin can write one in Settings → Step guides.
                </p>
              ) : (
                <>
                  {guide!.body.trim() ? <Markdown source={guide!.body} /> : null}
                  {guide!.links.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {guide!.links.map((l) => (
                        <li key={l.url}>
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-meta text-slate-700 hover:bg-slate-200/80"
                          >
                            {l.label} <ExternalLinkIcon className="size-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
