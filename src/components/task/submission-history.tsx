"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, RotateCcwIcon } from "lucide-react";
import { UserAvatar } from "@/components/common/user-avatar";
import { formatDateTime } from "@/lib/format";
import type { TaskDTO } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";
import { RoundGallery } from "./round-gallery";

type Round = TaskDTO["submissions"][number];

export function RoundHeader({ s }: { s: Round }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-slate-600">
      <span className="num rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">Version {s.version}</span>
      <UserAvatar name={s.submittedBy.name} color={s.submittedBy.avatarColor} imageId={s.submittedBy.avatarAssetId} size="xs" />
      <span className="font-medium text-slate-800">{s.submittedBy.name}</span>
      <span className="num font-normal">{formatDateTime(new Date(s.createdAt))}</span>
    </div>
  );
}

export function Decision({ s }: { s: Round }) {
  if (!s.decision) return <span className="text-meta text-indigo-700">Waiting for review</span>;
  return (
    <div className={cn("flex items-start gap-2 rounded-md px-2 py-1.5 text-meta", s.decision === "APPROVED" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800")}>
      {s.decision === "APPROVED" ? <CheckIcon className="mt-px size-3.5 shrink-0" /> : <RotateCcwIcon className="mt-px size-3.5 shrink-0" />}
      <span>
        {s.decision === "APPROVED" ? "Approved" : "Changes requested"} by {s.decidedBy?.name ?? "—"}
        {s.decidedAt ? <span className="num font-normal"> · {formatDateTime(new Date(s.decidedAt))}</span> : null}
        {s.decisionNote ? <span className="block font-normal whitespace-pre-line">{s.decisionNote}</span> : null}
      </span>
    </div>
  );
}

/** Earlier versions, collapsed. */
export function SubmissionHistory({ rounds }: { rounds: Round[] }) {
  const [open, setOpen] = useState(false);
  if (rounds.length === 0) return null;
  return (
    <section className="rounded-control border border-slate-200/80 bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2 text-left text-meta text-slate-700">
        Earlier versions <span className="num text-slate-500">({rounds.length})</span>
        <ChevronDownIcon className={cn("ml-auto size-4 text-slate-500 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ol className="divide-y divide-slate-100 border-t border-slate-100">
          {rounds.map((s) => (
            <li key={s.id} className="grid gap-2 px-3 py-3">
              <RoundHeader s={s} />
              <RoundGallery items={s.items} canReact={false} compact />
              {s.note ? <p className="text-body whitespace-pre-line text-slate-700">{s.note}</p> : null}
              <Decision s={s} />
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
