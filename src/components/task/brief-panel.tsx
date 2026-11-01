"use client";

import { useState } from "react";
import { ChevronDownIcon, FileTextIcon } from "lucide-react";
import { Markdown } from "@/components/common/markdown";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The creative brief as shown on every creative task. Open by default. */
export function BriefPanel({ brief, updatedAt }: { brief: string | null; updatedAt: string | null }) {
  const [open, setOpen] = useState(true);
  if (!brief) {
    return (
      <div className="flex items-center gap-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-meta text-amber-900">
        <FileTextIcon className="size-3.5" /> Brief pending — the media buyer hasn&apos;t written it yet.
      </div>
    );
  }
  return (
    <div className="rounded-control border border-violet-200/80 bg-violet-50/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-meta text-violet-900"
      >
        <span className="flex items-center gap-2">
          <FileTextIcon className="size-3.5" /> Creative brief
          {updatedAt ? (
            <span className="font-normal text-violet-700" suppressHydrationWarning>
              · updated {formatRelative(new Date(updatedAt))}
            </span>
          ) : null}
        </span>
        <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="border-t border-violet-100 px-3 py-2.5">
          <Markdown source={brief} />
        </div>
      ) : null}
    </div>
  );
}
