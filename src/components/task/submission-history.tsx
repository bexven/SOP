import { CheckIcon, ExternalLinkIcon, RotateCcwIcon } from "lucide-react";
import { UserAvatar } from "@/components/common/user-avatar";
import { formatDateTime } from "@/lib/format";
import type { TaskDTO } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";

export function SubmissionHistory({ submissions }: { submissions: TaskDTO["submissions"] }) {
  if (submissions.length === 0) return null;
  return (
    <section aria-label="Submission history" className="rounded-control border border-slate-200/80 bg-white">
      <h4 className="border-b border-slate-100 px-3 py-2 text-meta text-slate-700">
        Submissions <span className="num text-slate-500">{submissions.length}</span>
      </h4>
      <ol className="divide-y divide-slate-100">
        {submissions.map((s, i) => (
          <li key={s.id} className={cn("grid gap-1.5 px-3 py-2.5", i > 0 && "opacity-80")}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-slate-600">
              <span className="num rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">v{s.version}</span>
              <UserAvatar name={s.submittedBy.name} color={s.submittedBy.avatarColor} size="xs" />
              <span className="font-medium text-slate-800">{s.submittedBy.name}</span>
              <span className="num font-normal">{formatDateTime(new Date(s.createdAt))}</span>
            </div>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 text-body font-medium text-indigo-700 hover:underline"
            >
              <span className="truncate">{s.url.replace(/^https?:\/\//, "")}</span>
              <ExternalLinkIcon className="size-3.5 shrink-0" />
            </a>
            {s.note ? <p className="text-body whitespace-pre-line text-slate-700">{s.note}</p> : null}
            {s.decision ? (
              <div
                className={cn(
                  "mt-0.5 flex items-start gap-2 rounded-md px-2 py-1.5 text-meta",
                  s.decision === "APPROVED" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800",
                )}
              >
                {s.decision === "APPROVED" ? <CheckIcon className="mt-px size-3.5 shrink-0" /> : <RotateCcwIcon className="mt-px size-3.5 shrink-0" />}
                <span>
                  {s.decision === "APPROVED" ? "Approved" : "Revision requested"} by {s.decidedBy?.name ?? "—"}
                  {s.decidedAt ? <span className="num font-normal"> · {formatDateTime(new Date(s.decidedAt))}</span> : null}
                  {s.decisionNote ? <span className="block font-normal whitespace-pre-line">{s.decisionNote}</span> : null}
                </span>
              </div>
            ) : (
              <span className="text-meta text-indigo-700">Waiting for review</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
